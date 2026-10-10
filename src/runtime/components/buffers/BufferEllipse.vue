<script setup lang="ts">
import { computed } from 'vue'
import { ellipse } from '@turf/ellipse'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { bufferPaints } from '../../utils/buffer'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'

/** 椭圆缓冲区：半轴单位米，angle 为长轴方位角。 */
const props = withDefaults(defineProps<{
  /** 中心经纬度 */
  center: [number, number]
  /** x 半轴（米） */
  xSemiAxis: number
  /** y 半轴（米） */
  ySemiAxis: number
  /**
   * 旋转角（度，正北顺时针）
   * @defaultValue 0
   */
  angle?: number
  /**
   * 周长采样段数
   * @defaultValue 64
   */
  steps?: number
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 主色（快捷样式） */
  color?: string
  /** 整体覆盖填充 paint */
  fillPaint?: Record<string, unknown>
  /** 整体覆盖描边 paint */
  linePaint?: Record<string, unknown>
  /** 插入到该图层之前 */
  beforeId?: string
}>(), {
  angle: 0,
  steps: 64
})

const id = useStyleId('buffer-ellipse', props.layerId)

const source = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  data: ellipse(props.center, props.xSemiAxis, props.ySemiAxis, {
    angle: props.angle,
    steps: props.steps,
    units: 'meters'
  })
}))

const paints = computed(() => bufferPaints({ color: props.color }))
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="`${id}-fill`" type="fill" :source="id" :paint="fillPaint ?? paints.fill" :before-id="beforeId" />
    <MaplibreLayer :layer-id="`${id}-line`" type="line" :source="id" :paint="linePaint ?? paints.line" :before-id="beforeId" />
  </MaplibreSource>
</template>
