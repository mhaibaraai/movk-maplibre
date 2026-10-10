<script setup lang="ts">
import { computed } from 'vue'
import { sector } from '@turf/sector'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { bufferPaints } from '../../utils/buffer'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'

/** 扇形缓冲区：bearing1 → bearing2（度，正北顺时针），半径单位米。 */
const props = withDefaults(defineProps<{
  /** 圆心经纬度 */
  center: [number, number]
  /** 半径（米） */
  radius: number
  /** 起始方位角（度） */
  bearing1: number
  /** 结束方位角（度） */
  bearing2: number
  /**
   * 弧线采样段数
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
  steps: 64
})

const id = useStyleId('buffer-sector', props.layerId)

const source = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  data: sector(props.center, props.radius, props.bearing1, props.bearing2, {
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
