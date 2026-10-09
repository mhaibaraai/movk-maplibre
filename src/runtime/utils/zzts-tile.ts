// ZZTS 二维动态切片服务与 Web 墨卡托瓦片之间的换算：元数据转 TileJSON、瓦片转元素请求、元素图片到瓦片画布的绘制规划。

/** 经纬度包围盒 [west, south, east, north] */
export type LngLatBBox = [number, number, number, number]

export interface ZztsExtent {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

/** elements 接口返回的单个元素：一张按 extent 贴图的 GeoSOT 网格图片 */
export interface ZztsElement {
  id: string
  type: string
  url: string
  extent: ZztsExtent
  /** 图片生成状态，0 表示尚未生成（请求返回 404） */
  png_status?: number
}

/** media 接口返回的图层元数据（WGS84） */
export interface ZztsMedia {
  name: string
  extent: ZztsExtent
  minZoom: number
  maxZoom: number
  /** 原始影像分辨率（米） */
  resolution: number
}

export interface TileCoord {
  z: number
  x: number
  y: number
}

/** 源矩形为元素图片的比例坐标 [x, y, w, h]（0-1），目标矩形为瓦片像素坐标 */
export interface ZztsDraw {
  source: [number, number, number, number]
  target: [number, number, number, number]
}

export const ZZTS_TILE_SIZE = 512

const PROTOCOL_PREFIX = 'zzts://'
const TILE_HASH = /#(\d+)\/(\d+)\/(\d+)$/
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137
/** 服务端按 96dpi 屏幕换算比例尺分母 */
const METERS_PER_PIXEL_TO_SCALE = 96 / 0.0254
/** 服务端拒绝经度跨度超过 20° 的 bbox */
const MAX_BBOX_SPAN = 20
/** 该级别起单个瓦片内经纬度与墨卡托的纬向误差小于 1px，无需分条带绘制 */
const LINEAR_ZOOM = 8
const STRIP_HEIGHT = 32

export function parseZztsUrl(url: string): { mediaUrl: string, tile?: TileCoord } {
  const raw = url.startsWith(PROTOCOL_PREFIX) ? url.slice(PROTOCOL_PREFIX.length) : url
  const match = raw.match(TILE_HASH)
  if (!match) return { mediaUrl: raw }
  return {
    mediaUrl: raw.slice(0, match.index),
    tile: { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) }
  }
}

const lngAt = (x: number, z: number) => x / 2 ** z * 360 - 180
/** 目标矩形向外取整到整像素，避免小数边缘抗锯齿后半透明而露出底图接缝 */
function snapOut(x: number, y: number, w: number, h: number): ZztsDraw['target'] {
  const left = Math.floor(x)
  const top = Math.floor(y)
  return [left, top, Math.ceil(x + w) - left, Math.ceil(y + h) - top]
}

const latAt = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI
/** 纬度对应的墨卡托瓦片行坐标（可为小数） */
const rowAt = (lat: number, z: number) => (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z

export function tileBBox({ z, x, y }: TileCoord): LngLatBBox {
  return [lngAt(x, z), latAt(y + 1, z), lngAt(x + 1, z), latAt(y, z)]
}

/** 瓦片在给定纬度处的比例尺分母，与公司 Cesium 组件的取值口径一致，保证服务端选出相同的网格级别 */
export function tileScale(z: number, lat: number): number {
  const metersPerPixel = EARTH_CIRCUMFERENCE * Math.cos(lat * Math.PI / 180) / (ZZTS_TILE_SIZE * 2 ** z)
  return metersPerPixel * METERS_PER_PIXEL_TO_SCALE
}

export function zztsTileJson(url: string, media: ZztsMedia) {
  const { xmin, ymin, xmax, ymax } = media.extent
  const centerLat = (ymin + ymax) / 2
  const minzoom = Math.ceil(Math.log2(360 / MAX_BBOX_SPAN))
  // 取能显示出原始分辨率的最小级别，更高级别由 MapLibre 超采样
  const nativeZoom = Math.ceil(Math.log2(EARTH_CIRCUMFERENCE * Math.cos(centerLat * Math.PI / 180) / (ZZTS_TILE_SIZE * media.resolution)))
  return {
    tiles: [`${url}#{z}/{x}/{y}`],
    bounds: [xmin, ymin, xmax, ymax] as LngLatBBox,
    minzoom,
    maxzoom: Math.max(minzoom, nativeZoom),
    tileSize: ZZTS_TILE_SIZE,
    name: media.name
  }
}

/** `coarser` 为相对瓦片默认级别向上取粗的级数，每级比例尺翻倍，服务端随之降一级 GeoSOT 网格 */
export function elementsUrl(mediaUrl: string, tile: TileCoord, coarser = 0): string {
  const [west, south, east, north] = tileBBox(tile)
  const url = new URL(mediaUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/elements`
  url.searchParams.set('width', String(ZZTS_TILE_SIZE))
  url.searchParams.set('height', String(ZZTS_TILE_SIZE))
  url.searchParams.set('scale', String(tileScale(tile.z, (south + north) / 2) * 2 ** coarser))
  url.searchParams.set('bbox', [west, south, east, north].join(','))
  return url.toString()
}

/** 规划元素图片在瓦片上的绘制：经向线性；纬向在低级别按等高条带分段，逐段换算墨卡托以消除拉伸误差 */
export function planDraws(extent: ZztsExtent, tile: TileCoord): ZztsDraw[] {
  const [west, south, east, north] = tileBBox(tile)
  const left = Math.max(extent.xmin, west)
  const right = Math.min(extent.xmax, east)
  const bottom = Math.max(extent.ymin, south)
  const top = Math.min(extent.ymax, north)
  if (left >= right || bottom >= top) return []

  const { z, x, y } = tile
  const width = extent.xmax - extent.xmin
  const height = extent.ymax - extent.ymin
  const sx = (left - extent.xmin) / width
  const sw = (right - left) / width
  const dx = ((left + 180) / 360 * 2 ** z - x) * ZZTS_TILE_SIZE
  const dw = (right - left) / 360 * 2 ** z * ZZTS_TILE_SIZE

  const dyTop = (rowAt(top, z) - y) * ZZTS_TILE_SIZE
  const dyBottom = (rowAt(bottom, z) - y) * ZZTS_TILE_SIZE
  const strips = z >= LINEAR_ZOOM ? 1 : Math.max(1, Math.ceil((dyBottom - dyTop) / STRIP_HEIGHT))
  const stripHeight = (dyBottom - dyTop) / strips
  const latAtPixel = (py: number) => latAt(y + py / ZZTS_TILE_SIZE, z)

  return Array.from({ length: strips }, (_, i) => {
    const dy = dyTop + i * stripHeight
    const latTop = i === 0 ? top : latAtPixel(dy)
    const latBottom = i === strips - 1 ? bottom : latAtPixel(dy + stripHeight)
    return {
      source: [sx, (extent.ymax - latTop) / height, sw, (latTop - latBottom) / height],
      target: snapOut(dx, dy, dw, stripHeight)
    }
  })
}
