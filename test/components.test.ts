import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MaplibreMap from '../src/runtime/components/Map.vue'
import MaplibreLayer from '../src/runtime/components/Layer.vue'
import MaplibreCustomLayer from '../src/runtime/components/CustomLayer.vue'
import MaplibreTiandituLayer from '../src/runtime/components/extensions/TiandituLayer.vue'
import { useMap } from '../src/runtime/composables/useMap'
import { setMaplibreConfig } from '../src/runtime/domains/map/config'
import { useControl } from '../src/runtime/domains/map/control'

// 富功能 fake gl Map：记录 addLayer 次数、图层级 on 绑定次数，并可手动 fire 事件
const { maps, makeFakeMap } = vi.hoisted(() => {
  const maps: ReturnType<typeof makeFakeMap>[] = []
  function makeFakeMap() {
    const handlers: Record<string, Set<(e?: unknown) => void>> = {}
    const layers = new Set<string>()
    const sources = new Set<string>()
    const center = { lng: 0, lat: 0 }
    const self = {
      layers,
      addLayerCalls: 0,
      layerSpecs: [] as Record<string, unknown>[],
      layerOnCalls: 0,
      setCenterCalls: 0,
      setTilesCalls: 0,
      addSourceCalls: 0,
      setDataCalls: [] as unknown[],
      styleLoaded: true,
      on(type: string, a: unknown, b?: unknown) {
        const listener = (b ?? a) as (e?: unknown) => void
        if (b) self.layerOnCalls++
        ;(handlers[type] ??= new Set()).add(listener)
      },
      off(type: string, a: unknown, b?: unknown) {
        const listener = (b ?? a) as (e?: unknown) => void
        handlers[type]?.delete(listener)
      },
      fire(type: string, e?: unknown) {
        handlers[type]?.forEach(fn => fn(e))
      },
      isStyleLoaded: () => self.styleLoaded,
      getLayersOrder: () => [] as string[],
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      addLayer: (spec: { id: string }) => {
        layers.add(spec.id)
        self.layerSpecs.push(spec)
        self.addLayerCalls++
      },
      removeLayer: (id: string) => layers.delete(id),
      getSource: (id: string) => (sources.has(id)
        ? {
            setData: (data: unknown) => self.setDataCalls.push(data),
            setUrl() {},
            setTiles: () => self.setTilesCalls++,
            updateImage() {}
          }
        : undefined),
      addSource: (id: string) => {
        sources.add(id)
        self.addSourceCalls++
      },
      moveLayer() {},
      removeSource: (id: string) => sources.delete(id),
      resize() {},
      remove() {},
      getCenter: () => ({ ...center }),
      getZoom: () => 1,
      getBearing: () => 0,
      getPitch: () => 0,
      // 模拟 jumpTo：写入并同步派发 moveend（用于验证相机回环已断）
      setCenter(v: [number, number]) {
        self.setCenterCalls++
        center.lng = v[0]
        center.lat = v[1]
        self.fire('moveend')
      },
      setZoom() {},
      setBearing() {},
      setPitch() {},
      setStyle() {},
      addControlCalls: 0,
      addControl: () => self.addControlCalls++,
      removeControl() {}
    }
    maps.push(self)
    return self
  }
  return { maps, makeFakeMap }
})

vi.mock('maplibre-gl', () => {
  // 函数构造器：new FakeGlMap() 返回 makeFakeMap() 生成的桩对象
  function FakeGlMap(this: unknown, options: unknown) {
    return Object.assign(makeFakeMap(), { options })
  }
  function Noop() {}
  const LngLat = {
    convert: (v: unknown) => (Array.isArray(v)
      ? { lng: v[0], lat: v[1] }
      : v as { lng: number, lat: number })
  }
  return {
    Map: FakeGlMap,
    LngLat,
    Marker: Noop,
    Popup: Noop
  }
})

const inlineSource = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } as const

describe('F1 Map id 唯一性', () => {
  it('同一应用内多张地图自动 id 互不相同', () => {
    const ids: string[] = []
    const Child = defineComponent({
      setup() {
        ids.push(useMap().id)
        return () => h('div')
      }
    })
    const Parent = defineComponent({
      setup() {
        return () => h('div', [
          h(MaplibreMap, { options: {} }, { default: () => h(Child) }),
          h(MaplibreMap, { options: {} }, { default: () => h(Child) })
        ])
      }
    })
    mount(Parent)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })
})

describe('F2 Layer 卸载后不再响应 style.load', () => {
  it('卸载后再次 style.load 不重复加图层、不重复绑事件', async () => {
    const show = ref(true)
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => (show.value
            ? h(MaplibreLayer, { layerId: 'l', type: 'circle', source: inlineSource })
            : null)
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!

    map.fire('style.load')
    expect(map.addLayerCalls).toBe(1)
    const onCallsAfterMount = map.layerOnCalls
    expect(onCallsAfterMount).toBeGreaterThan(0)

    show.value = false
    await nextTick()
    map.fire('style.load')
    expect(map.addLayerCalls).toBe(1)
    expect(map.layerOnCalls).toBe(onCallsAfterMount)
  })
})

describe('F3 TiandituLayer 切换类型', () => {
  it('切换 layer 类型时原地更新瓦片，不重建图层', async () => {
    const layer = ref<'vec' | 'img'>('vec')
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibreTiandituLayer, { layer: layer.value, tk: 'test' })
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!

    map.fire('style.load')
    expect(map.layers.has('tianditu-base')).toBe(true)
    const addLayerCallsAfterMount = map.addLayerCalls

    layer.value = 'img'
    await nextTick()
    // 稳定 id：图层始终存在，未触发重建
    expect(map.layers.has('tianditu-base')).toBe(true)
    expect(map.addLayerCalls).toBe(addLayerCallsAfterMount)
    // 通过 setTiles 原地切换瓦片
    expect(map.setTilesCalls).toBeGreaterThan(0)
  })

  it('annotation 时叠加注记图层', async () => {
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibreTiandituLayer, { layer: 'img', annotation: true, tk: 'test' })
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!

    map.fire('style.load')
    expect(map.layers.has('tianditu-base')).toBe(true)
    expect(map.layers.has('tianditu-annotation')).toBe(true)
  })
})

describe('F4 onReady：load 后样式瞬时未就绪时经 styledata 补建', () => {
  it('挂载于 isStyleLoaded() 为 false 时，待样式就绪后补建图层', async () => {
    const show = ref(false)
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => (show.value
            ? h(MaplibreLayer, { layerId: 'late', type: 'circle', source: inlineSource })
            : null)
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!
    map.fire('style.load')

    // 初次加载后样式瞬时未就绪：此刻挂载的组件不能立即建层
    map.styleLoaded = false
    show.value = true
    await nextTick()
    expect(map.layers.has('late')).toBe(false)

    // 样式仍未就绪：styledata 不补建
    map.fire('styledata')
    expect(map.layers.has('late')).toBe(false)

    // 样式就绪后 styledata 触发补建
    map.styleLoaded = true
    map.fire('styledata')
    expect(map.layers.has('late')).toBe(true)
  })
})

describe('相机回环', () => {
  it('moveend 回写后 watcher 比对相等，不再递归调用 setCenter', async () => {
    const wrapper = mount(MaplibreMap, { props: { center: [0, 0] } as never })
    const map = maps[maps.length - 1]!

    // 模拟一次地图移动结束：回写模型 → watcher 触发
    map.fire('moveend')
    await nextTick()
    await nextTick()

    // 回写值与地图现值一致，watcher 比对相等跳过下发；不形成 moveend→setCenter→moveend 回环
    expect(map.setCenterCalls).toBe(0)
    wrapper.unmount()
  })
})

describe('Layer 响应式更新', () => {
  it('内联 source 数据变化时经 setData 增量更新，不重建图层与源', async () => {
    const source = ref<Record<string, unknown>>(inlineSource)
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibreLayer, { layerId: 'track', type: 'line', source: source.value })
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!
    map.fire('style.load')
    expect(map.addSourceCalls).toBe(1)

    const data = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} }] }
    source.value = { type: 'geojson', data }
    await nextTick()
    expect(map.setDataCalls).toEqual([data])
    expect(map.addSourceCalls).toBe(1)
    expect(map.addLayerCalls).toBe(1)
  })
})

describe('CustomLayer 响应式更新', () => {
  const custom = (id: string) => ({ id, type: 'custom' as const, render() {} })

  function mountCustom(initial: { layer: ReturnType<typeof custom>, beforeId?: string }) {
    const state = ref<{ layer: ReturnType<typeof custom>, beforeId?: string }>(initial)
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => [
            h(MaplibreLayer, { layerId: 'anchor', type: 'circle', source: inlineSource }),
            h(MaplibreCustomLayer, state.value)
          ]
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!
    map.fire('style.load')
    return { state, map }
  }

  it('替换 layer 时移除旧 id 并添加新图层', async () => {
    const { state, map } = mountCustom({ layer: custom('a') })
    expect(map.layers.has('a')).toBe(true)

    const next = custom('b')
    state.value = { layer: next }
    await nextTick()
    expect(map.layers.has('a')).toBe(false)
    expect(map.layers.has('b')).toBe(true)
    expect(map.layerSpecs.at(-1)).toBe(next)
  })

  it('同 id 换对象也会替换', async () => {
    const { state, map } = mountCustom({ layer: custom('a') })
    const next = custom('a')
    state.value = { layer: next }
    await nextTick()
    expect(map.layers.has('a')).toBe(true)
    expect(map.layerSpecs.at(-1)).toBe(next)
  })
})

describe('Layer 规格', () => {
  it('未传 filter 时规格不含 filter 字段（避免 Boolean 类型 prop 被转成 false 过滤掉全部要素）', async () => {
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibreLayer, { layerId: 'no-filter', type: 'circle', source: inlineSource })
        })
      }
    })
    mount(Parent)
    const map = maps[maps.length - 1]!
    map.fire('style.load')
    await nextTick()

    const spec = map.layerSpecs.find(item => item.id === 'no-filter')
    expect(spec).toBeDefined()
    expect(spec).not.toHaveProperty('filter')
  })
})

describe('默认样式', () => {
  it('未传 style 时使用空白样式，保证 onReady 可触发', () => {
    mount(MaplibreMap, { props: { options: { center: [116, 39] } } })
    const { options } = maps[maps.length - 1]! as unknown as { options: { style: unknown, center: unknown } }
    expect(options.style).toEqual({ version: 8, sources: {}, layers: [] })
    expect(options.center).toEqual([116, 39])
  })

  it('空白样式使用全局 glyphs 配置', () => {
    setMaplibreConfig({ glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf' })
    mount(MaplibreMap, { props: { options: {} } })
    setMaplibreConfig({ glyphs: undefined })
    const { options } = maps[maps.length - 1]! as unknown as { options: { style: unknown } }
    expect(options.style).toEqual({ version: 8, glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf', sources: {}, layers: [] })
  })

  it('传入 style 时原样透传', () => {
    mount(MaplibreMap, { props: { options: { style: 'https://example.com/style.json' } } })
    const { options } = maps[maps.length - 1]! as unknown as { options: { style: unknown } }
    expect(options.style).toBe('https://example.com/style.json')
  })
})

describe('attrs', () => {
  it('$attrs 透传的 class 与根节点类合并', () => {
    const wrapper = mount(MaplibreMap, { attrs: { class: 'h-115' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['movk-maplibre', 'h-115']))
    wrapper.unmount()
  })
})

describe('useControl', () => {
  it('地图实例创建后即 addControl，不等 load', async () => {
    const Control = defineComponent({
      setup() {
        useControl(() => ({ onAdd: () => document.createElement('div'), onRemove() {} }))
        return () => null
      }
    })
    const wrapper = mount(MaplibreMap, { props: { options: {} }, slots: { default: () => h(Control) } })
    await nextTick()
    expect(maps[maps.length - 1]!.addControlCalls).toBe(1)
    wrapper.unmount()
  })
})
