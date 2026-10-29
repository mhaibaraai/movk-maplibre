import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MaplibreMap from '../src/runtime/components/Map.vue'
import MaplibreMarker from '../src/runtime/components/Marker.vue'

const { maps, markers, popups, makeFakeMap } = vi.hoisted(() => {
  interface FakeMarkerLike {
    element: HTMLElement
    options: Record<string, unknown>
    calls: Array<[string, unknown[]]>
    removed: number
    fire: (type: string) => void
    lnglat: unknown
  }
  interface FakePopupLike { opened: boolean, options: Record<string, unknown> }
  const maps: ReturnType<typeof makeFakeMap>[] = []
  const markers: FakeMarkerLike[] = []
  const popups: FakePopupLike[] = []
  function makeFakeMap() {
    const handlers: Record<string, Set<(e?: unknown) => void>> = {}
    // 还原真实结构：marker 元素挂在 canvasContainer 内，其 DOM click 冒泡后
    // maplibre 依次 fire('preclick') / fire('click')，preclick 会关闭 closeOnClick 的 popup
    const canvasContainer = document.createElement('div')
    document.body.appendChild(canvasContainer)
    const fired: string[] = []
    const self = {
      canvasContainer,
      fired,
      on(type: string, a: unknown, b?: unknown) {
        ;(handlers[type] ??= new Set()).add((b ?? a) as (e?: unknown) => void)
      },
      off(type: string, a: unknown, b?: unknown) {
        handlers[type]?.delete((b ?? a) as (e?: unknown) => void)
      },
      fire(type: string, e?: unknown) {
        fired.push(type)
        handlers[type]?.forEach(fn => fn(e))
      },
      isStyleLoaded: () => true,
      getLayersOrder: () => [] as string[],
      resize() {},
      remove() {},
      getCanvasContainer: () => canvasContainer,
      getCenter: () => ({ lng: 0, lat: 0 }),
      getZoom: () => 1,
      getBearing: () => 0,
      getPitch: () => 0,
      setStyle() {}
    }
    canvasContainer.addEventListener('click', () => {
      self.fire('preclick')
      self.fire('click')
    })
    maps.push(self)
    return self
  }
  return { maps, markers, popups, makeFakeMap }
})

vi.mock('maplibre-gl', () => {
  function FakeGlMap(this: unknown) {
    return makeFakeMap()
  }
  interface FakeMapLike {
    getCanvasContainer: () => HTMLElement
    on: (type: string, a: unknown, b?: unknown) => void
    off: (type: string, a: unknown, b?: unknown) => void
  }
  class FakeMarker {
    element: HTMLElement
    calls: Array<[string, unknown[]]> = []
    removed = 0
    lnglat: unknown = [0, 0]
    private listeners: Record<string, Set<() => void>> = {}
    constructor(public options: { element?: HTMLElement } & Record<string, unknown> = {}) {
      this.element = options.element ?? document.createElement('div')
      markers.push(this)
    }

    setLngLat(v: unknown) {
      this.lnglat = v
      return this
    }

    addTo(map: FakeMapLike) {
      map.getCanvasContainer().appendChild(this.element)
      return this
    }

    on(type: string, fn: () => void) { (this.listeners[type] ??= new Set()).add(fn) }
    fire(type: string) { this.listeners[type]?.forEach(fn => fn()) }
    remove() {
      this.removed++
      this.element.remove()
    }

    getElement() { return this.element }
    getLngLat() {
      const [lng, lat] = this.lnglat as [number, number]
      return { lng, lat }
    }

    private record(name: string, args: unknown[]) {
      this.calls.push([name, args])
      return this
    }

    setDraggable(...args: unknown[]) { return this.record('setDraggable', args) }
    setRotation(...args: unknown[]) { return this.record('setRotation', args) }
    setRotationAlignment(...args: unknown[]) { return this.record('setRotationAlignment', args) }
    setPitchAlignment(...args: unknown[]) { return this.record('setPitchAlignment', args) }
    setOffset(...args: unknown[]) { return this.record('setOffset', args) }
    setOpacity(...args: unknown[]) { return this.record('setOpacity', args) }
    setSubpixelPositioning(...args: unknown[]) { return this.record('setSubpixelPositioning', args) }
    addClassName(...args: unknown[]) { return this.record('addClassName', args) }
    removeClassName(...args: unknown[]) { return this.record('removeClassName', args) }
  }
  class FakePopup {
    opened = false
    private map?: FakeMapLike
    private listeners: Record<string, Set<() => void>> = {}
    constructor(public options: Record<string, unknown> = {}) {
      popups.push(this)
    }

    private onClose = () => this.remove()

    setLngLat() { return this }
    setDOMContent() { return this }
    addTo(map: FakeMapLike) {
      this.opened = true
      this.map = map
      // maplibre 默认 closeOnClick: true，绑定在 map 的 preclick 上
      if (this.options.closeOnClick !== false) map.on('preclick', this.onClose)
      return this
    }

    remove() {
      if (this.opened) {
        this.opened = false
        this.map?.off('preclick', this.onClose)
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
    Marker: FakeMarker,
    Popup: FakePopup
  }
})

/** 挂载一个 MaplibreMap，其内渲染 children，并把地图置为 loaded */
async function mountMap(children: () => unknown) {
  const Parent = defineComponent({
    setup() {
      return () => h(MaplibreMap, { options: {} }, { default: children })
    }
  })
  const wrapper = mount(Parent, { attachTo: document.body })
  maps[maps.length - 1]!.fire('load')
  await nextTick()
  await nextTick()
  return wrapper
}

const card = () => h('div', { 'data-test': 'card' }, 'card')

function clickMarker(index = 0) {
  markers[index]!.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function hasCard(wrapper: { find: (s: string) => { exists: () => boolean } }) {
  return wrapper.find('[data-test="card"]').exists()
}

describe('MaplibreMarker 弹窗', () => {
  beforeEach(() => {
    maps.length = 0
    markers.length = 0
    popups.length = 0
  })

  it('无 #popup 插槽时不创建 popup，点击照常冒泡到地图', async () => {
    const wrapper = await mountMap(() => h(MaplibreMarker, { lnglat: [0, 0] }, { default: () => h('div', 'pin') }))

    expect(popups).toHaveLength(0)
    clickMarker()
    await nextTick()
    expect(popups).toHaveLength(0)
    // 未接管弹窗的 marker 不应吞掉地图点击
    expect(maps[0]!.fired).toContain('click')
    wrapper.unmount()
  })

  // 回归：点击若冒泡到地图，maplibre 的 preclick 会立刻触发 closeOnClick，
  // 把刚在微任务检查点里挂载好的 popup 当场关闭，表现为“点了没反应”
  it('trigger=click 时点击 marker 不冒泡到地图，避免 preclick 自关闭', async () => {
    const wrapper = await mountMap(() =>
      h(MaplibreMarker, { lnglat: [0, 0] }, { default: () => h('div', 'pin'), popup: card })
    )

    clickMarker()
    await nextTick()

    expect(hasCard(wrapper)).toBe(true)
    expect(maps[0]!.fired).not.toContain('preclick')
    expect(maps[0]!.fired).not.toContain('click')
    wrapper.unmount()
  })

  it('地图上的 preclick 关闭 popup 时，open 同步复位', async () => {
    const wrapper = await mountMap(() =>
      h(MaplibreMarker, { lnglat: [0, 0], open: true }, { default: () => h('div', 'pin'), popup: card })
    )
    expect(hasCard(wrapper)).toBe(true)

    // 用户点击地图空白处
    maps[0]!.fire('preclick')
    await nextTick()
    expect(hasCard(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('trigger=click 时点击 marker 开合弹窗（toggle）', async () => {
    const wrapper = await mountMap(() =>
      h(MaplibreMarker, { lnglat: [0, 0] }, { default: () => h('div', 'pin'), popup: card })
    )

    expect(hasCard(wrapper)).toBe(false)

    clickMarker()
    await nextTick()
    expect(hasCard(wrapper)).toBe(true)

    clickMarker()
    await nextTick()
    expect(hasCard(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('trigger=hover 时 mouseenter 开、mouseleave 关', async () => {
    const wrapper = await mountMap(() =>
      h(MaplibreMarker, { lnglat: [0, 0], trigger: 'hover' }, { default: () => h('div', 'pin'), popup: card })
    )
    const el = markers[0]!.element

    el.dispatchEvent(new MouseEvent('mouseenter'))
    await nextTick()
    expect(hasCard(wrapper)).toBe(true)

    el.dispatchEvent(new MouseEvent('mouseleave'))
    await nextTick()
    expect(hasCard(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('trigger=none 时不绑定监听，仅 v-model:open 生效', async () => {
    const open = ref(false)
    const wrapper = await mountMap(() =>
      h(
        MaplibreMarker,
        { 'lnglat': [0, 0], 'trigger': 'none', 'open': open.value, 'onUpdate:open': (v: boolean) => (open.value = v) },
        { default: () => h('div', 'pin'), popup: card }
      )
    )

    clickMarker()
    await nextTick()
    expect(hasCard(wrapper)).toBe(false)

    open.value = true
    await nextTick()
    expect(hasCard(wrapper)).toBe(true)
    wrapper.unmount()
  })

  it('静态 :open="true" 初始即展开，且仍可 click 关闭', async () => {
    const wrapper = await mountMap(() =>
      h(MaplibreMarker, { lnglat: [0, 0], open: true }, { default: () => h('div', 'pin'), popup: card })
    )

    expect(hasCard(wrapper)).toBe(true)

    clickMarker()
    await nextTick()
    expect(hasCard(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('一组 marker 同时默认展开且互不影响', async () => {
    const points = [[0, 0], [1, 1], [2, 2]]
    const wrapper = await mountMap(() =>
      points.map((lnglat, i) =>
        h(MaplibreMarker, { key: i, lnglat, open: true }, {
          default: () => h('div', 'pin'),
          popup: () => h('div', { 'data-test': 'card' }, `card-${i}`)
        })
      )
    )

    expect(wrapper.findAll('[data-test="card"]')).toHaveLength(3)

    clickMarker(0)
    await nextTick()
    expect(wrapper.findAll('[data-test="card"]')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('MaplibreMarker 弹窗样式', () => {
  it('受控 popup 透传自定义类并保留默认主题', async () => {
    const open = ref(true)
    const wrapper = await mountMap(() => h(MaplibreMarker, {
      'lnglat': [0, 0],
      'open': open.value,
      'onUpdate:open': (value: boolean) => { open.value = value },
      'popupOptions': { className: 'marker-popup' }
    }, { default: () => h('span', 'marker'), popup: () => h('span', 'details') }))
    const popup = popups.at(-1)!
    expect(popup.options.className).toBe('movk-popup marker-popup')
    maps.at(-1)!.fire('preclick')
    await nextTick()
    expect(open.value).toBe(false)
    wrapper.unmount()
  })
})

describe('MaplibreMarker options 响应式', () => {
  beforeEach(() => {
    maps.length = 0
    markers.length = 0
    popups.length = 0
  })

  async function mountMarker(options: Record<string, unknown>) {
    const state = ref<Record<string, unknown>>(options)
    const lnglat = ref<[number, number]>([0, 0])
    const wrapper = await mountMap(() => h(MaplibreMarker, {
      'lnglat': lnglat.value,
      'onUpdate:lnglat': (v: [number, number]) => (lnglat.value = v),
      'options': state.value
    }, { default: () => h('div', 'pin') }))
    return { state, lnglat, wrapper }
  }

  it('rotation / draggable 变化走 setter，不重建', async () => {
    const { state, wrapper } = await mountMarker({ rotation: 0 })
    state.value = { rotation: 90, draggable: true }
    await nextTick()

    expect(markers).toHaveLength(1)
    expect(markers[0]!.calls).toContainEqual(['setRotation', [90]])
    expect(markers[0]!.calls).toContainEqual(['setDraggable', [true]])
    wrapper.unmount()
  })

  it('className 变化时移除旧类、添加新类', async () => {
    const { state, wrapper } = await mountMarker({ className: 'a b' })
    state.value = { className: 'c' }
    await nextTick()

    expect(markers).toHaveLength(1)
    expect(markers[0]!.calls).toEqual([
      ['removeClassName', ['a']],
      ['removeClassName', ['b']],
      ['addClassName', ['c']]
    ])
    wrapper.unmount()
  })

  it('color / anchor 变化时重建并带上新参数，复用插槽元素', async () => {
    const { state, wrapper } = await mountMarker({ color: 'red', className: 'x' })
    const element = markers[0]!.element
    state.value = { color: 'blue', anchor: 'bottom', className: 'x' }
    await nextTick()

    expect(markers).toHaveLength(2)
    expect(markers[0]!.removed).toBe(1)
    // 重建前清除旧 className，避免残留在复用的插槽元素上
    expect(markers[0]!.calls).toContainEqual(['removeClassName', ['x']])
    expect(markers[1]!.options).toMatchObject({ color: 'blue', anchor: 'bottom', className: 'x' })
    expect(markers[1]!.element).toBe(element)
    wrapper.unmount()
  })

  it('内联对象值不变、引用变化时不做任何操作', async () => {
    const { state, wrapper } = await mountMarker({ rotation: 30, offset: [0, 1] })
    state.value = { rotation: 30, offset: [0, 1] }
    await nextTick()

    expect(markers).toHaveLength(1)
    expect(markers[0]!.calls).toEqual([])
    wrapper.unmount()
  })

  it('draggable 运行时开启后，dragend 回写 lnglat', async () => {
    const { state, lnglat, wrapper } = await mountMarker({})
    state.value = { draggable: true }
    await nextTick()

    markers[0]!.lnglat = [5, 6]
    markers[0]!.fire('dragend')
    expect(lnglat.value).toEqual([5, 6])
    wrapper.unmount()
  })

  it('地图实例创建后即挂载 marker，不等 load', async () => {
    const Parent = defineComponent({
      setup: () => () => h(MaplibreMap, { options: {} }, { default: () => h(MaplibreMarker, { lnglat: [0, 0] }) })
    })
    const wrapper = mount(Parent, { attachTo: document.body })
    await nextTick()
    expect(maps[maps.length - 1]!.fired).not.toContain('load')
    expect(markers).toHaveLength(1)
    wrapper.unmount()
  })

  it('地图就绪前卸载不会创建 marker', async () => {
    const Parent = defineComponent({
      setup: () => () => h(MaplibreMap, { options: {} }, { default: () => h(MaplibreMarker, { lnglat: [0, 0] }) })
    })
    // 同步卸载：whenAttached 的微任务续体尚未执行
    const wrapper = mount(Parent, { attachTo: document.body })
    wrapper.unmount()
    await nextTick()
    await nextTick()
    expect(markers).toHaveLength(0)
  })
})
