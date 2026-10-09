import { describe, expect, it } from 'vitest'
import type { FeatureCollection, Polygon } from 'geojson'
import { clipRings, deleteZztsClip, getZztsClip, setZztsClip } from '../src/runtime/utils/zzts-clip'

const square = (w: number, s: number, e: number, n: number) => [[w, s], [e, s], [e, n], [w, n], [w, s]]

describe('clipRings', () => {
  it('keeps holes so enclaves are cut out', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)] }
    expect(clipRings(polygon)).toHaveLength(2)
  })

  it('collects polygons from collections and skips other geometries', () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 1, 1)], [square(2, 2, 3, 3)]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }
      ]
    }
    expect(clipRings(collection)).toHaveLength(2)
  })
})

describe('zzts clip registry', () => {
  it('stores rings with their bounding box', () => {
    setZztsClip('k', { type: 'Polygon', coordinates: [square(121, 29, 122, 30)] })
    expect(getZztsClip('k')?.bbox).toEqual([121, 29, 122, 30])
    deleteZztsClip('k')
    expect(getZztsClip('k')).toBeUndefined()
  })

  it('registers an empty area when nothing is clippable', () => {
    setZztsClip('e', { type: 'FeatureCollection', features: [] })
    expect(getZztsClip('e')).toEqual({ rings: [], bbox: [0, 0, 0, 0] })
    deleteZztsClip('e')
  })
})
