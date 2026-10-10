import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import MaplibreMap from '../src/runtime/components/Map.vue'
import MaplibreLayer from '../src/runtime/components/Layer.vue'
import MaplibreLayerGroup from '../src/runtime/components/LayerGroup.vue'
import { useLayerTree } from '../src/runtime/composables/useLayerTree'
import type { LayerTreeItem } from '../src/runtime/types'
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

const inlineSource = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } as const

function mountTree(render: () => unknown, mapId?: string) {
  const items = ref<LayerTreeItem[]>([])
  const Probe = defineComponent({
    setup() {
      const tree = useLayerTree()
      return () => {
        items.value = tree.value
        return null
      }
    }
  })
  const wrapper = mount(defineComponent({
    setup() {
      return () => h(MaplibreMap, { options: {}, mapId }, { default: () => [render(), h(Probe)] })
    }
  }))
  const map = created.at(-1)!
  map.fire('style.load')
  return { wrapper, map, items }
}

describe('MaplibreLayerGroup 图层树', () => {
  it('带 title 的组按声明顺序注册，无 title 的组不注册', async () => {
    const { items } = mountTree(() => [
      h(MaplibreLayerGroup, { title: '学校' }),
      h(MaplibreLayerGroup),
      h(MaplibreLayerGroup, { title: '医院' })
    ])
    await nextTick()
    expect(items.value.map(item => item.title)).toEqual(['学校', '医院'])
  })

  it('按 zIndex 降序排列，同值保持声明顺序', async () => {
    const { items } = mountTree(() => [
      h(MaplibreLayerGroup, { title: '学校' }),
      h(MaplibreLayerGroup, { title: '医院', zIndex: 2 }),
      h(MaplibreLayerGroup, { title: '公园' }),
      h(MaplibreLayerGroup, { title: '道路', zIndex: -1 })
    ])
    await nextTick()
    expect(items.value.map(item => item.title)).toEqual(['医院', '学校', '公园', '道路'])
  })

  it('setZIndex 写回组的 model 并重排图层与树', async () => {
    const onZIndex = vi.fn()
    const { items, map } = mountTree(() => [
      h(MaplibreLayerGroup, { 'title': '学校', 'onUpdate:zIndex': onZIndex }, {
        default: () => h(MaplibreLayer, { layerId: 'a', type: 'fill', source: inlineSource })
      }),
      h(MaplibreLayerGroup, { title: '医院', zIndex: 1 }, {
        default: () => h(MaplibreLayer, { layerId: 'b', type: 'fill', source: inlineSource })
      })
    ])
    await nextTick()
    expect(map.getLayersOrder()).toEqual(['a', 'b'])

    items.value.find(item => item.title === '学校')!.setZIndex(2)
    await flushPromises()
    expect(onZIndex).toHaveBeenCalledWith(2)
    expect(items.value.map(item => item.title)).toEqual(['学校', '医院'])
    expect(map.getLayersOrder()).toEqual(['b', 'a'])
  })

  it('卸载后注销', async () => {
    const show = ref(true)
    const { items } = mountTree(() => (show.value ? h(MaplibreLayerGroup, { title: '学校' }) : null))
    await nextTick()
    expect(items.value).toHaveLength(1)
    show.value = false
    await nextTick()
    await nextTick()
    expect(items.value).toHaveLength(0)
  })

  it('setVisible / setOpacity 写回组的 model 并触发 update 事件', async () => {
    const onVisible = vi.fn()
    const onOpacity = vi.fn()
    const { items, map } = mountTree(() => h(MaplibreLayerGroup, {
      'title': '学校',
      'onUpdate:visible': onVisible,
      'onUpdate:opacity': onOpacity
    }, {
      default: () => h(MaplibreLayer, { layerId: 'a', type: 'fill', source: inlineSource, paint: { 'fill-opacity': 0.8 } })
    }))
    await nextTick()

    items.value[0]!.setVisible(false)
    items.value[0]!.setOpacity(0.5)
    await nextTick()
    expect(onVisible).toHaveBeenCalledWith(false)
    expect(onOpacity).toHaveBeenCalledWith(0.5)
    expect(items.value[0]).toMatchObject({ visible: false, opacity: 0.5 })
    expect(map.layers.get('a')!.layout.visibility).toBe('none')
    expect(map.layers.get('a')!.paint['fill-opacity']).toBeCloseTo(0.4)
  })

  it('组恢复可见与不透明时，图层回到使用方自己的值', async () => {
    const visible = ref(false)
    const opacity = ref(0.5)
    const { map } = mountTree(() => h(MaplibreLayerGroup, { title: 'x', visible: visible.value, opacity: opacity.value }, {
      default: () => h(MaplibreLayer, { layerId: 'a', type: 'line', source: inlineSource, layout: { visibility: 'none' } })
    }))
    await nextTick()
    expect(map.layers.get('a')!.layout.visibility).toBe('none')
    expect(map.layers.get('a')!.paint['line-opacity']).toBe(0.5)

    visible.value = true
    opacity.value = 1
    await nextTick()
    // 使用方自身 layout.visibility 为 none，组可见时不强行显示
    expect(map.layers.get('a')!.layout.visibility).toBe('none')
    expect(map.paintCalls.at(-1)).toEqual(['a', 'line-opacity', undefined])
  })

  it('嵌套组：显隐取与，透明度相乘', async () => {
    const outerVisible = ref(true)
    const { map } = mountTree(() => h(MaplibreLayerGroup, { title: '外', visible: outerVisible.value, opacity: 0.5 }, {
      default: () => h(MaplibreLayerGroup, { title: '内', opacity: 0.5 }, {
        default: () => h(MaplibreLayer, { layerId: 'a', type: 'circle', source: inlineSource })
      })
    }))
    await nextTick()
    expect(map.layers.get('a')!.paint['circle-opacity']).toBeCloseTo(0.25)

    outerVisible.value = false
    await nextTick()
    expect(map.layers.get('a')!.layout.visibility).toBe('none')
  })

  it('图例由子图层颜色推导，legend prop 优先', async () => {
    const { items } = mountTree(() => [
      h(MaplibreLayerGroup, { title: '河流' }, {
        default: () => h(MaplibreLayer, { layerId: 'r', type: 'line', source: inlineSource, paint: { 'line-color': '#00f' } })
      }),
      h(MaplibreLayerGroup, { title: '自定义', legend: [{ label: '甲', type: 'fill', color: '#123' }] }, {
        default: () => h(MaplibreLayer, { layerId: 'c', type: 'fill', source: inlineSource, paint: { 'fill-color': '#f00' } })
      })
    ])
    await nextTick()
    expect(items.value[0]!.legend).toEqual([{ label: '河流', type: 'line', color: '#00f' }])
    expect(items.value[1]!.legend).toEqual([{ label: '甲', type: 'fill', color: '#123' }])
  })

  it('无 title 的嵌套组把子图层图例归入最近的带 title 祖先', async () => {
    const { items } = mountTree(() => h(MaplibreLayerGroup, { title: '水系' }, {
      default: () => h(MaplibreLayerGroup, null, {
        default: () => h(MaplibreLayer, { layerId: 'w', type: 'fill', source: inlineSource, paint: { 'fill-color': '#0af' } })
      })
    }))
    await nextTick()
    expect(items.value[0]!.legend).toEqual([{ label: '水系', type: 'fill', color: '#0af' }])
  })

  it('useLayerTree 在地图子树外通过 mapId 解析', async () => {
    const outside = ref<LayerTreeItem[]>([])
    const Sidebar = defineComponent({
      setup() {
        const tree = useLayerTree({ mapId: 'tree-map' })
        return () => {
          outside.value = tree.value
          return null
        }
      }
    })
    mount(defineComponent({
      setup() {
        return () => [
          h(Sidebar),
          h(MaplibreMap, { options: {}, mapId: 'tree-map' }, { default: () => h(MaplibreLayerGroup, { title: '学校' }) })
        ]
      }
    }))
    await nextTick()
    expect(outside.value.map(item => item.title)).toEqual(['学校'])
  })
})
