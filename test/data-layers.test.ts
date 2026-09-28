import { describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import type { FeatureCollection, Polygon } from 'geojson'
import MaplibreLayerGroup from '../src/runtime/components/LayerGroup.vue'
import MaplibreMaskLayer from '../src/runtime/components/layers/MaskLayer.vue'
import MaplibreGraticuleLayer from '../src/runtime/components/layers/GraticuleLayer.vue'
import { mountInMap } from './fixtures/mount-map'
import type { FakeStyleMap } from './fixtures/fake-style-map'

const created = vi.hoisted(() => [] as FakeStyleMap[])

vi.mock('maplibre-gl', async () => {
  const { fakeStyleMap } = await import('./fixtures/fake-style-map')
  function FakeGlMap() {
    const map = fakeStyleMap()
    created.push(map)
    return map
  }
  return { Map: FakeGlMap, LngLat: { convert: (v: unknown) => v } }
})

const area = (x: number): Polygon => ({ type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] })

describe('MaplibreMaskLayer', () => {
  it('creates a fill layer with the inverted mask and applies color/opacity', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreMaskLayer, { layerId: 'mask', data: area(0), color: '#123', opacity: 0.3 }))
    expect(map.getLayer('mask-fill')?.paint).toEqual({ 'fill-color': '#123', 'fill-opacity': 0.3 })
    const data = (map.sources.get('mask-fill__source') as { data: { geometry: Polygon } }).data
    expect(data.geometry.coordinates).toHaveLength(2)
    expect(map.getLayer('mask-line')).toBeUndefined()
  })

  it('adds an outline layer that draws the original data', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreMaskLayer, { layerId: 'mask', data: area(0), outline: true, outlineColor: '#f00', outlineWidth: 2 }))
    expect(map.getLayer('mask-line')?.paint).toEqual({ 'line-color': '#f00', 'line-width': 2 })
    expect(map.sources.get('mask-line__source')).toEqual({ type: 'geojson', data: area(0) })
  })

  it('updates the mask with setData when data changes', async () => {
    const data = ref(area(0))
    const { map } = await mountInMap(created, () => h(MaplibreMaskLayer, { layerId: 'mask', data: data.value }))
    data.value = area(5)
    await nextTick()
    const call = map.sourceCalls.find(([id, method]) => id === 'mask-fill__source' && method === 'setData')
    expect((call?.[2] as { geometry: Polygon }).geometry.coordinates[1]![0]).toEqual([5, 0])
  })

  it('follows the visibility of the enclosing layer group', async () => {
    const visible = ref(true)
    const { map } = await mountInMap(created, () => h(MaplibreLayerGroup, { visible: visible.value }, {
      default: () => h(MaplibreMaskLayer, { layerId: 'mask', data: area(0), outline: true })
    }))
    visible.value = false
    await nextTick()
    expect(map.getLayer('mask-fill')?.layout.visibility).toBe('none')
    expect(map.getLayer('mask-line')?.layout.visibility).toBe('none')
  })
})

describe('MaplibreGraticuleLayer', () => {
  const lastData = (map: FakeStyleMap, sourceId: string) =>
    map.sourceCalls.filter(([id, method]) => id === sourceId && method === 'setData').at(-1)?.[2] as FeatureCollection | undefined

  it('builds line and label layers from the current view', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreGraticuleLayer, { layerId: 'grid', color: '#333', width: 1 }))
    expect(map.getLayer('grid-line')?.paint).toEqual({ 'line-color': '#333', 'line-width': 1 })
    expect(map.getLayer('grid-label')?.type).toBe('symbol')
    // 关闭简化：共线加密点被简化后长线段在瓦片裁剪与球面下丢失
    expect(map.sources.get('grid-line__source')).toMatchObject({ tolerance: 0 })
    // 低缩放级别使用全球范围，zoom 1 对应 30° 步长
    const lines = lastData(map, 'grid-line__source')!
    expect(lines.features.filter(f => f.properties?.axis === 'lon')).toHaveLength(12)
  })

  it('recomputes on moveend only when the view leaves the expanded extent or the step changes', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreGraticuleLayer, { layerId: 'grid', labels: false }))
    expect(map.getLayer('grid-label')).toBeUndefined()
    map.zoom = 6
    map.bounds = [110, 30, 112, 32]
    map.fire('moveend')
    await nextTick()
    const first = lastData(map, 'grid-line__source')
    expect(first?.features.find(f => f.properties?.axis === 'lon')?.properties?.value).toBe(109)

    const calls = map.sourceCalls.length
    map.bounds = [110.5, 30.5, 112.5, 32.5]
    map.fire('moveend')
    await nextTick()
    expect(map.sourceCalls.length).toBe(calls)

    map.bounds = [120, 30, 122, 32]
    map.fire('moveend')
    await nextTick()
    expect(map.sourceCalls.length).toBeGreaterThan(calls)
  })

  it('uses a fixed step when provided and unbinds moveend on unmount', async () => {
    const show = ref(true)
    const { map } = await mountInMap(created, () => (show.value ? h(MaplibreGraticuleLayer, { layerId: 'grid', step: 10 }) : null))
    const lines = lastData(map, 'grid-line__source')!
    expect(lines.features.filter(f => f.properties?.axis === 'lon')).toHaveLength(36)
    show.value = false
    await nextTick()
    const calls = map.sourceCalls.length
    map.zoom = 8
    map.fire('moveend')
    await nextTick()
    expect(map.sourceCalls.length).toBe(calls)
    expect(map.getLayer('grid-line')).toBeUndefined()
  })
})
