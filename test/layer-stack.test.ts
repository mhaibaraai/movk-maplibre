import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import MaplibreLayer from '../src/runtime/components/Layer.vue'
import MaplibreLayerGroup from '../src/runtime/components/LayerGroup.vue'
import MaplibreCustomLayer from '../src/runtime/components/CustomLayer.vue'
import type { StyleLayerPredicate } from '../src/runtime/types'
import { mountInMap } from './fixtures/mount-map'
import type { FakeStyleMap } from './fixtures/fake-style-map'

const { created, initial } = vi.hoisted(() => ({
  created: [] as FakeStyleMap[],
  // 下一张地图的底图样式图层
  initial: { layers: [] as Array<{ id: string, type: string }> }
}))

vi.mock('maplibre-gl', async () => {
  const { fakeStyleMap } = await import('./fixtures/fake-style-map')
  function FakeGlMap() {
    const map = fakeStyleMap(initial.layers)
    created.push(map)
    return map
  }
  return { Map: FakeGlMap, LngLat: { convert: (v: unknown) => v } }
})

const geojson = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } as const
const layer = (layerId: string, props: Record<string, unknown> = {}) =>
  h(MaplibreLayer, { layerId, type: 'fill', source: geojson, ...props })
const group = (props: Record<string, unknown>, children: () => unknown) =>
  h(MaplibreLayerGroup, props, { default: children })
const isSymbol: StyleLayerPredicate = l => l.type === 'symbol'

beforeEach(() => {
  initial.layers = []
})

describe('图层栈：zIndex 排序', () => {
  it('结果与挂载顺序无关', async () => {
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 2 }, () => layer('a')),
      group({ zIndex: 1 }, () => layer('b'))
    ])
    expect(map.getLayersOrder()).toEqual(['b', 'a'])
  })

  it('不设 zIndex 时后挂载在上', async () => {
    const { map } = await mountInMap(created, () => [layer('a'), layer('b'), layer('c')])
    expect(map.getLayersOrder()).toEqual(['a', 'b', 'c'])
  })

  it('同一 tick 修改多个组只重排一次', async () => {
    const za = ref(1)
    const zc = ref(3)
    const { map } = await mountInMap(created, () => [
      group({ zIndex: za.value }, () => layer('a')),
      group({ zIndex: 2 }, () => layer('b')),
      group({ zIndex: zc.value }, () => layer('c'))
    ])
    expect(map.getLayersOrder()).toEqual(['a', 'b', 'c'])
    const readOrder = vi.spyOn(map, 'getLayersOrder')
    za.value = 3
    zc.value = 1
    await flushPromises()
    expect(readOrder).toHaveBeenCalledTimes(1)
    expect(map.getLayersOrder()).toEqual(['c', 'b', 'a'])
  })

  it('顺序已一致时不调用 moveLayer', async () => {
    const za = ref(1)
    const { map } = await mountInMap(created, () => [
      group({ zIndex: za.value }, () => layer('a')),
      group({ zIndex: 2 }, () => layer('b'))
    ])
    za.value = 0
    await flushPromises()
    expect(map.moveCalls).toEqual([])
  })

  it('图层自身 zIndex 在组内排序', async () => {
    const { map } = await mountInMap(created, () => group({}, () => [layer('a', { zIndex: 1 }), layer('b')]))
    expect(map.getLayersOrder()).toEqual(['b', 'a'])
  })

  it('嵌套组：组内图层连续，子组整体参与父组排序', async () => {
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 2 }, () => layer('z')),
      group({ zIndex: 1 }, () => [
        group({ zIndex: 5 }, () => [layer('y1'), layer('y2', { zIndex: 100 })]),
        layer('x')
      ])
    ])
    expect(map.getLayersOrder()).toEqual(['x', 'y1', 'y2', 'z'])
  })

  it('引用源延迟就绪的图层插入正确位置', async () => {
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 1 }, () => layer('early')),
      group({ zIndex: 2 }, () => layer('late', { source: 'later' })),
      group({ zIndex: 3 }, () => layer('top'))
    ])
    expect(map.getLayersOrder()).toEqual(['early', 'top'])
    map.addSource('later', {})
    map.fire('sourcedata', { sourceId: 'later' })
    expect(map.getLayersOrder()).toEqual(['early', 'late', 'top'])
  })

  it('style.load 重放后顺序保持', async () => {
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 3 }, () => layer('c')),
      group({ zIndex: 2 }, () => layer('b')),
      group({ zIndex: 1 }, () => layer('a'))
    ])
    map.replaceStyle([{ id: 'bg', type: 'background' }])
    expect(map.getLayersOrder()).toEqual(['bg', 'a', 'b', 'c'])
  })

  it('v-if 重挂载回到原位置', async () => {
    const shown = ref(true)
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 1 }, () => (shown.value ? layer('a') : null)),
      group({ zIndex: 2 }, () => layer('b'))
    ])
    shown.value = false
    await nextTick()
    shown.value = true
    await nextTick()
    expect(map.getLayersOrder()).toEqual(['a', 'b'])
  })

  it('置顶桶重排不越过其上的非托管图层', async () => {
    const za = ref(1)
    const { map } = await mountInMap(created, () => [
      group({ zIndex: za.value }, () => layer('a')),
      group({ zIndex: 2 }, () => layer('b'))
    ])
    map.addLayer({ id: 'tool', type: 'line' })
    za.value = 3
    await flushPromises()
    expect(map.getLayersOrder()).toEqual(['b', 'a', 'tool'])
  })
})

describe('图层栈：锚点', () => {
  it('字符串锚点桶内按 zIndex 排序', async () => {
    initial.layers = [{ id: 'water', type: 'fill' }, { id: 'labels', type: 'symbol' }]
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 2, beforeId: 'labels' }, () => layer('a')),
      group({ zIndex: 1, beforeId: 'labels' }, () => layer('b')),
      layer('top')
    ])
    expect(map.getLayersOrder()).toEqual(['water', 'b', 'a', 'labels', 'top'])
  })

  it('beforeId 变化时移入新锚点之下', async () => {
    initial.layers = [{ id: 'water', type: 'fill' }, { id: 'labels', type: 'symbol' }]
    const anchor = ref<string>()
    const { map } = await mountInMap(created, () => layer('a', { beforeId: anchor.value }))
    expect(map.getLayersOrder()).toEqual(['water', 'labels', 'a'])
    anchor.value = 'labels'
    await flushPromises()
    expect(map.getLayersOrder()).toEqual(['water', 'a', 'labels'])
    anchor.value = 'missing'
    await flushPromises()
    expect(map.getLayersOrder()).toEqual(['water', 'labels', 'a'])
  })

  it('CustomLayer beforeId 变化时移入新锚点之下', async () => {
    initial.layers = [{ id: 'water', type: 'fill' }, { id: 'labels', type: 'symbol' }]
    const anchor = ref<string>()
    const custom = { id: 'c', type: 'custom', render() {} }
    const { map } = await mountInMap(created, () => h(MaplibreCustomLayer, { layer: custom, beforeId: anchor.value }))
    anchor.value = 'labels'
    await flushPromises()
    expect(map.getLayersOrder()).toEqual(['water', 'c', 'labels'])
  })

  it('谓词锚点解析为底图快照中的首个匹配，忽略运行时图层', async () => {
    initial.layers = [{ id: 'water', type: 'fill' }, { id: 'labels', type: 'symbol' }, { id: 'poi', type: 'symbol' }]
    const { map } = await mountInMap(created, () => [
      layer('mine', { type: 'symbol' }),
      layer('biz', { beforeId: isSymbol })
    ])
    expect(map.getLayersOrder()).toEqual(['water', 'biz', 'labels', 'poi', 'mine'])
  })

  it('换样式后谓词重新解析，无匹配时置顶', async () => {
    initial.layers = [{ id: 'labels', type: 'symbol' }]
    const { map } = await mountInMap(created, () => layer('biz', { beforeId: isSymbol }))
    map.replaceStyle([{ id: 'bg', type: 'background' }, { id: 'names', type: 'symbol' }])
    expect(map.getLayersOrder()).toEqual(['bg', 'biz', 'names'])
    map.replaceStyle([{ id: 'bg', type: 'background' }])
    expect(map.getLayersOrder()).toEqual(['bg', 'biz'])
  })

  it('CustomLayer 继承组锚点并参与排序', async () => {
    initial.layers = [{ id: 'water', type: 'fill' }, { id: 'labels', type: 'symbol' }]
    const custom = { id: 'c', type: 'custom', render() {} }
    const { map } = await mountInMap(created, () => [
      group({ zIndex: 2, beforeId: 'labels' }, () => h(MaplibreCustomLayer, { layer: custom })),
      group({ zIndex: 1, beforeId: 'labels' }, () => layer('d'))
    ])
    expect(map.getLayersOrder()).toEqual(['water', 'd', 'c', 'labels'])
  })
})
