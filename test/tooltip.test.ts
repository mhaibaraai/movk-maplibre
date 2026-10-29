import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MaplibreMap from '../src/runtime/components/Map.vue'
import MaplibreTooltip from '../src/runtime/components/Tooltip.vue'

const { maps, popups, rendered, makeFakeMap } = vi.hoisted(() => {
  interface FakePopupLike { opened: boolean, options: Record<string, unknown> }
  const maps: ReturnType<typeof makeFakeMap>[] = []
  const popups: FakePopupLike[] = []
  // queryRenderedFeatures 的返回值，由用例控制数据更新后原位置能否查到要素
  const rendered: unknown[] = []
  function makeFakeMap() {
    const handlers: Record<string, Set<(e?: unknown) => void>> = {}
    const onceHandlers: Record<string, Set<(e?: unknown) => void>> = {}
    // 仅记录带 layerId 的三参数监听，避免把 Map 组件自身的事件转发计入
    const layerHandlers: Record<string, Set<(e?: unknown) => void>> = {}
    // 按「事件:图层」记录，验证监听绑定到哪个图层
    const byLayer: Record<string, Set<(e?: unknown) => void>> = {}
    const canvas = document.createElement('canvas')
    const self = {
      on(type: string, a: unknown, b?: unknown) {
        const fn = (b ?? a) as (e?: unknown) => void
        ;(handlers[type] ??= new Set()).add(fn)
        if (b !== undefined) {
          (layerHandlers[type] ??= new Set()).add(fn)
          ;(byLayer[`${type}:${a}`] ??= new Set()).add(fn)
        }
      },
      once(type: string, fn: (e?: unknown) => void) {
        (onceHandlers[type] ??= new Set()).add(fn)
      },
      off(type: string, a: unknown, b?: unknown) {
        const fn = (b ?? a) as (e?: unknown) => void
        handlers[type]?.delete(fn)
        onceHandlers[type]?.delete(fn)
        layerHandlers[type]?.delete(fn)
        if (b !== undefined) byLayer[`${type}:${a}`]?.delete(fn)
      },
      fire(type: string, e?: unknown) {
        handlers[type]?.forEach(fn => fn(e))
        const once = [...(onceHandlers[type] ?? [])]
        onceHandlers[type]?.clear()
        once.forEach(fn => fn(e))
      },
      getLayer: (id: string) => (id === 'poi' ? { source: 'poi-src' } : undefined),
      getSource: (id: string) => (id === 'poi-src' ? {} : undefined),
      isSourceLoaded: () => true,
      project: (lngLat: unknown) => lngLat,
      queryRenderedFeatures: () => [...rendered],
      count(type: string) {
        return layerHandlers[type]?.size ?? 0
      },
      countOn(type: string, layerId: string) {
        return byLayer[`${type}:${layerId}`]?.size ?? 0
      },
      getCanvas: () => canvas,
      isStyleLoaded: () => true,
      getLayersOrder: () => [] as string[],
      resize() {},
      remove() {},
      getCenter: () => ({ lng: 0, lat: 0 }),
      getZoom: () => 1,
      getBearing: () => 0,
      getPitch: () => 0,
      setStyle() {}
    }
    maps.push(self)
    return self
  }
  return { maps, popups, rendered, makeFakeMap }
})

vi.mock('maplibre-gl', () => {
  function FakeGlMap(this: unknown) {
    return makeFakeMap()
  }
  class FakePopup {
    opened = false
    private listeners: Record<string, Set<() => void>> = {}
    constructor(public options: Record<string, unknown> = {}) {
      popups.push(this)
    }

    setLngLat() { return this }
    setDOMContent() { return this }
    addTo() {
      this.opened = true
      return this
    }

    remove() {
      if (this.opened) {
        this.opened = false
        this.listeners.close?.forEach(fn => fn())
      }
      return this
    }

    on(type: string, fn: () => void) { (this.listeners[type] ??= new Set()).add(fn) }
    isOpen() { return this.opened }
  }
  return {
    Map: FakeGlMap,
    LngLat: { convert: (v: unknown) => v },
    Marker: function () {},
    Popup: FakePopup
  }
})

const feature = { type: 'Feature', properties: { title: '天安门' }, geometry: { type: 'Point', coordinates: [0, 0] } }
const layerEvent = { features: [feature], lngLat: { lng: 0, lat: 0 } }

async function mountTooltip(props: Record<string, unknown>, slot?: (scope: Record<string, unknown>) => unknown) {
  const Parent = defineComponent({
    setup() {
      return () => h(MaplibreMap, { options: {} }, {
        default: () => h(MaplibreTooltip, { layerId: 'poi', ...props }, {
          default: slot ?? (({ feature }: Record<string, unknown>) =>
            h('p', (feature as typeof layerEvent.features[0] | undefined)?.properties?.title ?? ''))
        })
      })
    }
  })
  const wrapper = mount(Parent, { attachTo: document.body })
  const map = maps[maps.length - 1]!
  map.fire('load')
  await nextTick()
  await nextTick()
  return { wrapper, map, popup: () => popups[popups.length - 1]! }
}

describe('MaplibreTooltip 触发模式', () => {
  beforeEach(() => {
    maps.length = 0
    popups.length = 0
    rendered.length = 0
  })

  it.each(['hover', 'click'] as const)('%s 弹窗保留自定义类和主题类', async (trigger) => {
    const { wrapper, popup } = await mountTooltip({ trigger, options: { className: 'custom-tooltip' } })
    expect(popup().options.className).toBe('movk-popup custom-tooltip')
    expect(popup().options.closeButton).toBe(trigger === 'click')
    wrapper.unmount()
  })

  it('默认 hover：mousemove 展示、mouseleave 收起', async () => {
    const { wrapper, map, popup } = await mountTooltip({})

    map.fire('mousemove', layerEvent)
    await nextTick()
    expect(popup().isOpen()).toBe(true)
    expect(wrapper.text()).toContain('天安门')

    map.fire('mouseleave')
    await nextTick()
    expect(popup().isOpen()).toBe(false)
    wrapper.unmount()
  })

  it('默认 hover：popup 关闭按钮与 closeOnClick 均被接管', async () => {
    const { wrapper, popup } = await mountTooltip({})
    expect(popup().options).toMatchObject({ closeButton: false, closeOnClick: false })
    wrapper.unmount()
  })

  it('trigger=click：click 展示，mouseleave 不再收起', async () => {
    const { wrapper, map, popup } = await mountTooltip({ trigger: 'click' })

    expect(map.count('mousemove')).toBe(0)

    map.fire('click', layerEvent)
    await nextTick()
    expect(popup().isOpen()).toBe(true)

    map.fire('mouseleave')
    await nextTick()
    expect(popup().isOpen()).toBe(true)
    wrapper.unmount()
  })

  it('trigger=click：默认给关闭按钮且不启用 closeOnClick', async () => {
    const { wrapper, popup } = await mountTooltip({ trigger: 'click' })
    expect(popup().options).toMatchObject({ closeButton: true, closeOnClick: false })
    wrapper.unmount()
  })

  it('trigger=none：不绑定任何监听', async () => {
    const { wrapper, map, popup } = await mountTooltip({ trigger: 'none' })

    expect(map.count('mousemove')).toBe(0)
    expect(map.count('click')).toBe(0)
    expect(map.count('mouseenter')).toBe(0)

    map.fire('click', layerEvent)
    await nextTick()
    expect(popup().isOpen()).toBe(false)
    wrapper.unmount()
  })

  it('trigger 可响应式切换，用于临时停用', async () => {
    const trigger = ref<'hover' | 'none'>('hover')
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibreTooltip, { layerId: 'poi', trigger: trigger.value }, { default: () => h('p', 'x') })
        })
      }
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    const map = maps[maps.length - 1]!
    map.fire('load')
    await nextTick()
    await nextTick()
    expect(map.count('mousemove')).toBe(1)

    trigger.value = 'none'
    await nextTick()
    expect(map.count('mousemove')).toBe(0)
    wrapper.unmount()
  })

  it('插槽 close 可收起 popup', async () => {
    const { wrapper, map, popup } = await mountTooltip(
      { trigger: 'click' },
      ({ close }) => h('button', { onClick: close as () => void }, 'close')
    )

    map.fire('click', layerEvent)
    await nextTick()
    expect(popup().isOpen()).toBe(true)

    await wrapper.find('button').trigger('click')
    expect(popup().isOpen()).toBe(false)
    wrapper.unmount()
  })
})

describe('MaplibreTooltip 图层数据更新', () => {
  const dataChanged = (map: typeof maps[number]) => {
    map.fire('sourcedata', { sourceId: 'poi-src', sourceDataType: 'content' })
    map.fire('render')
  }

  beforeEach(() => {
    maps.length = 0
    popups.length = 0
    rendered.length = 0
  })

  it('原位置已无要素时关闭', async () => {
    const { wrapper, map, popup } = await mountTooltip({})
    map.fire('mousemove', layerEvent)
    await nextTick()

    dataChanged(map)
    await nextTick()

    expect(popup().isOpen()).toBe(false)
    expect(wrapper.text()).not.toContain('天安门')
    wrapper.unmount()
  })

  it('原位置仍有要素时保持打开并刷新为新要素', async () => {
    const { wrapper, map, popup } = await mountTooltip({ trigger: 'click' })
    map.fire('click', layerEvent)
    await nextTick()

    rendered.push({ ...feature, properties: { title: '故宫' } })
    dataChanged(map)
    await nextTick()

    expect(popup().isOpen()).toBe(true)
    expect(wrapper.text()).toContain('故宫')
    wrapper.unmount()
  })

  it('其他 source 的数据变化不影响弹窗', async () => {
    const { wrapper, map, popup } = await mountTooltip({})
    map.fire('mousemove', layerEvent)
    await nextTick()

    map.fire('sourcedata', { sourceId: 'other-src', sourceDataType: 'content' })
    map.fire('render')
    await nextTick()

    expect(popup().isOpen()).toBe(true)
    wrapper.unmount()
  })
})

describe('MaplibreTooltip options / layerId 响应式', () => {
  beforeEach(() => {
    maps.length = 0
    popups.length = 0
    rendered.length = 0
  })

  async function mountReactive(initial: Record<string, unknown>) {
    const state = ref<Record<string, unknown>>({ layerId: 'poi', ...initial })
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibreTooltip, state.value, { default: () => h('p', 'x') })
        })
      }
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    const map = maps[maps.length - 1]!
    map.fire('load')
    await nextTick()
    await nextTick()
    return { state, map, wrapper }
  }

  it('options 值变化时以新参数重建，值相同不重建', async () => {
    const { state, wrapper } = await mountReactive({ options: { maxWidth: '200px' } })
    state.value = { ...state.value, options: { maxWidth: '200px' } }
    await nextTick()
    expect(popups).toHaveLength(1)

    state.value = { ...state.value, options: { maxWidth: '320px', className: 'updated-tooltip' } }
    await nextTick()
    expect(popups).toHaveLength(2)
    expect(popups[1]!.options).toMatchObject({ maxWidth: '320px', closeButton: false, className: 'movk-popup updated-tooltip' })
    wrapper.unmount()
  })

  it('layerId 变化后在新图层上重新绑定监听', async () => {
    const { state, map, wrapper } = await mountReactive({})
    expect(map.countOn('mousemove', 'poi')).toBe(1)

    state.value = { ...state.value, layerId: 'shops' }
    await nextTick()
    expect(map.countOn('mousemove', 'poi')).toBe(0)
    expect(map.countOn('mousemove', 'shops')).toBe(1)
    wrapper.unmount()
  })

  it('click 模式下弹窗打开时修改 options，弹窗保持打开', async () => {
    const { state, map, wrapper } = await mountReactive({ trigger: 'click' })
    map.fire('click', layerEvent)
    await nextTick()
    expect(popups[0]!.opened).toBe(true)

    state.value = { ...state.value, options: { maxWidth: '320px' } }
    await nextTick()
    expect(popups).toHaveLength(2)
    expect(popups[1]!.opened).toBe(true)
    expect(wrapper.text()).toContain('x')
    wrapper.unmount()
  })
})
