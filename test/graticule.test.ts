import { describe, expect, it } from 'vitest'
import type { LineString, Point } from 'geojson'
import { formatDegree, graticuleLabels, graticuleLines, graticuleStep, type Bounds } from '../src/runtime/utils/graticule'

const china: Bounds = [100, 20, 125, 45]

describe('graticuleStep', () => {
  it('picks coarser steps at low zoom and finer steps at high zoom', () => {
    expect(graticuleStep(0)).toBe(30)
    expect(graticuleStep(2)).toBe(10)
    expect(graticuleStep(4)).toBe(5)
    expect(graticuleStep(6)).toBe(1)
    expect(graticuleStep(9)).toBe(0.1)
    expect(graticuleStep(16)).toBe(0.1)
  })
})

describe('graticuleLines', () => {
  it('expands the bounds by one step and snaps to step multiples', () => {
    const { extent } = graticuleLines(china, 10)
    expect(extent).toEqual([90, 10, 140, 60])
  })

  it('clamps latitude and uses the full longitude range across the antimeridian', () => {
    expect(graticuleLines([-200, -89, 200, 89], 30).extent).toEqual([-180, -85, 180, 85])
    expect(graticuleLines([170, 0, 190, 10], 5).extent).toEqual([-180, -5, 180, 15])
  })

  it('generates meridians and parallels inside the extent', () => {
    const { data } = graticuleLines(china, 10)
    const values = (axis: string) => data.features.filter(f => f.properties?.axis === axis).map(f => f.properties?.value)
    expect(values('lon')).toEqual([90, 100, 110, 120, 130, 140])
    expect(values('lat')).toEqual([10, 20, 30, 40, 50, 60])
  })

  it('densifies lines so they curve on the globe', () => {
    const { data } = graticuleLines(china, 10)
    const parallel = data.features.find(f => f.properties?.axis === 'lat')!.geometry as LineString
    expect(parallel.coordinates).toHaveLength(51)
    expect(parallel.coordinates[1]).toEqual([91, 10])
  })

  it('avoids floating point drift for fractional steps', () => {
    const { data } = graticuleLines([0.05, 0.05, 0.25, 0.25], 0.1)
    const values = data.features.filter(f => f.properties?.axis === 'lon').map(f => f.properties?.value)
    expect(values).toEqual([-0.1, 0, 0.1, 0.2, 0.3, 0.4])
  })
})

describe('graticuleLabels', () => {
  it('places meridian labels on the south edge and parallel labels on the west edge', () => {
    const { features } = graticuleLabels(china, 10)
    const lon = features.filter(f => f.properties?.axis === 'lon')
    const lat = features.filter(f => f.properties?.axis === 'lat')
    expect(lon.map(f => f.properties?.label)).toEqual(['100°E', '110°E', '120°E'])
    expect((lon[0]!.geometry as Point).coordinates).toEqual([100, 20])
    expect(lat.map(f => f.properties?.label)).toEqual(['20°N', '30°N', '40°N'])
    expect((lat[0]!.geometry as Point).coordinates).toEqual([100, 20])
  })

  it('places labels along a custom anchor such as the map center', () => {
    const { features } = graticuleLabels([-180, -85, 180, 85], 30, [105, 30])
    const lon = features.find(f => f.properties?.axis === 'lon')!
    const lat = features.find(f => f.properties?.axis === 'lat')!
    expect((lon.geometry as Point).coordinates).toEqual([-180, 30])
    expect((lat.geometry as Point).coordinates).toEqual([105, -60])
  })
})

describe('formatDegree', () => {
  it('formats hemispheres, zero and the antimeridian', () => {
    expect(formatDegree(0, 'lat')).toBe('0°')
    expect(formatDegree(-30, 'lat')).toBe('30°S')
    expect(formatDegree(-120, 'lon')).toBe('120°W')
    expect(formatDegree(180, 'lon')).toBe('180°')
    expect(formatDegree(190, 'lon')).toBe('170°W')
    expect(formatDegree(0.25, 'lon')).toBe('0.25°E')
  })
})

describe('graticuleLines world view', () => {
  it('keeps the world extent within the valid range', () => {
    expect(graticuleLines([-180, -85, 180, 85], 30).extent).toEqual([-180, -85, 180, 85])
  })
})
