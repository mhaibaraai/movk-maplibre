<script setup lang="ts">
import { computed, inject, onUnmounted, provide, watch } from 'vue'
import { omitUndefined } from '@movk/core'
import type { Map as MaplibreMap, MapEventType, MapLayerEventType } from 'maplibre-gl'
import type { FilterSpecification, LayerSpecification, SourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { useMap } from '../composables/useMap'
import { LayerGroupKey } from '../domains/map/layer-group'
import { getLayerStack } from '../domains/map/layer-stack'
import { LayerScopeKey, SourceScopeKey } from '../domains/map/layer-scope'
import { useStyleId } from '../domains/map/style-id'
import { applyLayerProps, type LayerUpdate } from '../utils/layer'
import { opacityPropsFor, scaleOpacity } from '../utils/layer-opacity'
import { bindMapEvents } from '../utils/events'
import { updateSource } from '../utils/source'
import type { LayerBeforeId } from '../types'

type PropBag = Record<string, unknown>

const props = withDefaults(defineProps<{
  /** 图层 id，全局唯一；省略时按类型自动生成（如 `fill#1`）；变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 图层类型，决定渲染方式与可用的 paint / layout 属性；变更需配合 `:key` 重建
   * @see https://maplibre.org/maplibre-style-spec/layers/
   */
  type: LayerSpecification['type']
  /** source id 字符串引用，或内联 source 对象（自动创建匿名源并随图层卸载，内容变化时增量更新）；省略时引用外层 MaplibreSource；二者之间切换需配合 `:key` 重建 */
  source?: string | SourceSpecification
  /** 矢量瓦片源内的子图层名（source-layer），消费矢量源时必填；变更需配合 `:key` 重建 */
  sourceLayer?: string
  /**
   * 绘制样式属性，响应式变更经 setPaintProperty 增量下发
   * @see https://maplibre.org/maplibre-style-spec/layers/
   */
  paint?: PropBag
  /**
   * 布局属性，响应式变更经 setLayoutProperty 增量下发
   * @see https://maplibre.org/maplibre-style-spec/layers/
   */
  layout?: PropBag
  /**
   * 过滤表达式，仅渲染匹配的要素
   * @see https://maplibre.org/maplibre-style-spec/expressions/
   */
  filter?: FilterSpecification
  /**
   * 最小缩放级别，低于此级别不渲染
   * @defaultValue 0
   */
  minzoom?: number
  /**
   * 最大缩放级别，高于此级别不渲染
   * @defaultValue 24
   */
  maxzoom?: number
  /** 插入到该图层之前，用于定位底图等外部图层：传图层 id，或传过滤函数在底图样式图层中取首个匹配；省略时继承所属组，均无则位于托管图层栈顶部 */
  beforeId?: LayerBeforeId
  /**
   * 在同级（所属组内或地图顶层）中的层级，越大越靠上；同值时后挂载在上
   * @defaultValue 0
   */
  zIndex?: number
}>(), {
  // FilterSpecification 含 boolean，缺省值须显式为 undefined，否则 Vue 将缺省的 Boolean 类型 prop 转为 false 并过滤掉全部要素
  filter: undefined
})

const emit = defineEmits<{
  click: [event: MapLayerEventType['click']]
  dblclick: [event: MapLayerEventType['dblclick']]
  mousedown: [event: MapLayerEventType['mousedown']]
  mouseup: [event: MapLayerEventType['mouseup']]
  mousemove: [event: MapLayerEventType['mousemove']]
  mouseenter: [event: MapLayerEventType['mouseenter']]
  mouseleave: [event: MapLayerEventType['mouseleave']]
  contextmenu: [event: MapLayerEventType['contextmenu']]
}>()

const LAYER_EVENTS = ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave', 'contextmenu'] as const

const ctx = useMap()
const layerId = useStyleId(props.type, props.layerId)
// 外层 MaplibreSource（可选）：省略 source 时引用它
const sourceScope = inject(SourceScopeKey, null)
// 所属图层组（可选）：提供排序路径、缺省插入锚点、组级显隐与透明度
const group = inject(LayerGroupKey, null)

// 图层栈按排序键决定插入位置，挂载、延迟建层与样式重载的先后不影响最终顺序
const stack = getLayerStack(ctx)
const seq = stack.nextSeq()
const stackKey = computed(() => [...(group?.stackKey.value ?? []), props.zIndex ?? 0, seq])
const anchor = (): LayerBeforeId | undefined => props.beforeId ?? group?.beforeId.value
const stackHandle = stack.register({ layerId: () => layerId, key: () => stackKey.value, beforeId: anchor })

// 组状态叠加到使用方的 layout / paint：组隐藏时强制 none，组透明度按类型缩放透明度属性
const effectiveLayout = computed<PropBag | undefined>(() => {
  if (!group) return props.layout
  const visibility = group.visible.value ? (props.layout?.visibility ?? 'visible') : 'none'
  return { ...props.layout, visibility }
})

const effectivePaint = computed<PropBag | undefined>(() => {
  const factor = group?.opacity.value ?? 1
  if (factor === 1) return props.paint
  const scaled = Object.fromEntries(
    opacityPropsFor(props.type).map(key => [key, scaleOpacity(props.paint?.[key], factor)])
  )
  return { ...props.paint, ...scaled }
})

if (group) {
  onUnmounted(group.registerLayer(() => ({ layerId, type: props.type, paint: props.paint })))
}
provide(LayerScopeKey, { layerId })

const inlineSourceId = `${layerId}-source`
const hasInlineSource = typeof props.source === 'object'

// background 图层不允许 source 字段，不继承外层源
function resolveSourceId(): string | undefined {
  if (props.source === undefined) return props.type === 'background' ? undefined : sourceScope?.sourceId
  return hasInlineSource ? inlineSourceId : (props.source as string)
}

function buildSpec(): LayerSpecification {
  const spec = omitUndefined({
    id: layerId,
    type: props.type,
    source: resolveSourceId(),
    paint: effectivePaint.value,
    layout: effectiveLayout.value,
    filter: props.filter,
    minzoom: props.minzoom,
    maxzoom: props.maxzoom
  }) as Record<string, unknown>
  if (props.sourceLayer) spec['source-layer'] = props.sourceLayer
  return spec as unknown as LayerSpecification
}

function currentUpdate(): LayerUpdate {
  return { id: layerId, paint: effectivePaint.value, layout: effectiveLayout.value, filter: props.filter, minzoom: props.minzoom, maxzoom: props.maxzoom }
}

let prev: LayerUpdate = currentUpdate()

function addLayer(map: MaplibreMap): void {
  if (map.getLayer(layerId)) return
  if (hasInlineSource && !map.getSource(inlineSourceId)) {
    map.addSource(inlineSourceId, props.source as SourceSpecification)
  }
  map.addLayer(buildSpec(), stackHandle.insertBefore(map))
  prev = currentUpdate()
}

let stopEvents: (() => void) | undefined
let onSourceData: ((event: MapEventType['sourcedata']) => void) | undefined

const stopReady = ctx.onReady((map) => {
  const sourceId = resolveSourceId()
  if (sourceId && !hasInlineSource && !map.getSource(sourceId)) {
    // 引用的 source 尚未就绪，待其加载后再补建图层；先移除上一轮 style.load 残留的监听避免堆叠
    if (onSourceData) map.off('sourcedata', onSourceData)
    onSourceData = (event: MapEventType['sourcedata']) => {
      if (event.sourceId === sourceId && map.getSource(sourceId)) {
        map.off('sourcedata', onSourceData!)
        onSourceData = undefined
        addLayer(map)
        bindLayerEvents(map)
      }
    }
    map.on('sourcedata', onSourceData)
    return
  }
  addLayer(map)
  bindLayerEvents(map)
})

function bindLayerEvents(map: MaplibreMap): void {
  stopEvents?.()
  stopEvents = bindMapEvents(map, LAYER_EVENTS, (type, event) => emit(type as never, event as never), layerId)
}

watch(
  () => [effectivePaint.value, effectiveLayout.value, props.filter, props.minzoom, props.maxzoom] as const,
  () => {
    const map = ctx.map.value
    if (!map?.getLayer(layerId)) return
    const next = currentUpdate()
    applyLayerProps(map, next, prev)
    prev = next
  },
  { deep: true }
)

// 内联源尚未建立时跳过：onReady 重建时读取的是最新 props.source
if (hasInlineSource) {
  watch(() => props.source as SourceSpecification, (next, prev) => {
    const source = ctx.map.value?.getSource(inlineSourceId)
    if (source) updateSource(source, next, prev)
  }, { deep: true })
}

watch([stackKey, anchor], () => {
  const map = ctx.map.value
  if (map?.getLayer(layerId)) stack.reflow(map)
})

onUnmounted(() => {
  stackHandle.unregister()
  stopReady()
  stopEvents?.()
  const map = ctx.map.value
  if (!map) return
  if (onSourceData) map.off('sourcedata', onSourceData)
  if (map.getLayer(layerId)) map.removeLayer(layerId)
  if (hasInlineSource && map.getSource(inlineSourceId)) map.removeSource(inlineSourceId)
})
</script>

<template>
  <slot />
</template>
