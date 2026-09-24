import { describe, expect, it } from 'vitest'
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { maskPolygon } from '../src/runtime/utils/mask'

// 有符号面积：正值为逆时针
function signedArea(ring: Position[]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!
  }
  return sum / 2
}

const square = (x: number, y: number, size = 1): Position[] =>
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]
const clockwise = (ring: Position[]) => [...ring].reverse()

const polygon: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 10), clockwise(square(2, 2, 2))] }
const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [[square(0, 0)], [clockwise(square(5, 5))]] }

function rings(result: ReturnType<typeof maskPolygon>): Position[][] {
  expect(result.type).toBe('Feature')
  return (result as Feature<Polygon>).geometry.coordinates
}

describe('maskPolygon', () => {
  it('uses the world extent as a counterclockwise outer ring', () => {
    const [outer] = rings(maskPolygon(polygon))
    expect(signedArea(outer!)).toBeGreaterThan(0)
    expect(outer!.map(p => p[0])).toContain(-180)
    expect(outer!.map(p => p[0])).toContain(180)
  })

  it('turns each outer ring into a clockwise hole and ignores the target holes', () => {
    const [, ...holes] = rings(maskPolygon(polygon))
    expect(holes).toHaveLength(1)
    expect(signedArea(holes[0]!)).toBeLessThan(0)
  })

  it('handles MultiPolygon regardless of input ring direction', () => {
    const [, ...holes] = rings(maskPolygon(multi))
    expect(holes).toHaveLength(2)
    for (const hole of holes) expect(signedArea(hole)).toBeLessThan(0)
  })

  it('collects polygons from Feature and FeatureCollection, skipping other geometries', () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: polygon },
        { type: 'Feature', properties: {}, geometry: multi },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }
      ]
    }
    expect(rings(maskPolygon(collection))).toHaveLength(4)
    expect(rings(maskPolygon({ type: 'Feature', properties: {}, geometry: polygon }))).toHaveLength(2)
  })

  it('returns an empty collection when there is no polygon', () => {
    const empty = { type: 'FeatureCollection', features: [] }
    expect(maskPolygon(empty as FeatureCollection)).toEqual(empty)
    expect(maskPolygon({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } })).toEqual(empty)
  })

  it('does not mutate the input rings', () => {
    const input: Polygon = { type: 'Polygon', coordinates: [square(0, 0)] }
    const snapshot = structuredClone(input)
    maskPolygon(input)
    expect(input).toEqual(snapshot)
  })
})
