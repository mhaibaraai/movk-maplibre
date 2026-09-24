import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson'

/** 经纬度范围 [west, south, east, north] */
export type Bounds = [number, number, number, number]

type Axis = 'lon' | 'lat'

/** 候选步长（度），由粗到细 */
const STEPS = [30, 10, 5, 2, 1, 0.5, 0.25, 0.1]

// 视口宽度内至少保持的线条数
const MIN_LINES = 4

const MAX_LAT = 85

// 加密间隔上限（度），保证球形投影下线条呈曲线
const DENSIFY = 1

const round = (value: number): number => Math.round(value * 1e6) / 1e6

// 容忍浮点误差的取整：接近整数时直接取整
function snap(value: number, fn: (v: number) => number): number {
  const nearest = Math.round(value)
  return Math.abs(value - nearest) < 1e-9 ? nearest : fn(value)
}

/** 按缩放级别选择步长，使 512px 视口宽度内约有 4 条以上经线 */
export function graticuleStep(zoom: number): number {
  const span = 360 / 2 ** zoom
  return STEPS.find(step => span / step >= MIN_LINES) ?? STEPS.at(-1)!
}

/** 度数标注，如 `30°N`、`120°E`、`0°`；经度归一化到 (-180, 180] */
export function formatDegree(value: number, axis: Axis): string {
  const normalized = axis === 'lon' ? value - 360 * Math.ceil((value - 180) / 360) : value
  const abs = round(Math.abs(normalized))
  if (abs === 0 || (axis === 'lon' && abs === 180)) return `${abs}°`
  const hemisphere = axis === 'lon' ? (normalized > 0 ? 'E' : 'W') : (normalized > 0 ? 'N' : 'S')
  return `${abs}°${hemisphere}`
}

// [from, to] 区间内 step 整数倍的取值
function multiples(from: number, to: number, step: number): number[] {
  const first = snap(from / step, Math.ceil)
  const last = snap(to / step, Math.floor)
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => round((first + i) * step))
}

function densify(from: number, to: number, interval: number): number[] {
  const count = Math.max(1, Math.ceil(round((to - from) / interval)))
  return Array.from({ length: count + 1 }, (_, i) => round(Math.min(to, from + i * interval)))
}

/** 视口外扩一个步长并对齐到步长整数倍；限制在 ±180° / ±85° 内，跨越反经线时经度取全范围 */
function expand([west, south, east, north]: Bounds, step: number): Bounds {
  const fullLon = west < -180 || east > 180
  return [
    fullLon ? -180 : Math.max(-180, round((snap(west / step, Math.floor) - 1) * step)),
    Math.max(-MAX_LAT, round((snap(south / step, Math.floor) - 1) * step)),
    fullLon ? 180 : Math.min(180, round((snap(east / step, Math.ceil) + 1) * step)),
    Math.min(MAX_LAT, round((snap(north / step, Math.ceil) + 1) * step))
  ]
}

function line(coordinates: Position[], axis: Axis, value: number): Feature<LineString> {
  return { type: 'Feature', properties: { axis, value }, geometry: { type: 'LineString', coordinates } }
}

/** 生成外扩范围内的经线与纬线（均已加密），并返回该范围供判断是否需要重算 */
export function graticuleLines(bounds: Bounds, step: number): { extent: Bounds, data: FeatureCollection<LineString> } {
  const extent = expand(bounds, step)
  const [west, south, east, north] = extent
  const interval = Math.min(step, DENSIFY)
  const lats = densify(south, north, interval)
  const lons = densify(west, east, interval)
  // 全经度范围时 -180 与 180 重合，只保留一条
  const meridianValues = multiples(west, east, step).filter(lon => !(east - west >= 360 && lon === 180))
  const meridians = meridianValues.map(lon => line(lats.map(lat => [lon, lat]), 'lon', lon))
  const parallels = multiples(south, north, step).map(lat => line(lons.map(lon => [lon, lat]), 'lat', lat))
  return { extent, data: { type: 'FeatureCollection', features: [...meridians, ...parallels] } }
}

function label(coordinates: Position, axis: Axis, value: number): Feature<Point> {
  return { type: 'Feature', properties: { axis, label: formatDegree(value, axis) }, geometry: { type: 'Point', coordinates } }
}

/**
 * 生成视口内的度数标注：经线标注位于 anchor 纬度，纬线标注位于 anchor 经度；
 * anchor 缺省为视口西南角（沿南、西边缘排布），世界视图可传地图中心
 */
export function graticuleLabels([west, south, east, north]: Bounds, step: number, anchor: Position = [west, south]): FeatureCollection<Point> {
  const [anchorLon = west, anchorLat = south] = anchor
  // 全经度范围时 -180 与 180 重合，只保留一个标注
  const lonValues = multiples(west, east, step).filter(lon => !(east - west >= 360 && lon === 180))
  const lon = lonValues.map(value => label([value, anchorLat], 'lon', value))
  const lat = multiples(Math.max(south, -MAX_LAT), Math.min(north, MAX_LAT), step).map(value => label([anchorLon, value], 'lat', value))
  return { type: 'FeatureCollection', features: [...lon, ...lat] }
}
