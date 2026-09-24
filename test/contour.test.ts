import { describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import MaplibreContourLayer from '../src/runtime/components/layers/ContourLayer.vue'
import { mountInMap } from './fixtures/mount-map'
import type { FakeStyleMap } from './fixtures/fake-style-map'

const { created, dem, addProtocol, removeProtocol } = vi.hoisted(() => ({
  created: [] as FakeStyleMap[],
  dem: {} as ReturnType<typeof import('./fixtures/fake-dem-source')['createFakeDemSource']>,
  addProtocol: vi.fn(),
  removeProtocol: vi.fn()
}))

vi.mock('maplibre-gl', async () => {
  const { fakeStyleMap } = await import('./fixtures/fake-style-map')
  function FakeGlMap() {
    const map = fakeStyleMap()
    created.push(map)
    return map
  }
  return { Map: FakeGlMap, LngLat: { convert: (v: unknown) => v }, addProtocol, removeProtocol }
})

vi.mock('maplibre-contour', async () => {
  const { createFakeDemSource } = await import('./fixtures/fake-dem-source')
  Object.assign(dem, createFakeDemSource())
  return { default: { DemSource: dem.DemSource } }
})

const DEM = 'https://example.com/dem/{z}/{x}/{y}.png'

describe('MaplibreContourLayer', () => {
  it('creates a DemSource and registers its protocols with maplibre', async () => {
    await mountInMap(created, () => h(MaplibreContourLayer, { layerId: 'contour', demUrl: DEM, encoding: 'mapbox', maxzoom: 13 }))
    const source = dem.instances.at(-1)!
    expect(source.options).toEqual({ url: DEM, encoding: 'mapbox', maxzoom: 13, worker: true })
    expect(source.setupCalls).toEqual([{ addProtocol }])
  })

  it('uses the contour protocol url as vector tiles and adds line and label layers', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreContourLayer, { layerId: 'contour', demUrl: DEM, thresholds: { 12: [100, 500] } }))
    const source = dem.instances.at(-1)!
    const spec = map.sources.get('contour') as { type: string, tiles: string[] }
    expect(spec.type).toBe('vector')
    expect(spec.tiles[0]).toBe(source.contourProtocolUrl({ thresholds: { 12: [100, 500] }, multiplier: 1, elevationKey: 'ele', levelKey: 'level', contourLayer: 'contours' }))
    expect(map.getLayer('contour-line')?.['source-layer']).toBe('contours')
    expect(map.getLayer('contour-label')?.type).toBe('symbol')
  })

  it('omits the label layer when labels is false', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreContourLayer, { layerId: 'contour', demUrl: DEM, labels: false }))
    expect(map.getLayer('contour-line')).toBeDefined()
    expect(map.getLayer('contour-label')).toBeUndefined()
  })

  it('updates tiles when thresholds or multiplier change', async () => {
    const multiplier = ref(1)
    const { map } = await mountInMap(created, () => h(MaplibreContourLayer, { layerId: 'contour', demUrl: DEM, multiplier: multiplier.value }))
    multiplier.value = 3.28084
    await nextTick()
    const call = map.sourceCalls.find(([id, method]) => id === 'contour' && method === 'setTiles')
    expect((call?.[2] as string[])[0]).toContain('"multiplier":3.28084')
  })

  it('removes both protocols on unmount', async () => {
    const show = ref(true)
    await mountInMap(created, () => (show.value ? h(MaplibreContourLayer, { layerId: 'contour', demUrl: DEM }) : null))
    const source = dem.instances.at(-1)!
    show.value = false
    await nextTick()
    expect(removeProtocol).toHaveBeenCalledWith(source.sharedDemProtocolId)
    expect(removeProtocol).toHaveBeenCalledWith(source.contourProtocolId)
  })
})
