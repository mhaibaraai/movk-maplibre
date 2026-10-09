import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import type { Polygon } from 'geojson'
import MaplibreZztsLayer from '../src/runtime/components/extensions/ZztsLayer.vue'
import { getZztsClip } from '../src/runtime/utils/zzts-clip'
import { mountInMap } from './fixtures/mount-map'
import type { FakeStyleMap } from './fixtures/fake-style-map'

const { created, addProtocol } = vi.hoisted(() => ({ created: [] as FakeStyleMap[], addProtocol: vi.fn() }))

vi.mock('maplibre-gl', async () => {
  const { fakeStyleMap } = await import('./fixtures/fake-style-map')
  function FakeGlMap() {
    const map = fakeStyleMap()
    created.push(map)
    return map
  }
  return { Map: FakeGlMap, LngLat: { convert: (v: unknown) => v }, addProtocol }
})

const MEDIA_URL = 'http://zzts.test/v1/zzts/layer/media?layerName=demo-01'
const BOUNDS = [121.46, 29.89, 121.76, 30.07]
const square: Polygon = { type: 'Polygon', coordinates: [[[121.5, 29.9], [121.6, 29.9], [121.6, 30], [121.5, 30], [121.5, 29.9]]] }

afterEach(() => {
  Reflect.deleteProperty(globalThis, Symbol.for('movk-maplibre:protocol:zzts'))
  vi.clearAllMocks()
})

/** 给桩 map 补上 fitBounds 与已加载 TileJSON 的 source.bounds */
function withFit(map: FakeStyleMap) {
  const fitBounds = vi.fn()
  const getSource = map.getSource.bind(map)
  Object.assign(map, {
    fitBounds,
    getSource: (id: string) => {
      const source = getSource(id)
      return source && { ...source, bounds: BOUNDS }
    }
  })
  return fitBounds
}

describe('MaplibreZztsLayer', () => {
  it('builds a 512px raster source on the zzts protocol and merges paint', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreZztsLayer, {
      layerId: 'zh',
      url: MEDIA_URL,
      opacity: 0.6,
      paint: { 'raster-saturation': -0.5 }
    }))

    expect(map.sources.get('zh')).toEqual({ type: 'raster', url: `zzts://${MEDIA_URL}`, tileSize: 512 })
    expect(map.getLayer('zh')?.paint).toMatchObject({ 'raster-opacity': 0.6, 'raster-saturation': -0.5 })
    expect(addProtocol).toHaveBeenCalledWith('zzts', expect.any(Function))
  })

  it('writes pixel ratio and clip key into the source url and registers the clip', async () => {
    const { map, wrapper } = await mountInMap(created, () => h(MaplibreZztsLayer, { layerId: 'zh', url: MEDIA_URL, pixelRatio: 2, clip: square }))
    const url = map.sources.get('zh')!.url as string

    expect(url).toBe(`zzts://${MEDIA_URL}#pixelRatio=2&clip=zh%3A0`)
    expect(getZztsClip('zh:0')?.bbox).toEqual([121.5, 29.9, 121.6, 30])
    wrapper.unmount()
    expect(getZztsClip('zh:0')).toBeUndefined()
  })

  it('switches to a new clip key and reloads the source when the clip changes', async () => {
    const clip = ref<Polygon | undefined>(square)
    const { map } = await mountInMap(created, () => h(MaplibreZztsLayer, { layerId: 'zh', url: MEDIA_URL, clip: clip.value }))
    clip.value = { ...square }
    await nextTick()
    await nextTick()

    expect(getZztsClip('zh:0')).toBeUndefined()
    expect(getZztsClip('zh:1')).toBeDefined()
    expect(map.sourceCalls).toContainEqual(['zh', 'setUrl', `zzts://${MEDIA_URL}#clip=zh%3A1`])
  })

  it('exposes fit to frame the layer bounds', async () => {
    const { map, wrapper } = await mountInMap(created, () => h(MaplibreZztsLayer, { layerId: 'zh', url: MEDIA_URL, fitOptions: { padding: 20 } }))
    const fitBounds = withFit(map)
    const layer = wrapper.findComponent(MaplibreZztsLayer).vm as unknown as { fit: (options?: object) => boolean }

    expect(layer.fit({ duration: 0 })).toBe(true)
    expect(fitBounds).toHaveBeenCalledWith(BOUNDS, { padding: 20, duration: 0 })
  })

  it('fits once per source url when metadata loads', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreZztsLayer, { layerId: 'zh', url: MEDIA_URL, autoFit: true }))
    const fitBounds = withFit(map)
    map.fire('sourcedata', { sourceId: 'other', sourceDataType: 'metadata' })
    map.fire('sourcedata', { sourceId: 'zh', sourceDataType: 'metadata' })
    map.fire('sourcedata', { sourceId: 'zh', sourceDataType: 'metadata' })

    expect(fitBounds).toHaveBeenCalledTimes(1)
  })
})
