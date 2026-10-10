<script setup lang="ts">
import { computed, inject, onUnmounted, toRaw, watch } from 'vue'
import type { CustomLayerInterface, Map as MaplibreMap } from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { LayerGroupKey } from '../domains/map/layer-group'
import { getLayerStack } from '../domains/map/layer-stack'
import type { LayerBeforeId } from '../types'

/** CustomLayerInterface 逃生舱：托管自定义 WebGL 图层的挂载/卸载、层级与样式重载重建。 */
const props = defineProps<{
  /**
   * 自定义图层实现（含 id/type/render）；按引用比较，替换对象时移除旧图层并添加新图层
   * @see https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
   */
  layer: CustomLayerInterface
  /** 插入到该图层之前，用于定位底图等外部图层：传图层 id，或传过滤函数在底图样式图层中取首个匹配；省略时继承所属组 */
  beforeId?: LayerBeforeId
  /**
   * 在同级（所属组内或地图顶层）中的层级，越大越靠上；同值时后挂载在上
   * @defaultValue 0
   */
  zIndex?: number
}>()

const ctx = useMap()
// 所属图层组（可选）：仅继承排序路径与插入锚点，显隐与透明度由自定义图层自行处理
const group = inject(LayerGroupKey, null)

const stack = getLayerStack(ctx)
const seq = stack.nextSeq()
const stackKey = computed(() => [...(group?.stackKey.value ?? []), props.zIndex ?? 0, seq])
const anchor = (): LayerBeforeId | undefined => props.beforeId ?? group?.beforeId.value
const stackHandle = stack.register({ layerId: () => props.layer.id, key: () => stackKey.value, beforeId: anchor })

// 传原始对象：render 每帧调用，经 reactive 代理访问 WebGL 状态既慢又会被依赖追踪
function addLayer(map: MaplibreMap): void {
  if (map.getLayer(props.layer.id)) return
  map.addLayer(toRaw(props.layer), stackHandle.insertBefore(map))
}

const stopReady = ctx.onReady(addLayer)

// 自定义图层带状态与 render 函数，按引用比较；同 id 换对象也需先移除，否则 addLayer 会被跳过
watch(() => props.layer, (_next, prev) => {
  const map = ctx.map.value
  if (!map?.getLayer(prev.id)) return
  map.removeLayer(prev.id)
  addLayer(map)
})

watch([stackKey, anchor], () => {
  const map = ctx.map.value
  if (map?.getLayer(props.layer.id)) stack.reflow(map)
})

onUnmounted(() => {
  stackHandle.unregister()
  stopReady()
  const map = ctx.map.value
  if (map?.getLayer(props.layer.id)) map.removeLayer(props.layer.id)
})
</script>

<template>
  <slot />
</template>
