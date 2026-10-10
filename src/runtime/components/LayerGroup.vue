<script setup lang="ts">
import { computed, inject, provide, reactive, shallowReactive, useId, watch } from 'vue'
import { clamp } from '@movk/core'
import { useMap } from '../composables/useMap'
import { LayerGroupKey } from '../domains/map/layer-group'
import type { LayerDescriptor } from '../domains/map/layer-group'
import { getLayerStack } from '../domains/map/layer-stack'
import { getLayerTree } from '../domains/map/layer-tree'
import { useStyleLayerAdoption } from '../domains/map/style-layers'
import type { LayerBeforeId, LayerTreeItem, LegendItem, StyleLayerPredicate } from '../types'
import { deriveLegend } from '../utils/legend'

/** 图层组：统一子图层的层级、插入锚点、显隐与透明度；带 title 时进入图层树，供图层控件、图例与 useLayerTree 使用。 */
const props = defineProps<{
  /** 组内图层缺省插入到该图层之前，用于定位底图等外部图层：传图层 id，或传过滤函数在底图样式图层中取首个匹配（如 `l => l.type === 'symbol'` 压在注记下方）；未设置时继承父组。托管图层之间的顺序用 zIndex */
  beforeId?: LayerBeforeId
  /** 组标题；设置后注册到图层树，出现在 MaplibreLayerControl、MaplibreLegend 与 useLayerTree 中 */
  title?: string
  /** 图例项；省略时由子图层颜色推导 */
  legend?: LegendItem[]
  /** 认领底图样式自带的图层（按类型、source-layer 等匹配），与子图层一起受组的显隐与透明度控制 */
  styleLayers?: StyleLayerPredicate
}>()

/** 组级显隐（组开关优先于子图层自身的 layout.visibility） */
const visible = defineModel<boolean>('visible', { default: true })
/** 组级透明度 0..1，按图层类型缩放各透明度属性 */
const opacity = defineModel<number>('opacity', { default: 1 })
/** 组在同级（父组内或地图顶层）中的层级，越大越靠上；同值时后挂载在上，组内图层始终连续 */
const zIndex = defineModel<number>('zIndex', { default: 0 })

const ctx = useMap()
const parent = inject(LayerGroupKey, null)
const seq = getLayerStack(ctx).nextSeq()

const effectiveVisible = computed(() => (parent?.visible.value ?? true) && visible.value)
const effectiveOpacity = computed(() => (parent?.opacity.value ?? 1) * clamp(opacity.value, 0, 1))

const layers = shallowReactive(new Set<() => LayerDescriptor>())

// 无 title 的组不进图层树，子图层图例归入最近的带 title 祖先
function registerLayer(descriptor: () => LayerDescriptor): () => void {
  if (!props.title && parent) return parent.registerLayer(descriptor)
  layers.add(descriptor)
  return () => layers.delete(descriptor)
}

provide(LayerGroupKey, {
  beforeId: computed(() => props.beforeId ?? parent?.beforeId.value),
  stackKey: computed(() => [...(parent?.stackKey.value ?? []), zIndex.value, seq]),
  visible: effectiveVisible,
  opacity: effectiveOpacity,
  registerLayer
})

useStyleLayerAdoption(() => props.styleLayers, effectiveVisible, effectiveOpacity)

const legendItems = computed(() => props.legend ?? deriveLegend([...layers].map(get => get()), props.title ?? ''))

const item = reactive({
  id: useId(),
  title: computed(() => props.title ?? ''),
  visible,
  opacity,
  zIndex,
  legend: legendItems,
  setVisible: (value: boolean) => {
    visible.value = value
  },
  setOpacity: (value: number) => {
    opacity.value = clamp(value, 0, 1)
  },
  setZIndex: (value: number) => {
    zIndex.value = value
  }
}) as LayerTreeItem

// title 出现即注册、消失或卸载即注销
watch(() => Boolean(props.title), (titled, _, onCleanup) => {
  if (!titled) return
  onCleanup(getLayerTree(ctx).register(item.id, item))
}, { immediate: true })
</script>

<template>
  <slot />
</template>
