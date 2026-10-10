<script setup lang="ts">
import { inject, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { Popup } from 'maplibre-gl'
import type { GeoJSONFeature, LngLat, Map as MaplibreMap, MapMouseEvent, PopupOptions } from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { LayerScopeKey } from '../domains/map/layer-scope'
import { isDeepEqual } from '@movk/core'
import { onLayerDataChange } from '../utils/events'
import { logger } from '../utils/logger'
import type { PopupTrigger } from '../types'

/** 目标图层要素的弹窗：按 trigger 以悬浮或点击触发，作用域插槽拿到当前要素。 */
const props = withDefaults(defineProps<{
  /** 目标图层 id；省略时绑定外层 MaplibreLayer；变化时改绑到新图层 */
  layerId?: string
  /**
   * Popup 选项（hover 模式下 closeButton/closeOnClick 由组件接管）；值变化时重建弹窗
   * @see https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupOptions/
   */
  options?: PopupOptions
  /**
   * 悬浮时鼠标指针样式
   * @defaultValue 'pointer'
   */
  cursor?: string
  /**
   * 触发时机；'none' 表示不绑定任何监听，可用于临时停用
   * @defaultValue 'hover'
   */
  trigger?: PopupTrigger
}>(), {
  cursor: 'pointer',
  trigger: 'hover'
})

const ctx = useMap()
const parentLayer = inject(LayerScopeKey, null)
const el = useTemplateRef<HTMLDivElement>('el')
const hovered = shallowRef<GeoJSONFeature>()
let popup: Popup | undefined
// 最近一次展示所在位置，图层数据更新后据此重新查询要素
let anchor: LngLat | undefined
// 当前绑定的图层 id，数据更新后据此重新查询要素
let boundLayerId: string | undefined
let unbind: (() => void) | undefined
let disposed = false

type LayerMouseEvent = MapMouseEvent & { features?: GeoJSONFeature[] }

function setCursor(value: string): void {
  const map = ctx.map.value
  if (map) map.getCanvas().style.cursor = value
}

function open(lngLat: LngLat, feature: GeoJSONFeature | undefined): void {
  const map = ctx.map.value
  if (!map || !popup || !el.value) return
  hovered.value = feature
  anchor = lngLat
  popup.setLngLat(lngLat).setDOMContent(el.value)
  if (!popup.isOpen()) popup.addTo(map)
}

function show(event: LayerMouseEvent): void {
  open(event.lngLat, event.features?.[0])
}

function close(): void {
  hovered.value = undefined
  anchor = undefined
  popup?.remove()
}

// 数据更新后原位置仍有要素则刷新为新要素，否则关闭，避免展示已失效的旧数据
function revalidate(map: MaplibreMap): void {
  if (!popup?.isOpen() || !anchor || !boundLayerId) return
  const [feature] = map.queryRenderedFeatures(map.project(anchor), { layers: [boundLayerId] })
  if (feature) hovered.value = feature
  else close()
}

function onMove(event: LayerMouseEvent): void {
  setCursor(props.cursor)
  show(event)
}

function onLeave(): void {
  setCursor('')
  close()
}

function onClick(event: LayerMouseEvent): void {
  show(event)
}

function onEnter(): void {
  setCursor(props.cursor)
}

function onLeaveCursor(): void {
  setCursor('')
}

// hover 下弹窗随指针来去，接管关闭行为；click 下需要关闭按钮，
// 但不能默认 closeOnClick——否则会被开启它的那一次 click 派发立即关闭
function popupOptions(): PopupOptions {
  return props.trigger === 'hover'
    ? { ...props.options, closeButton: false, closeOnClick: false }
    : { closeButton: true, closeOnClick: false, ...props.options }
}

// 按 layerId 委托到地图级监听，目标图层晚于本组件挂载也能命中
function bind(map: MaplibreMap): void {
  if (props.trigger === 'none') return

  // 解绑须用绑定时的图层 id，layerId 变更后 props 已是新值
  const layerId = props.layerId ?? parentLayer?.layerId
  if (!layerId) {
    logger.warn('MaplibreTooltip: no target layer; pass layerId or nest it inside <MaplibreLayer>.')
    return
  }
  boundLayerId = layerId
  const stopDataChange = onLayerDataChange(map, layerId, () => revalidate(map))

  if (props.trigger === 'hover') {
    map.on('mousemove', layerId, onMove)
    map.on('mouseleave', layerId, onLeave)
    unbind = () => {
      stopDataChange()
      map.off('mousemove', layerId, onMove)
      map.off('mouseleave', layerId, onLeave)
    }
    return
  }

  map.on('click', layerId, onClick)
  map.on('mouseenter', layerId, onEnter)
  map.on('mouseleave', layerId, onLeaveCursor)
  unbind = () => {
    stopDataChange()
    map.off('click', layerId, onClick)
    map.off('mouseenter', layerId, onEnter)
    map.off('mouseleave', layerId, onLeaveCursor)
  }
}

function teardown(): void {
  unbind?.()
  unbind = undefined
  boundLayerId = undefined
  setCursor('')
  popup?.remove()
  popup = undefined
}

function setup(map: MaplibreMap): void {
  popup = new Popup(popupOptions())
  popup.on('close', () => (hovered.value = undefined))
  bind(map)
}

onMounted(async () => {
  const map = await ctx.whenAttached()
  if (disposed) return
  setup(map)
})

// trigger/options 变更需重建 popup：closeButton 等选项在构造时确定；layerId 变更需改绑监听
watch(
  [() => props.trigger, () => props.layerId, () => props.options],
  ([trigger, layerId, options], [prevTrigger, prevLayerId, prevOptions]) => {
    const map = ctx.map.value
    // 模板内联 options 每次渲染都是新引用，值相同时跳过
    if (!map || !popup || (trigger === prevTrigger && layerId === prevLayerId && isDeepEqual(options, prevOptions))) return
    // 仅 options 变化时，click 模式下已打开的弹窗在原位恢复；hover 由下一次 mousemove 自然恢复
    const restore = trigger === 'click' && trigger === prevTrigger && layerId === prevLayerId && popup.isOpen() && anchor
      ? { lngLat: anchor, feature: hovered.value }
      : undefined
    teardown()
    setup(map)
    if (restore) open(restore.lngLat, restore.feature)
  }
)

onUnmounted(() => {
  disposed = true
  teardown()
})

defineExpose({
  /** 当前激活要素 */
  hovered: () => hovered.value
})
</script>

<template>
  <div style="display: none">
    <div ref="el">
      <slot :feature="hovered" :close="close" />
    </div>
  </div>
</template>
