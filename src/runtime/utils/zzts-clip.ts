import type { Geometry, Position } from 'geojson'
import { defineGlobalSingleton } from '@movk/core'
import type { MaskInput } from './mask'
import type { LngLatBBox } from './zzts-tile'

/** 裁剪区域：全部环（外环与孔洞，按 evenodd 规则填充）及其包围盒 */
export interface ZztsClip {
  rings: Position[][]
  bbox: LngLatBBox
}

// 组件与协议可能分属两份打包产物，经全局单例共享同一张表
const clips = defineGlobalSingleton('movk-maplibre:zzts-clips', () => new Map<string, ZztsClip>())

function polygonRings(geometry: Geometry | null): Position[][] {
  if (geometry?.type === 'Polygon') return geometry.coordinates
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

/** 收集面状几何的全部环；非面状要素被忽略 */
export function clipRings(input: MaskInput): Position[][] {
  const rings = input.type === 'FeatureCollection'
    ? input.features.flatMap(feature => polygonRings(feature.geometry))
    : polygonRings(input.type === 'Feature' ? input.geometry : input)
  return rings.filter(ring => ring.length >= 3)
}

function ringsBBox(rings: Position[][]): LngLatBBox {
  const points = rings.flat()
  const lngs = points.map(([lng = 0]) => lng)
  const lats = points.map(([, lat = 0]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

/** 登记裁剪区域；无面状要素时登记为空区域，图层整体不可见 */
export function setZztsClip(key: string, input: MaskInput): void {
  const rings = clipRings(input)
  clips.set(key, { rings, bbox: rings.length ? ringsBBox(rings) : [0, 0, 0, 0] })
}

export function getZztsClip(key: string): ZztsClip | undefined {
  return clips.get(key)
}

export function deleteZztsClip(key: string): void {
  clips.delete(key)
}
