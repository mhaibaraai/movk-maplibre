<script setup lang="ts">
import { computed } from 'vue'
import { buffer } from '@turf/buffer'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { bufferPaints } from '../../utils/buffer'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'

/** 线缓冲区：沿线两侧扩展 width 米的走廊面。 */
const props = withDefaults(defineProps<{
  /** 线要素、几何或坐标数组 */
  line: Feature<LineString> | LineString | [number, number][]
  /** 缓冲宽度（米） */
  width: number
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
}>(), {})

const id = useStyleId('buffer-line', props.layerId)

function toFeature(line: typeof props.line): Feature<LineString> {
  if (Array.isArray(line)) {
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }
  }
  if (line.type === 'LineString') {
    return { type: 'Feature', properties: {}, geometry: line }
  }
  return line
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

const source = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  // buffer 在退化输入下可能返回 undefined，回退空集合
  data: buffer(toFeature(props.line), props.width, { units: 'meters' }) ?? EMPTY
}))

const paints = computed(() => bufferPaints({ color: props.color }))
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="`${id}-fill`" type="fill" :source="id" :paint="fillPaint ?? paints.fill" :before-id="beforeId" />
    <MaplibreLayer :layer-id="`${id}-line`" type="line" :source="id" :paint="linePaint ?? paints.line" :before-id="beforeId" />
  </MaplibreSource>
</template>
