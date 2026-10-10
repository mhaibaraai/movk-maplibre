<script setup lang="ts">
import { computed } from 'vue'
import { buildingGradientPaint } from '../../utils/building-effects'
import type { BuildingSourceOptions } from '../../utils/building'
import MaplibreBuildingLayer from '../layers/BuildingLayer.vue'
import { useStyleId } from '../../domains/map/style-id'

/** 渐变建筑：按高度插值着色的 3D 建筑。 */
const props = withDefaults(defineProps<BuildingSourceOptions & {
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 高度-颜色断点 */
  stops?: [number, string][]
  /**
   * 整体透明度
   * @defaultValue 0.85
   */
  opacity?: number
  /**
   * 最小缩放级别
   * @defaultValue 15
   */
  minzoom?: number
  /** 插入到该图层之前 */
  beforeId?: string
}>(), {
  minzoom: 15
})

const id = useStyleId('gradient-building', props.layerId)
const paint = computed(() => buildingGradientPaint({
  stops: props.stops,
  opacity: props.opacity,
  minzoom: props.minzoom,
  heightProperty: props.heightProperty,
  baseProperty: props.baseProperty
}))
</script>

<template>
  <MaplibreBuildingLayer
    :layer-id="id"
    :source="source"
    :source-layer="sourceLayer"
    :height-property="heightProperty"
    :base-property="baseProperty"
    :minzoom="minzoom"
    :paint="paint"
    :before-id="beforeId"
  />
</template>
