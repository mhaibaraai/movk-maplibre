// ZZTS 二维动态切片服务与 Web 墨卡托瓦片之间的换算：协议地址、请求规划（合并、裁剪、分段）、元数据转 TileJSON、绘制规划。
import type { Position } from 'geojson'

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

/** 同一级别的连续瓦片区间，x1 / y1 不含 */
export interface TileRange {
  z: number
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 图层级参数，经协议地址的 hash 传递，不发往服务端 */
export interface ZztsLayerParams {
  /** 拼合画布相对 512 的倍率，用于高分屏 */
  pixelRatio?: number
  /** 裁剪表中的裁剪区域键 */
  clip?: string
}

export interface ZztsRequest {
  mediaUrl: string
  pixelRatio: number
  clip?: string
  tile?: TileCoord
}

/** 一次 elements 请求的参数 */
export interface ZztsQuery {
  bbox: LngLatBBox
  width: number
  height: number
  scale: number
}

/** 源矩形为元素图片的比例坐标 [x, y, w, h]（0-1），目标矩形为画布像素坐标 */
export interface ZztsDraw {
  source: [number, number, number, number]
  target: [number, number, number, number]
}

export const ZZTS_TILE_SIZE = 512

const SCHEME_SEPARATOR = '://'
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137
const MAX_LAT = 85.0511287798
/** 服务端按 96dpi 屏幕换算比例尺分母 */
const METERS_PER_PIXEL_TO_SCALE = 96 / 0.0254
/** 服务端拒绝经度跨度超过 20° 的 bbox */
const MAX_BBOX_SPAN = 20
/** 已验证可用的最粗请求级别（单瓦片跨度不超过 20°）；更低级别沿用其比例尺，由画布缩小绘制 */
const MIN_REQUEST_ZOOM = Math.ceil(Math.log2(360 / MAX_BBOX_SPAN))
const MAX_PIXEL_RATIO = 4
/** 该级别起单个瓦片内经纬度与墨卡托的纬向误差小于 1px，无需分条带绘制 */
const LINEAR_ZOOM = 8
const STRIP_HEIGHT = 32

const clampLat = (lat: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
const lngAt = (x: number, z: number) => x / 2 ** z * 360 - 180
const latAt = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI
/** 经度对应的墨卡托瓦片列坐标（可为小数） */
const colAt = (lng: number, z: number) => (lng + 180) / 360 * 2 ** z
/** 纬度对应的墨卡托瓦片行坐标（可为小数） */
const rowAt = (lat: number, z: number) => (1 - Math.asinh(Math.tan(clampLat(lat) * Math.PI / 180)) / Math.PI) / 2 * 2 ** z

/** 解析 `<scheme>://<media 地址>#<图层参数>&tile=z/x/y`；scheme 任意，以首个 `://` 为界 */
export function parseZztsUrl(url: string): ZztsRequest {
  const raw = url.slice(url.indexOf(SCHEME_SEPARATOR) + SCHEME_SEPARATOR.length)
  const hashIndex = raw.indexOf('#')
  const mediaUrl = hashIndex < 0 ? raw : raw.slice(0, hashIndex)
  const params = new URLSearchParams(hashIndex < 0 ? '' : raw.slice(hashIndex + 1))
  const ratio = Number(params.get('pixelRatio'))
  const [z, x, y] = (params.get('tile') ?? '').split('/').map(Number)
  const clip = params.get('clip')
  return {
    mediaUrl,
    pixelRatio: Number.isFinite(ratio) ? Math.min(MAX_PIXEL_RATIO, Math.max(1, ratio)) : 1,
    ...(clip ? { clip } : {}),
    ...([z, x, y].every(Number.isInteger) ? { tile: { z: z!, x: x!, y: y! } } : {})
  }
}

/** 拼出 source 的协议地址，缺省参数不写入 hash */
export function zztsSourceUrl(scheme: string, mediaUrl: string, { pixelRatio, clip }: ZztsLayerParams = {}): string {
  const params = new URLSearchParams()
  if (pixelRatio && pixelRatio !== 1) params.set('pixelRatio', String(pixelRatio))
  if (clip) params.set('clip', clip)
  const hash = params.toString()
  return `${scheme}${SCHEME_SEPARATOR}${mediaUrl}${hash ? `#${hash}` : ''}`
}

export function canvasSize(pixelRatio: number): number {
  return Math.round(ZZTS_TILE_SIZE * pixelRatio)
}

export function tileRange({ z, x, y }: TileCoord): TileRange {
  return { z, x0: x, y0: y, x1: x + 1, y1: y + 1 }
}

export function rangeBBox({ z, x0, y0, x1, y1 }: TileRange): LngLatBBox {
  return [lngAt(x0, z), latAt(y1, z), lngAt(x1, z), latAt(y0, z)]
}

export function tileBBox(tile: TileCoord): LngLatBBox {
  return rangeBBox(tileRange(tile))
}

export function extentBBox({ xmin, ymin, xmax, ymax }: ZztsExtent): LngLatBBox {
  return [xmin, ymin, xmax, ymax]
}

export function intersectBBox(a: Readonly<LngLatBBox>, b: Readonly<LngLatBBox>): LngLatBBox | undefined {
  const west = Math.max(a[0], b[0])
  const south = Math.max(a[1], b[1])
  const east = Math.min(a[2], b[2])
  const north = Math.min(a[3], b[3])
  return west < east && south < north ? [west, south, east, north] : undefined
}

/**
 * 瓦片所在的合并请求区间：k×k 个相邻瓦片共用一次 elements 请求。
 * k 取不超过 size 的 2 的幂，并保证区间经度跨度不超过服务端上限，以便各级别分组对齐。
 */
export function metatileRange(tile: TileCoord, size: number): TileRange {
  const span = 360 / 2 ** tile.z
  const limit = Math.min(size, MAX_BBOX_SPAN / span, 2 ** tile.z)
  const k = limit >= 1 ? 2 ** Math.floor(Math.log2(limit)) : 1
  const x0 = Math.floor(tile.x / k) * k
  const y0 = Math.floor(tile.y / k) * k
  return { z: tile.z, x0, y0, x1: x0 + k, y1: y0 + k }
}

/** 瓦片在给定纬度处的比例尺分母，与公司 Cesium 组件的取值口径一致，保证服务端选出相同的网格级别 */
export function tileScale(z: number, lat: number): number {
  const metersPerPixel = EARTH_CIRCUMFERENCE * Math.cos(lat * Math.PI / 180) / (ZZTS_TILE_SIZE * 2 ** z)
  return metersPerPixel * METERS_PER_PIXEL_TO_SCALE
}

/**
 * 规划区间的 elements 请求：bbox 裁到图层范围，经度跨度超限时等分成多段；
 * 画布尺寸按裁剪后的像素范围等比缩小。`coarser` 为向上取粗的级数，每级比例尺翻倍，服务端随之降一级网格。
 */
export function planQueries(range: TileRange, extent: Readonly<LngLatBBox>, pixelRatio: number, coarser = 0): ZztsQuery[] {
  const clipped = intersectBBox(rangeBBox(range), extent)
  if (!clipped) return []

  const [west, south, east, north] = clipped
  const z = Math.max(range.z, MIN_REQUEST_ZOOM)
  const density = ZZTS_TILE_SIZE * pixelRatio
  const scale = tileScale(z, (south + north) / 2) / pixelRatio * 2 ** coarser
  const height = Math.max(1, Math.round((rowAt(south, z) - rowAt(north, z)) * density))
  const parts = Math.ceil((east - west) / MAX_BBOX_SPAN)
  const step = (east - west) / parts

  return Array.from({ length: parts }, (_, i) => {
    const left = west + step * i
    const right = i === parts - 1 ? east : left + step
    const width = Math.max(1, Math.round((colAt(right, z) - colAt(left, z)) * density))
    return { bbox: [left, south, right, north], width, height, scale }
  })
}

export function zztsTileJson(url: string, media: ZztsMedia, clip?: Readonly<LngLatBBox>) {
  const { pixelRatio } = parseZztsUrl(url)
  const extent = extentBBox(media.extent)
  const centerLat = (extent[1] + extent[3]) / 2
  // 取能显示出原始分辨率的最小级别，更高级别由 MapLibre 超采样
  const nativeZoom = Math.ceil(Math.log2(EARTH_CIRCUMFERENCE * Math.cos(centerLat * Math.PI / 180) / (canvasSize(pixelRatio) * media.resolution)))
  const [base, hash] = url.split('#')
  return {
    tiles: [`${base}#${hash ? `${hash}&` : ''}tile={z}/{x}/{y}`],
    bounds: (clip && intersectBBox(extent, clip)) || extent,
    minzoom: 0,
    maxzoom: Math.max(0, nativeZoom),
    tileSize: ZZTS_TILE_SIZE,
    name: media.name
  }
}

export function elementsUrl(mediaUrl: string, { bbox, width, height, scale }: ZztsQuery): string {
  const url = new URL(mediaUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/elements`
  url.searchParams.set('width', String(width))
  url.searchParams.set('height', String(height))
  url.searchParams.set('scale', String(scale))
  url.searchParams.set('bbox', bbox.join(','))
  return url.toString()
}

/** 目标矩形向外取整到整像素，避免小数边缘抗锯齿后半透明而露出底图接缝 */
function snapOut(x: number, y: number, w: number, h: number): ZztsDraw['target'] {
  const left = Math.floor(x)
  const top = Math.floor(y)
  return [left, top, Math.ceil(x + w) - left, Math.ceil(y + h) - top]
}

/** 规划元素图片在画布上的绘制：经向线性；纬向在低级别按等高条带分段，逐段换算墨卡托以消除拉伸误差 */
export function planDraws(extent: ZztsExtent, tile: TileCoord, size = ZZTS_TILE_SIZE): ZztsDraw[] {
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
  const dx = (colAt(left, z) - x) * size
  const dw = (right - left) / 360 * 2 ** z * size

  const dyTop = (rowAt(top, z) - y) * size
  const dyBottom = (rowAt(bottom, z) - y) * size
  const strips = z >= LINEAR_ZOOM ? 1 : Math.max(1, Math.ceil((dyBottom - dyTop) / STRIP_HEIGHT))
  const stripHeight = (dyBottom - dyTop) / strips
  const latAtPixel = (py: number) => latAt(y + py / size, z)

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

/** 把经纬度环投影为画布像素坐标，供裁剪路径使用 */
export function projectRings(rings: Position[][], { z, x, y }: TileCoord, size: number): [number, number][][] {
  return rings.map(ring => ring.map(([lng = 0, lat = 0]) => [(colAt(lng, z) - x) * size, (rowAt(lat, z) - y) * size]))
}
