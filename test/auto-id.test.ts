import { describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import type { Polygon } from 'geojson'
import MaplibreSource from '../src/runtime/components/Source.vue'
import MaplibreLayer from '../src/runtime/components/Layer.vue'
import MaplibreTooltip from '../src/runtime/components/Tooltip.vue'
import MaplibreMaskLayer from '../src/runtime/components/layers/MaskLayer.vue'
import MaplibreRasterLayer from '../src/runtime/components/layers/RasterLayer.vue'
import { logger } from '../src/runtime/utils/logger'
import { mountInMap } from './fixtures/mount-map'
import type { FakeStyleMap } from './fixtures/fake-style-map'

const created = vi.hoisted(() => [] as FakeStyleMap[])

vi.mock('maplibre-gl', async () => {
  const { fakeStyleMap } = await import('./fixtures/fake-style-map')
  const { vi } = await import('vitest')
  function FakeGlMap() {
    const map = fakeStyleMap()
    map.on = vi.fn(map.on)
    created.push(map)
    return map
  }
  class FakePopup {
    on() {}
    remove() { return this }
    isOpen() { return false }
  }
  return { Map: FakeGlMap, LngLat: { convert: (v: unknown) => v }, Popup: FakePopup }
})

const geojson = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } as const
// 某事件在某图层上的监听次数；MaplibreLayer 自身会为 emits 绑定一次
const bindCount = (map: FakeStyleMap, type: string, layerId: string) =>
  (map.on as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([t, l]) => t === type && l === layerId).length

const area: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }

describe('样式 id 自动生成', () => {
  it('省略 layerId 时按图层类型与每图计数生成', async () => {
    const { map } = await mountInMap(created, () => [
      h(MaplibreLayer, { type: 'fill', source: geojson }),
      h(MaplibreLayer, { type: 'fill', source: geojson }),
      h(MaplibreLayer, { type: 'line', source: geojson })
    ])
    expect(map.getLayersOrder()).toEqual(['fill#1', 'fill#2', 'line#1'])
  })

  it('内联源 id 为 <layerId>-source（如 circle#1-source）', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreLayer, { type: 'circle', source: geojson }))
    expect(map.sources.has('circle#1-source')).toBe(true)
  })

  it('不同地图各自从 1 计数', async () => {
    await mountInMap(created, () => h(MaplibreLayer, { type: 'fill', source: geojson }))
    const { map } = await mountInMap(created, () => h(MaplibreLayer, { type: 'fill', source: geojson }))
    expect(map.getLayersOrder()).toEqual(['fill#1'])
  })

  it('跳过地图中已被占用的 id', async () => {
    const shown = ref(false)
    const { map } = await mountInMap(created, () => (shown.value ? h(MaplibreLayer, { type: 'fill', source: geojson }) : null))
    map.addLayer({ id: 'fill#1', type: 'fill' })
    shown.value = true
    await nextTick()
    expect(map.getLayersOrder()).toEqual(['fill#1', 'fill#2'])
  })

  it('显式 layerId 优先', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreLayer, { layerId: 'roads', type: 'line', source: geojson }))
    expect(map.getLayersOrder()).toEqual(['roads'])
  })

  it('省略 sourceId 时按 source 类型生成', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreSource, { source: geojson }))
    expect([...map.sources.keys()]).toEqual(['geojson#1'])
  })

  it('手写保留形式的 id 时告警，后续自动 id 跳过它', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { map } = await mountInMap(created, () => [
      h(MaplibreLayer, { layerId: 'fill#1', type: 'fill', source: geojson }),
      h(MaplibreLayer, { type: 'fill', source: geojson })
    ])
    expect(map.getLayersOrder()).toEqual(['fill#1', 'fill#2'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('fill#1')
    warn.mockRestore()
  })

  it('普通手写 id 不告警，也不占用自动计数', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { map } = await mountInMap(created, () => [
      h(MaplibreLayer, { layerId: 'fill-1', type: 'fill', source: geojson }),
      h(MaplibreLayer, { type: 'fill', source: geojson })
    ])
    expect(map.getLayersOrder()).toEqual(['fill-1', 'fill#1'])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('复合组件把自动 id 原样传给内部 Source / Layer 时不告警', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { map } = await mountInMap(created, () => h(MaplibreRasterLayer, { tiles: ['https://example.com/{z}/{x}/{y}.png'] }))
    expect(map.getLayersOrder()).toEqual(['raster#1'])
    expect(map.sources.has('raster#1')).toBe(true)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('复合组件缺省 id 不带库前缀', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreMaskLayer, { data: area }))
    expect(map.getLayersOrder()).toEqual(['mask#1-fill'])
  })
})

describe('嵌套继承', () => {
  it('Layer 省略 source 时继承父级 Source', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreSource, { source: geojson }, {
      default: () => [
        h(MaplibreLayer, { type: 'fill' }),
        h(MaplibreLayer, { type: 'line', source: 'other' })
      ]
    }))
    map.addSource('other', {})
    map.fire('sourcedata', { sourceId: 'other' })
    expect(map.getStyle().layers).toEqual([
      expect.objectContaining({ id: 'fill#1', source: 'geojson#1' }),
      expect.objectContaining({ id: 'line#1', source: 'other' })
    ])
  })

  it('background 图层不继承 source', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreSource, { source: geojson }, {
      default: () => h(MaplibreLayer, { type: 'background' })
    }))
    expect(map.getStyle().layers[0]).not.toHaveProperty('source')
  })

  it('Tooltip 省略 layerId 时绑定到父级 Layer', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreLayer, { type: 'circle', source: geojson }, {
      default: () => h(MaplibreTooltip)
    }))
    expect(bindCount(map, 'mousemove', 'circle#1')).toBe(2)
  })

  it('Tooltip 显式 layerId 优先于父级 Layer', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreLayer, { type: 'circle', source: geojson }, {
      default: () => h(MaplibreTooltip, { layerId: 'poi' })
    }))
    expect(bindCount(map, 'mousemove', 'poi')).toBe(1)
    expect(bindCount(map, 'mousemove', 'circle#1')).toBe(1)
  })

  it('Tooltip 无 layerId 且无父级 Layer 时告警且不绑定', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { map } = await mountInMap(created, () => h(MaplibreTooltip))
    expect(warn).toHaveBeenCalled()
    expect(map.on).not.toHaveBeenCalledWith('mousemove', expect.anything(), expect.any(Function))
    warn.mockRestore()
  })
})
