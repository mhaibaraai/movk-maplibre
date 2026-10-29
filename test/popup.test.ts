import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MaplibreMap from '../src/runtime/components/Map.vue'
import MaplibrePopup from '../src/runtime/components/Popup.vue'

const { maps, popups, makeFakeMap } = vi.hoisted(() => {
  interface FakePopupLike {
    opened: boolean
    content?: HTMLElement
    lnglats: unknown[]
    removed: number
    options: Record<string, unknown>
  }
  const maps: ReturnType<typeof makeFakeMap>[] = []
  const popups: FakePopupLike[] = []
  function makeFakeMap() {
    const handlers: Record<string, Set<(e?: unknown) => void>> = {}
    const self = {
      on(type: string, a: unknown, b?: unknown) {
        ;(handlers[type] ??= new Set()).add((b ?? a) as (e?: unknown) => void)
      },
      off() {},
      fire(type: string, e?: unknown) {
        handlers[type]?.forEach(fn => fn(e))
      },
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
  return { maps, popups, makeFakeMap }
})

vi.mock('maplibre-gl', () => {
  function FakeGlMap(this: unknown) {
    return makeFakeMap()
  }
  class FakePopup {
    opened = false
    content?: HTMLElement
    lnglats: unknown[] = []
    removed = 0
    constructor(public options: Record<string, unknown> = {}) {
      popups.push(this)
    }

    setLngLat(v: unknown) {
      this.lnglats.push(v)
      return this
    }

    // 记录被交给 maplibre 的节点：真实实现会把它搬进 .maplibregl-popup-content
    setDOMContent(node: HTMLElement) {
      this.content = node
      return this
    }

    addTo() {
      this.opened = true
      return this
    }

    private listeners: Record<string, Set<() => void>> = {}

    // 与 maplibre 一致：打开状态下 remove 派发 close
    remove() {
      this.removed++
      if (this.opened) {
        this.opened = false
        this.listeners.close?.forEach(fn => fn())
      }
      return this
    }

    on(type: string, fn: () => void) { (this.listeners[type] ??= new Set()).add(fn) }
    off(type: string, fn: () => void) { this.listeners[type]?.delete(fn) }
    isOpen() { return this.opened }
  }
  return {
    Map: FakeGlMap,
    LngLat: { convert: (v: unknown) => v },
    Marker: function () {},
    Popup: FakePopup
  }
})

/** 挂载 MaplibreMap + MaplibrePopup；load 由调用方决定何时触发 */
function mountPopup(props: Record<string, unknown> = {}) {
  const Parent = defineComponent({
    setup() {
      return () => h(MaplibreMap, { options: {} }, {
        default: () => h(MaplibrePopup, { lnglat: [0, 0], ...props }, {
          default: () => h('span', { 'data-test': 'card' }, 'content')
        })
      })
    }
  })
  const wrapper = mount(Parent, { attachTo: document.body })
  const map = () => maps[maps.length - 1]!
  return { wrapper, map }
}

const cardEl = (wrapper: ReturnType<typeof mountPopup>['wrapper']) =>
  wrapper.get('[data-test="card"]').element as HTMLElement

describe('MaplibrePopup 挂载前的内容隔离', () => {
  beforeEach(() => {
    maps.length = 0
    popups.length = 0
  })

  // 回归：地图就绪前 popup 内容不得参与文档流，否则会裸露在地图容器左上角
  it('maplibre Popup 创建前，内容被 display:none 的宿主隔离', () => {
    const { wrapper } = mountPopup()

    // 同步断言：whenAttached 的微任务续体尚未执行
    expect(popups).toHaveLength(0)

    const el = cardEl(wrapper).parentElement!
    const host = el.parentElement!
    expect(host.style.display).toBe('none')
    wrapper.unmount()
  })

  it('地图实例创建后把内层节点交给 maplibre，不等 load', async () => {
    const { wrapper } = mountPopup()
    const el = cardEl(wrapper).parentElement!

    await nextTick()

    expect(popups).toHaveLength(1)
    expect(popups[0]!.content).toBe(el)
    expect(popups[0]!.opened).toBe(true)
    wrapper.unmount()
  })

  it('透传 attrs 落在内层节点而非隐藏宿主', async () => {
    const { wrapper } = mountPopup({ class: 'my-popup' })
    await nextTick()

    const el = cardEl(wrapper).parentElement!
    const host = el.parentElement!
    expect(el.classList.contains('my-popup')).toBe(true)
    expect(host.classList.contains('my-popup')).toBe(false)
    wrapper.unmount()
  })

  it('lnglat 变更更新位置，卸载移除 popup', async () => {
    const lnglat = ref<[number, number]>([1, 2])
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibrePopup, { lnglat: lnglat.value }, { default: () => h('span', 'x') })
        })
      }
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    maps[maps.length - 1]!.fire('load')
    await nextTick()
    await nextTick()

    lnglat.value = [3, 4]
    await nextTick()
    expect(popups[0]!.lnglats).toContainEqual([3, 4])

    wrapper.unmount()
    expect(popups[0]!.removed).toBeGreaterThan(0)
  })
})

describe('MaplibrePopup options 响应式', () => {
  beforeEach(() => {
    maps.length = 0
    popups.length = 0
  })

  async function mountWithOptions(options: Record<string, unknown>) {
    const state = ref<Record<string, unknown>>(options)
    const onClose = vi.fn()
    const Parent = defineComponent({
      setup() {
        return () => h(MaplibreMap, { options: {} }, {
          default: () => h(MaplibrePopup, { lnglat: [1, 2], options: state.value, onClose }, {
            default: () => h('span', { 'data-test': 'card' }, 'content')
          })
        })
      }
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    maps[maps.length - 1]!.fire('load')
    await nextTick()
    await nextTick()
    return { state, onClose, wrapper }
  }

  it('options 值变化时重建并带上新参数，恢复位置与内容', async () => {
    const { state, onClose, wrapper } = await mountWithOptions({ maxWidth: '200px' })
    const content = popups[0]!.content
    state.value = { maxWidth: '300px', anchor: 'top' }
    await nextTick()

    expect(popups).toHaveLength(2)
    expect(popups[0]!.opened).toBe(false)
    expect(popups[1]!.options).toMatchObject({ maxWidth: '300px', anchor: 'top' })
    expect(popups[1]!.lnglats).toContainEqual([1, 2])
    expect(popups[1]!.content).toBe(content)
    expect(popups[1]!.opened).toBe(true)
    // 重建是内部行为，不应对外派发 close
    expect(onClose).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('默认和自定义类始终包含弹窗主题，重建不改变调用方选项', async () => {
    const options = { className: 'custom-popup compact', closeButton: false }
    const { state, onClose, wrapper } = await mountWithOptions(options)
    expect(popups[0]!.options.className).toBe('movk-popup custom-popup compact')
    expect(options.className).toBe('custom-popup compact')

    state.value = { maxWidth: '320px' }
    await nextTick()
    expect(popups[1]!.options.className).toBe('movk-popup')
    expect(onClose).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('内联对象值不变、引用变化时不重建', async () => {
    const { state, wrapper } = await mountWithOptions({ offset: [0, 10] })
    state.value = { offset: [0, 10] }
    await nextTick()
    expect(popups).toHaveLength(1)
    wrapper.unmount()
  })

  it('用户关闭时仍派发 close', async () => {
    const { onClose, wrapper } = await mountWithOptions({})
    popups[0]!.remove()
    expect(onClose).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
