<script setup lang="ts">
import { computed } from 'vue'
import { buildingLayerSpec } from '../../utils/building'
import type { BuildingSourceOptions } from '../../utils/building'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 3D 建筑：按要素高度属性拉伸的 fill-extrusion 图层。 */
const props = defineProps<BuildingSourceOptions & {
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 建筑颜色
   * @defaultValue '#aaa'
   */
  color?: string
  /**
   * 整体透明度
   * @defaultValue 0.8
   */
  opacity?: number
  /**
   * 显示建筑的最小缩放级别
   * @defaultValue 15
   */
  minzoom?: number
  /** 整体覆盖 paint（提供时忽略 color/opacity 预设） */
  paint?: Record<string, unknown>
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>()

const id = useStyleId('building', props.layerId)

const spec = computed(() => buildingLayerSpec({
  id,
  source: props.source,
  sourceLayer: props.sourceLayer,
  heightProperty: props.heightProperty,
  baseProperty: props.baseProperty,
  color: props.color,
  opacity: props.opacity,
  minzoom: props.minzoom,
  paint: props.paint
}))
</script>

<template>
  <MaplibreLayer
    :layer-id="id"
    type="fill-extrusion"
    :source="spec.source"
    :source-layer="spec['source-layer']"
    :minzoom="spec.minzoom"
    :paint="spec.paint"
    :before-id="beforeId"
  />
</template>
