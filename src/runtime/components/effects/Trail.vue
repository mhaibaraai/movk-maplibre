<script setup lang="ts">
import { computed } from 'vue'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { trailGradient } from '../../utils/effects'
import { useMapAnimation } from '../../composables/useMapAnimation'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'

/** 动态轨迹：line-gradient 彗尾窗口沿线循环平移（source 需 lineMetrics）。 */
const props = withDefaults(defineProps<{
  /** 线要素数据（GeoJSON 或其 URL） */
  data: GeoJSONSourceSpecification['data']
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 主色
   * @defaultValue '#8b5cf6'
   */
  color?: string
  /**
   * 线宽（像素）
   * @defaultValue 4
   */
  lineWidth?: number
  /**
   * 彗尾长度（line-progress 占比 0-1）
   * @defaultValue 0.25
   */
  trailLength?: number
  /**
   * 跑完全程的周期（毫秒）
   * @defaultValue 3000
   */
  duration?: number
  /**
   * 是否同时绘制半透明底线
   * @defaultValue true
   */
  baseLine?: boolean
  /** 插入到该图层之前 */
  beforeId?: string
}>(), {
  color: '#8b5cf6',
  lineWidth: 4,
  trailLength: 0.25,
  duration: 3000,
  baseLine: true
})

const id = useStyleId('trail', props.layerId)

// line-gradient 依赖 lineMetrics 计算 line-progress
const source = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  data: props.data,
  lineMetrics: true
}))

const basePaint = computed(() => ({
  'line-color': props.color,
  'line-width': Math.max(1, props.lineWidth / 2),
  'line-opacity': 0.25
}))
const trailPaint = computed(() => ({
  'line-width': props.lineWidth,
  'line-gradient': trailGradient(0, props.trailLength, props.color) as never
}))
const layout = { 'line-cap': 'round' as const, 'line-join': 'round' as const }

useMapAnimation((map, elapsed) => {
  if (!map.getLayer(id)) return
  // 头部跑 0→1+尾长后重置，彗尾完整滑出末端
  const span = 1 + props.trailLength
  const head = ((elapsed % props.duration) / props.duration) * span
  map.setPaintProperty(id, 'line-gradient', trailGradient(head, props.trailLength, props.color) as never)
})
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer
      v-if="baseLine"
      :layer-id="`${id}-base`"
      type="line"
      :source="id"
      :layout="layout"
      :paint="basePaint"
      :before-id="beforeId"
    />
    <MaplibreLayer
      :layer-id="id"
      type="line"
      :source="id"
      :layout="layout"
      :paint="trailPaint"
      :before-id="beforeId"
    />
  </MaplibreSource>
</template>
