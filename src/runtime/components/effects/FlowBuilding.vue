<script setup lang="ts">
import { computed } from 'vue'
import { buildingGradientPaint } from '../../utils/building-effects'
import { useMapAnimation } from '../../composables/useMapAnimation'
import { DEFAULT_HEIGHT_PROPERTY } from '../../utils/building'
import type { BuildingSourceOptions } from '../../utils/building'
import MaplibreBuildingLayer from '../layers/BuildingLayer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 流动建筑：渐变着色 + 高亮带沿建筑高度循环流动。 */
const props = withDefaults(defineProps<BuildingSourceOptions & {
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 基色
   * @defaultValue '#1e3a8a'
   */
  color?: string
  /**
   * 流动高亮色
   * @defaultValue '#67e8f9'
   */
  flowColor?: string
  /**
   * 流动周期（毫秒）
   * @defaultValue 3000
   */
  duration?: number
  /**
   * 高亮带覆盖的高度范围（米）
   * @defaultValue 60
   */
  bandHeight?: number
  /**
   * 建筑最大参考高度（米）
   * @defaultValue 300
   */
  maxHeight?: number
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
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  color: '#1e3a8a',
  flowColor: '#67e8f9',
  duration: 3000,
  bandHeight: 60,
  maxHeight: 300,
  minzoom: 15
})

const id = useStyleId('flow-building', props.layerId)

const initialPaint = computed(() => buildingGradientPaint({
  stops: [[0, props.color], [props.maxHeight, props.color]],
  opacity: props.opacity,
  minzoom: props.minzoom,
  heightProperty: props.heightProperty,
  baseProperty: props.baseProperty
}))

// 高亮带中心沿 0→maxHeight 循环平移,band 内插值到 flowColor
useMapAnimation((map, elapsed) => {
  if (!map.getLayer(id)) return
  const center = ((elapsed % props.duration) / props.duration) * props.maxHeight
  const lo = Math.max(center - props.bandHeight / 2, 0)
  const hi = center + props.bandHeight / 2
  map.setPaintProperty(id, 'fill-extrusion-color', [
    'interpolate', ['linear'], ['get', props.heightProperty ?? DEFAULT_HEIGHT_PROPERTY],
    Math.max(lo - 1, 0), props.color,
    lo, props.color,
    center, props.flowColor,
    hi, props.color,
    hi + 1, props.color
  ])
})
</script>

<template>
  <MaplibreBuildingLayer
    :layer-id="id"
    :source="source"
    :source-layer="sourceLayer"
    :height-property="heightProperty"
    :base-property="baseProperty"
    :minzoom="minzoom"
    :paint="initialPaint"
    :before-id="beforeId"
  />
</template>
