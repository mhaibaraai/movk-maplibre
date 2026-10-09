import { addProtocol } from 'maplibre-gl'
import type { AddProtocolAction } from 'maplibre-gl'
import { defineGlobalSingleton } from '@movk/core'
import type { TileCoord, ZztsElement, ZztsMedia } from './zzts-tile'
import { ZZTS_TILE_SIZE, elementsUrl, parseZztsUrl, planDraws, zztsTileJson } from './zzts-tile'

export interface ZztsProtocolOptions {
  /** 自定义请求，元数据、元素列表与元素图片共用；用于附加鉴权头或改走代理 */
  fetch?: typeof globalThis.fetch
  /**
   * 元素图片缓存数量；相邻瓦片常共用同一网格图片，命中时不再重复下载
   * @defaultValue 256
   */
  cacheSize?: number
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

async function getJson<T>(request: typeof globalThis.fetch, url: string, signal: AbortSignal): Promise<T> {
  const res = await request(url, { signal })
  if (!res.ok) throw new Error(`ZZTS 请求失败：HTTP ${res.status}`)
  return await res.json() as T
}

/** 去掉非图片元素与重复元素 */
function imageElements(payload: { elements?: ZztsElement[] } & ZztsErrorPayload): ZztsElement[] {
  if (!Array.isArray(payload.elements)) throw new Error(payload.msg || 'ZZTS 元素请求失败')
  return payload.elements.filter((element, i, list) =>
    element.type === 'image' && list.findIndex(item => item.id === element.id) === i
  )
}

/** 图片 LRU 缓存；404 表示服务端未生成该网格图，缓存为 undefined 不再重复请求，其余失败不缓存 */
function createImageCache(request: typeof globalThis.fetch, size: number) {
  const cache = new Map<string, Promise<ImageBitmap | undefined>>()

  return (url: string): Promise<ImageBitmap | undefined> => {
    const hit = cache.get(url)
    if (hit) {
      cache.delete(url)
      cache.set(url, hit)
      return hit
    }
    // 不绑定单个瓦片的 signal：图片由多个瓦片共享，某个瓦片取消不应中断其他瓦片
    const pending = request(url)
      .then(async (res) => {
        if (res.status === 404) return undefined
        if (!res.ok) throw new Error(`ZZTS 图片加载失败：HTTP ${res.status}`)
        return createImageBitmap(await res.blob())
      })
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
    if (cache.size > size) cache.delete(cache.keys().next().value!)
    return pending
  }
}

function compose(tile: TileCoord, items: ZztsLayerImage[]): ImageBitmap {
  const canvas = new OffscreenCanvas(ZZTS_TILE_SIZE, ZZTS_TILE_SIZE)
  const context = canvas.getContext('2d')!
  for (const { element, image } of items) {
    for (const { source: [sx, sy, sw, sh], target: [dx, dy, dw, dh] } of planDraws(element.extent, tile)) {
      context.drawImage(image, sx * image.width, sy * image.height, sw * image.width, sh * image.height, dx, dy, dw, dh)
    }
  }
  return canvas.transferToImageBitmap()
}

function createZztsProtocol({ fetch: request = globalThis.fetch.bind(globalThis), cacheSize = 256 }: ZztsProtocolOptions = {}): AddProtocolAction {
  const loadImage = createImageCache(request, cacheSize)

  /** 加载瓦片在某一级的图片；存在加载失败（如 404 未生成）的元素时，取更粗一级垫在下方补洞 */
  async function loadLevel(mediaUrl: string, tile: TileCoord, coarser: number, signal: AbortSignal): Promise<ZztsLayerImage[]> {
    const elements = imageElements(await getJson(request, elementsUrl(mediaUrl, tile, coarser), signal))
    const images = await Promise.all(elements.map(element => loadImage(element.url).catch(() => undefined)))
    const layers = elements.flatMap((element, i) => images[i] ? [{ element, image: images[i] }] : [])
    if (layers.length === elements.length || coarser >= MAX_FALLBACK_LEVELS) return layers
    return [...await loadLevel(mediaUrl, tile, coarser + 1, signal), ...layers]
  }

  return async ({ url }, { signal }) => {
    const { mediaUrl, tile } = parseZztsUrl(url)
    if (!tile) {
      const media = await getJson<ZztsMedia>(request, mediaUrl, signal)
      return { data: zztsTileJson(url, media) }
    }

    const layers = await loadLevel(mediaUrl, tile, 0, signal)
    signal.throwIfAborted()
    return { data: layers.length ? compose(tile, layers) : EMPTY_TILE }
  }
}

/**
 * 注册 `zzts://` 协议（全局单例、幂等）：把 ZZTS 二维动态切片服务适配为 512 墨卡托栅格瓦片。
 * `MaplibreRasterLayer` 的 `url` 写成 `zzts://` + media 接口地址即可。
 */
export function registerZztsProtocol(options?: ZztsProtocolOptions): void {
  defineGlobalSingleton('movk-maplibre:protocol:zzts', () => {
    addProtocol('zzts', createZztsProtocol(options))
    return true
  })
}
