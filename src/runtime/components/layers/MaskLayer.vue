<script setup lang="ts">
import { computed } from 'vue'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import MaplibreLayer from '../Layer.vue'
import { maskPolygon, type MaskInput } from '../../utils/mask'
import { useStyleId } from '../../domains/map/style-id'

/** 区域遮罩：压暗目标区域以外的范围，突出显示行政区等面状区域。 */
const props = withDefaults(defineProps<{
  /** 目标区域：Polygon / MultiPolygon / Feature / FeatureCollection；区域自身的孔洞（飞地）不参与遮罩 */
  data: MaskInput
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 遮罩颜色
   * @defaultValue '#000'
   */
  color?: string
  /**
   * 遮罩不透明度
   * @defaultValue 0.5
   */
  opacity?: number
  /**
   * 是否描绘目标区域边界
   * @defaultValue false
   */
  outline?: boolean
  /**
   * 边界颜色
   * @defaultValue '#fff'
   */
  outlineColor?: string
  /**
   * 边界宽度（像素）
   * @defaultValue 1
   */
  outlineWidth?: number
  /** 插入到该图层之前 */
  beforeId?: string
}>(), {
  color: '#000',
  opacity: 0.5,
  outline: false,
  outlineColor: '#fff',
  outlineWidth: 1
})

const id = useStyleId('mask', props.layerId)

const maskSource = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: maskPolygon(props.data) }))
const outlineSource = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: props.data }))
const fillPaint = computed(() => ({ 'fill-color': props.color, 'fill-opacity': props.opacity }))
const linePaint = computed(() => ({ 'line-color': props.outlineColor, 'line-width': props.outlineWidth }))
</script>

<template>
  <MaplibreLayer :layer-id="`${id}-fill`" type="fill" :source="maskSource" :paint="fillPaint" :before-id="beforeId" />
  <MaplibreLayer
    v-if="outline"
    :layer-id="`${id}-line`"
    type="line"
    :source="outlineSource"
    :paint="linePaint"
    :before-id="beforeId"
  />
</template>
