import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson'

/** 遮罩输入：面状几何、要素或要素集合；非面状要素被忽略 */
export type MaskInput = Polygon | MultiPolygon | Feature | FeatureCollection

// Web 墨卡托纬度极限，超出部分不可见
const MAX_LAT = 85.0511

// 逆时针的全球范围外环（RFC 7946：外环逆时针）
const WORLD_RING: Position[] = [[-180, -MAX_LAT], [180, -MAX_LAT], [180, MAX_LAT], [-180, MAX_LAT], [-180, -MAX_LAT]]

function signedArea(ring: Position[]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1 = 0, y1 = 0] = ring[i]!
    const [x2 = 0, y2 = 0] = ring[i + 1]!
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

// 孔洞须顺时针
function toClockwise(ring: Position[]): Position[] {
  return signedArea(ring) > 0 ? [...ring].reverse() : ring
}

function outerRings(geometry: Geometry | null): Position[][] {
  if (geometry?.type === 'Polygon') return geometry.coordinates.slice(0, 1)
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.map(polygon => polygon[0]!).filter(Boolean)
  return []
}

function collectRings(data: MaskInput): Position[][] {
  if (data.type === 'FeatureCollection') return data.features.flatMap(feature => outerRings(feature.geometry))
  if (data.type === 'Feature') return outerRings(data.geometry)
  return outerRings(data)
}

/**
 * 生成反向遮罩：以全球范围为外环，把目标区域各多边形的外环作为孔洞。
 * 目标自身的孔洞（飞地）不参与；无面状要素时返回空集合。
 */
export function maskPolygon(data: MaskInput): Feature<Polygon> | FeatureCollection {
  const holes = collectRings(data).filter(ring => ring.length >= 4).map(toClockwise)
  if (!holes.length) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] }
  }
}
