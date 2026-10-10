<script setup lang="ts">
import { computed } from 'vue'
import { buffer } from '@turf/buffer'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { bufferPaints } from '../../utils/buffer'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 多边形缓冲区：向外扩展（或负值收缩）width 米。 */
const props = withDefaults(defineProps<{
  /** 面要素、几何或外环坐标数组 */
  polygon: Feature<Polygon> | Polygon | [number, number][]
  /** 缓冲宽度（米），负值向内收缩 */
  width: number
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 主色（快捷样式） */
  color?: string
  /** 整体覆盖填充 paint */
  fillPaint?: Record<string, unknown>
  /** 整体覆盖描边 paint */
  linePaint?: Record<string, unknown>
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {})

const id = useStyleId('buffer-polygon', props.layerId)

function toFeature(polygon: typeof props.polygon): Feature<Polygon> {
  if (Array.isArray(polygon)) {
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [polygon] } }
  }
  if (polygon.type === 'Polygon') {
    return { type: 'Feature', properties: {}, geometry: polygon }
  }
  return polygon
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

const source = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  // 负宽度收缩塌缩为空时 buffer 返回 undefined，回退空集合
  data: buffer(toFeature(props.polygon), props.width, { units: 'meters' }) ?? EMPTY
}))

const paints = computed(() => bufferPaints({ color: props.color }))
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="`${id}-fill`" type="fill" :source="id" :paint="fillPaint ?? paints.fill" :before-id="beforeId" />
    <MaplibreLayer :layer-id="`${id}-line`" type="line" :source="id" :paint="linePaint ?? paints.line" :before-id="beforeId" />
  </MaplibreSource>
</template>
