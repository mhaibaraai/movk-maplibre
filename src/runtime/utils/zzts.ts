import { addProtocol } from 'maplibre-gl'
import type { AddProtocolAction } from 'maplibre-gl'
import { defineGlobalSingleton } from '@movk/core'
import { logger } from './logger'
import { MAX_REFRESHES, abortable, createImageStore, createSharedRequests, fetchWithRetry, refreshDelay } from './zzts-cache'
import type { ZztsImageStore } from './zzts-cache'
import { getZztsClip } from './zzts-clip'
import type { ZztsClip } from './zzts-clip'
import type { LngLatBBox, TileCoord, TileRange, ZztsElement, ZztsMedia } from './zzts-tile'
import {
  canvasSize,
  coarserSource,
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
   * 合并请求的边长（瓦片数，取 2 的幂）：相邻 n×n 个瓦片共用一次元素列表请求，合并后画布边长不超过 1536px（高分屏下自动减小）；设为 1 关闭合并
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

interface ZztsElementList {
  elements: ZztsElement[]
  /** 含待生成元素时的复查时间，到期后再取即重新请求 */
  refreshAt?: number
  /** 已复查次数，用于退避 */
  refreshes: number
}

interface ZztsTileImages {
  layers: ZztsLayerImage[]
  /** 本级缺图最早可复查的时间；有值时瓦片到期后由 MapLibre 重载 */
  retryAt?: number
}

const EMPTY_TILE = new ArrayBuffer(0)
/** 完整瓦片的有效期（秒）：MapLibre 不会清除旧的过期时间，缺省 cacheControl 会让曾待复查的瓦片立即反复重载 */
const COMPLETE_MAX_AGE = 31_536_000
/** 缺图时向上补底的最大级数 */
const MAX_FALLBACK_LEVELS = 3
const ELEMENT_LIST_CACHE_SIZE = 512
const MEDIA_CACHE_SIZE = 16
/** 网格边界比较容差（度），吸收服务端坐标的浮点误差 */
const EPSILON = 1e-9

const isPending = (element: ZztsElement) => element.png_status === 0
const overlaps = (a: Readonly<LngLatBBox>, b: Readonly<LngLatBBox>) =>
  a[0] < b[2] - EPSILON && b[0] < a[2] - EPSILON && a[1] < b[3] - EPSILON && b[1] < a[3] - EPSILON
const contains = (outer: Readonly<LngLatBBox>, inner: Readonly<LngLatBBox>) =>
  outer[0] <= inner[0] + EPSILON && outer[1] <= inner[1] + EPSILON && outer[2] >= inner[2] - EPSILON && outer[3] >= inner[3] - EPSILON

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
  const medias = createSharedRequests<ZztsMedia>({ size: MEDIA_CACHE_SIZE })
  const lists = createSharedRequests<ZztsElementList>({
    size: ELEMENT_LIST_CACHE_SIZE,
    isFresh: list => list.refreshAt === undefined || Date.now() < list.refreshAt
  })

  async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const res = await fetchWithRetry(request, url, retry, signal)
    if (!res.ok) throw new Error(`ZZTS 请求失败：HTTP ${res.status}`)
    return await res.json() as T
  }

  /** 拉取区间的元素列表；区间经度跨度超限时由 planQueries 拆成多次请求再合并。复查失败时沿用旧列表并顺延 */
  async function loadList(mediaUrl: string, media: ZztsMedia, range: TileRange, pixelRatio: number, coarser: number, signal: AbortSignal, previous?: ZztsElementList): Promise<ZztsElementList> {
    const refreshes = previous ? previous.refreshes + 1 : 0
    try {
      const queries = planQueries(range, extentBBox(media.extent), pixelRatio, coarser)
      const payloads = await Promise.all(queries.map(query => getJson<{ elements?: ZztsElement[] } & ZztsErrorPayload>(elementsUrl(mediaUrl, query), signal)))
      const elements = dedupe(payloads.flatMap(imageElements))
      return { elements, refreshes, ...(elements.some(isPending) ? { refreshAt: Date.now() + refreshDelay(refreshes) } : {}) }
    } catch (error) {
      if (!previous || signal.aborted) throw error
      return { ...previous, refreshes, refreshAt: Date.now() + refreshDelay(refreshes) }
    }
  }

  function rangeElements(mediaUrl: string, media: ZztsMedia, range: TileRange, pixelRatio: number, coarser: number, signal: AbortSignal): Promise<ZztsElementList> {
    const key = [mediaUrl, pixelRatio, coarser, range.z, range.x0, range.y0, range.x1, range.y1].join('|')
    return lists(key, signal, (loadSignal, previous) => loadList(mediaUrl, media, range, pixelRatio, coarser, loadSignal, previous))
  }

  /** 先取合并区间的列表；为空时可能是服务端「元素过多返回空列表」，退回单瓦片请求 */
  async function tileElements(mediaUrl: string, media: ZztsMedia, tile: TileCoord, pixelRatio: number, coarser: number, signal: AbortSignal): Promise<ZztsElementList> {
    const group = metatileRange(tile, metatileSize, pixelRatio)
    const list = await rangeElements(mediaUrl, media, group, pixelRatio, coarser, signal)
    const merged = group.x1 - group.x0 > 1
    return merged && !list.elements.length ? rangeElements(mediaUrl, media, tileRange(tile), pixelRatio, coarser, signal) : list
  }

  /**
   * 逐级加载瓦片图片：首级缺图（未生成或 404）留下孔洞，逐级向上只取覆盖孔洞的粗级图片垫在下方，
   * 孔洞被完整覆盖即停止；粗级请求对齐祖先瓦片，与其共用元素列表。
   */
  async function loadTile(mediaUrl: string, media: ZztsMedia, tile: TileCoord, pixelRatio: number, signal: AbortSignal, acquired: string[]): Promise<ZztsTileImages> {
    const bbox = tileBBox(tile)
    let holes: LngLatBBox[] = [bbox]
    let retryAt: number | undefined
    let levels: ZztsLayerImage[][] = []

    for (let level = 0; level <= MAX_FALLBACK_LEVELS && holes.length; level++) {
      const source = coarserSource(tile, level)
      const list = await tileElements(mediaUrl, media, source.tile, pixelRatio, source.coarser, signal)
      const candidates = list.elements.filter(element => holes.some(hole => overlaps(extentBBox(element.extent), hole)))
      const ready = candidates.filter(element => !isPending(element))
      const loaded = await abortable(Promise.all(ready.map((element) => {
        acquired.push(element.url)
        return images.acquire(element.url)
      })), signal)
      const layers = ready.flatMap((element, i) => loaded[i] ? [{ element, image: loaded[i] }] : [])
      levels = [layers, ...levels]

      if (level > 0) {
        holes = holes.filter(hole => !layers.some(({ element }) => contains(extentBBox(element.extent), hole)))
        continue
      }
      const missing = candidates.filter(element => !layers.some(layer => layer.element === element))
      holes = missing.flatMap((element) => {
        const hole = intersectBBox(extentBBox(element.extent), bbox)
        return hole ? [hole] : []
      })
      const listRetry = list.refreshes < MAX_REFRESHES ? list.refreshAt : undefined
      const retries = missing
        .map(element => isPending(element) ? listRetry : images.retryAt(element.url))
        .filter((at): at is number => at !== undefined)
      retryAt = retries.length ? Math.min(...retries) : undefined
    }
    return { layers: levels.flat(), ...(retryAt === undefined ? {} : { retryAt }) }
  }

  return async ({ url }, { signal }) => {
    const { mediaUrl, tile, pixelRatio, clip: clipKey } = parseZztsUrl(url)
    const clip = clipKey ? getZztsClip(clipKey) : undefined
    const media = await medias(mediaUrl, signal, loadSignal => getJson<ZztsMedia>(mediaUrl, loadSignal))
    if (!tile) return { data: zztsTileJson(url, media, clip?.bbox) }

    // 裁剪键失效（图层正在卸载）或瓦片与裁剪区域不相交时不出图，宁缺勿露
    if (clipKey && (!clip || !intersectBBox(tileBBox(tile), clip.bbox))) return { data: EMPTY_TILE, cacheControl: `max-age=${COMPLETE_MAX_AGE}` }

    const acquired: string[] = []
    try {
      const { layers, retryAt } = await loadTile(mediaUrl, media, tile, pixelRatio, signal, acquired)
      signal.throwIfAborted()
      const data = layers.length ? compose(tile, layers, canvasSize(pixelRatio), clip) : EMPTY_TILE
      // 缺图待生成：经缓存过期让 MapLibre 到期重载视口内的瓦片，届时复查列表换上细图
      const maxAge = retryAt === undefined ? COMPLETE_MAX_AGE : Math.max(1, Math.ceil((retryAt - Date.now()) / 1000))
      return { data, cacheControl: `max-age=${maxAge}` }
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
