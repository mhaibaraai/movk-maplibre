<script setup lang="ts">
import { computed } from 'vue'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { heatmapPaint } from '../../utils/heatmap'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 温度热力层：GeoJSON 点按温度属性渲染 maplibre 原生 heatmap。 */
const props = withDefaults(defineProps<{
  /** 点要素数据（GeoJSON 或其 URL） */
  data: GeoJSONSourceSpecification['data']
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 权重取值的要素属性
   * @defaultValue 'temperature'
   */
  weightProperty?: string
  /**
   * 温度取值范围 [min, max]，线性映射到热力权重
   * @defaultValue `[0, 40]`
   */
  weightRange?: [number, number]
  /** 密度-颜色断点；缺省为蓝→红五档 */
  colorStops?: [number, string][]
  /**
   * 热力半径（像素）
   * @defaultValue 30
   */
  radius?: number
  /**
   * 热力强度
   * @defaultValue 1
   */
  intensity?: number
  /**
   * 不透明度
   * @defaultValue 1
   */
  opacity?: number
  /** 超过该缩放级别隐藏热力（通常切到点图）；省略不限制 */
  maxzoom?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  weightProperty: 'temperature',
  radius: 30,
  intensity: 1,
  opacity: 1
})

const id = useStyleId('temperature', props.layerId)

const source = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: props.data }))

const paint = computed(() => heatmapPaint({
  weightProperty: props.weightProperty,
  weightRange: props.weightRange,
  colorStops: props.colorStops,
  radius: props.radius,
  intensity: props.intensity,
  opacity: props.opacity
}))
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer
      :layer-id="id"
      type="heatmap"
      :source="id"
      :paint="paint"
      :maxzoom="maxzoom"
      :before-id="beforeId"
    />
  </MaplibreSource>
</template>
