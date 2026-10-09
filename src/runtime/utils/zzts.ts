import { addProtocol } from 'maplibre-gl'
import type { AddProtocolAction } from 'maplibre-gl'
import { defineGlobalSingleton } from '@movk/core'
import { logger } from './logger'
import { createImageStore, createLru, fetchWithRetry } from './zzts-cache'
import type { Lru, ZztsImageStore } from './zzts-cache'
import { getZztsClip } from './zzts-clip'
import type { ZztsClip } from './zzts-clip'
import type { TileCoord, TileRange, ZztsElement, ZztsMedia } from './zzts-tile'
import {
  canvasSize,
  elementsUrl,
  extentBBox,
  intersectBBox,
  metatileRange,
  parseZztsUrl,
  planDraws,
  planQueries,
  projectRings,
  tileBBox,
  tileRange,
  zztsTileJson
} from './zzts-tile'

export interface ZztsProtocolOptions {
  /**
   * 协议名；为不同服务分别注册（如各自的鉴权）时取不同名称
   * @defaultValue 'zzts'
   */
  scheme?: string
  /** 自定义请求，元数据、元素列表与元素图片共用；用于附加鉴权头或改走代理 */
  fetch?: typeof globalThis.fetch
  /**
   * 元素图片缓存数量（压缩数据）；相邻瓦片常共用同一网格图片，命中时不再重复下载
   * @defaultValue 256
   */
  cacheSize?: number
  /**
   * 网络错误或 5xx 时的重试次数，按 500ms 起指数退避；404 视为未生成，不重试
   * @defaultValue 2
   */
  retry?: number
  /**
   * 合并请求的边长（瓦片数，取 2 的幂）：相邻 n×n 个瓦片共用一次元素列表请求；设为 1 关闭合并
   * @defaultValue 2
   */
  metatileSize?: number
}

interface ZztsErrorPayload {
  code?: number
  msg?: string
}

interface ZztsLayerImage {
  element: ZztsElement
  image: ImageBitmap
}

const EMPTY_TILE = new ArrayBuffer(0)
/** 缺图时向上补底的最大级数 */
const MAX_FALLBACK_LEVELS = 3
const ELEMENT_LIST_CACHE_SIZE = 512

/** 去掉非图片元素，并按 id 与 extent 去重（相邻网格可能以不同 id 返回同一范围） */
function imageElements(payload: { elements?: ZztsElement[] } & ZztsErrorPayload): ZztsElement[] {
  if (!Array.isArray(payload.elements)) throw new Error(payload.msg || 'ZZTS 元素请求失败')
  return dedupe(payload.elements.filter(element => element.type === 'image'))
}

function dedupe(elements: ZztsElement[]): ZztsElement[] {
  const seen = new Set<string>()
  return elements.filter(({ id, extent: { xmin, ymin, xmax, ymax } }) => {
    const keys = [`id:${id}`, `extent:${[xmin, ymin, xmax, ymax].map(value => value.toFixed(8))}`]
    if (keys.some(key => seen.has(key))) return false
    keys.forEach(key => seen.add(key))
    return true
  })
}

/** 先按元素拼合，再以裁剪区域（evenodd，孔洞挖空）抠去区域外的像素 */
function compose(tile: TileCoord, items: ZztsLayerImage[], size: number, clip?: ZztsClip): ImageBitmap {
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext('2d')!
  for (const { element, image } of items) {
    for (const { source: [sx, sy, sw, sh], target: [dx, dy, dw, dh] } of planDraws(element.extent, tile, size)) {
      context.drawImage(image, sx * image.width, sy * image.height, sw * image.width, sh * image.height, dx, dy, dw, dh)
    }
  }
  if (clip) {
    const path = new Path2D()
    for (const [first, ...rest] of projectRings(clip.rings, tile, size)) {
      if (!first) continue
      path.moveTo(...first)
      rest.forEach(point => path.lineTo(...point))
      path.closePath()
    }
    context.globalCompositeOperation = 'destination-in'
    context.fill(path, 'evenodd')
  }
  return canvas.transferToImageBitmap()
}

function createZztsProtocol({
  fetch: request = globalThis.fetch.bind(globalThis),
  cacheSize = 256,
  retry = 2,
  metatileSize = 2
}: ZztsProtocolOptions): AddProtocolAction {
  const images: ZztsImageStore = createImageStore(request, { size: cacheSize, retry })
  const medias = new Map<string, Promise<ZztsMedia>>()
  const lists = createLru<string, Promise<ZztsElement[]>>(ELEMENT_LIST_CACHE_SIZE)

  // 元数据与元素列表由多个瓦片共享，不绑定单个瓦片的 signal；调用方在等待后自行检查中止
  async function getJson<T>(url: string): Promise<T> {
    const res = await fetchWithRetry(request, url, retry)
    if (!res.ok) throw new Error(`ZZTS 请求失败：HTTP ${res.status}`)
    return await res.json() as T
  }

  function shared<T>(cache: Lru<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key)
    if (hit) return hit
    const pending = load()
    pending.catch(() => cache.delete(key))
    cache.set(key, pending)
    return pending
  }

  const getMedia = (mediaUrl: string) => shared(medias, mediaUrl, () => getJson<ZztsMedia>(mediaUrl))

  /** 区间内的元素列表；区间经度跨度超限时由 planQueries 拆成多次请求再合并 */
  function rangeElements(mediaUrl: string, media: ZztsMedia, range: TileRange, pixelRatio: number, coarser: number): Promise<ZztsElement[]> {
    const key = [mediaUrl, pixelRatio, coarser, range.z, range.x0, range.y0, range.x1, range.y1].join('|')
    return shared(lists, key, async () => {
      const queries = planQueries(range, extentBBox(media.extent), pixelRatio, coarser)
      const payloads = await Promise.all(queries.map(query => getJson<{ elements?: ZztsElement[] } & ZztsErrorPayload>(elementsUrl(mediaUrl, query))))
      return dedupe(payloads.flatMap(imageElements))
    })
  }

  /** 先取合并区间的列表；为空时可能是服务端「元素过多返回空列表」，退回单瓦片请求 */
  async function tileElements(mediaUrl: string, media: ZztsMedia, tile: TileCoord, pixelRatio: number, coarser: number): Promise<ZztsElement[]> {
    const group = metatileRange(tile, metatileSize)
    const single = tileRange(tile)
    const merged = group.x1 - group.x0 > 1
    let elements = await rangeElements(mediaUrl, media, group, pixelRatio, coarser)
    if (merged && !elements.length) elements = await rangeElements(mediaUrl, media, single, pixelRatio, coarser)
    const bbox = tileBBox(tile)
    return elements.filter(element => intersectBBox(extentBBox(element.extent), bbox))
  }

  /** 加载瓦片在某一级的图片；存在加载失败（如 404 未生成）的元素时，取更粗一级垫在下方补洞 */
  async function loadLevel(
    mediaUrl: string,
    media: ZztsMedia,
    tile: TileCoord,
    pixelRatio: number,
    coarser: number,
    acquired: string[]
  ): Promise<ZztsLayerImage[]> {
    const elements = await tileElements(mediaUrl, media, tile, pixelRatio, coarser)
    const loaded = await Promise.all(elements.map((element) => {
      acquired.push(element.url)
      return images.acquire(element.url)
    }))
    const layers = elements.flatMap((element, i) => loaded[i] ? [{ element, image: loaded[i] }] : [])
    if (layers.length === elements.length || coarser >= MAX_FALLBACK_LEVELS) return layers
    return [...await loadLevel(mediaUrl, media, tile, pixelRatio, coarser + 1, acquired), ...layers]
  }

  return async ({ url }, { signal }) => {
    const { mediaUrl, tile, pixelRatio, clip: clipKey } = parseZztsUrl(url)
    const clip = clipKey ? getZztsClip(clipKey) : undefined
    const media = await getMedia(mediaUrl)
    signal.throwIfAborted()
    if (!tile) return { data: zztsTileJson(url, media, clip?.bbox) }

    // 裁剪键失效（图层正在卸载）或瓦片与裁剪区域不相交时不出图，宁缺勿露
    if (clipKey && (!clip || !intersectBBox(tileBBox(tile), clip.bbox))) return { data: EMPTY_TILE }

    const acquired: string[] = []
    try {
      const layers = await loadLevel(mediaUrl, media, tile, pixelRatio, 0, acquired)
      signal.throwIfAborted()
      return { data: layers.length ? compose(tile, layers, canvasSize(pixelRatio), clip) : EMPTY_TILE }
    } finally {
      acquired.forEach(images.release)
    }
  }
}

/**
 * 注册 ZZTS 协议（按协议名全局单例、幂等）：把 ZZTS 二维动态切片服务适配为 512 墨卡托栅格瓦片。
 * `MaplibreZztsLayer` 或 `MaplibreRasterLayer` 的 `url` 写成 `zzts://` + media 接口地址即可。
 */
export function registerZztsProtocol(options: ZztsProtocolOptions = {}): void {
  const scheme = options.scheme ?? 'zzts'
  let created = false
  defineGlobalSingleton(`movk-maplibre:protocol:${scheme}`, () => {
    created = true
    addProtocol(scheme, createZztsProtocol(options))
    return true
  })
  if (!created && Object.keys(options).some(key => key !== 'scheme')) {
    logger.warn(`ZZTS protocol "${scheme}" is already registered; the new options are ignored. Register a different scheme for another configuration.`)
  }
}
