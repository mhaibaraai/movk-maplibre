<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import type { Map as MaplibreMap } from 'maplibre-gl'
import type { FeatureCollection, LineString, Point } from 'geojson'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import MaplibreLayer from '../Layer.vue'
import { useMap } from '../../composables/useMap'
import { textFontLayout } from '../../domains/map/config'
import { graticuleLabels, graticuleLines, graticuleStep, type Bounds } from '../../utils/graticule'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 经纬网：按缩放级别自动选择步长，平移缩放后按视口重算，球形投影下呈曲线。 */
const props = withDefaults(defineProps<{
  /** 固定步长（度）；省略时按缩放级别自动选择 */
  step?: number
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 线条与标注颜色
   * @defaultValue '#888'
   */
  color?: string
  /**
   * 线宽（像素）
   * @defaultValue 0.5
   */
  width?: number
  /**
   * 是否在视口边缘标注度数
   * @defaultValue true
   */
  labels?: boolean
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  color: '#888',
  width: 0.5,
  labels: true
})

// 球形投影低缩放级别下 getBounds 不可靠，直接使用全球范围
const WORLD: Bounds = [-180, -85, 180, 85]
const WORLD_ZOOM = 3

const id = useStyleId('graticule', props.layerId)
const ctx = useMap()

const lines = shallowRef<FeatureCollection<LineString>>({ type: 'FeatureCollection', features: [] })
const labelData = shallowRef<FeatureCollection<Point>>({ type: 'FeatureCollection', features: [] })
let current: { extent: Bounds, step: number } | undefined

function viewBounds(map: MaplibreMap): Bounds {
  if (map.getZoom() < WORLD_ZOOM) return WORLD
  const bounds = map.getBounds()
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
}

// 世界视图的西南角在球体背面，标注改为沿地图中心排布
function labelAnchor(map: MaplibreMap, [west, south]: Bounds): [number, number] {
  if (map.getZoom() >= WORLD_ZOOM) return [west, south]
  const { lng, lat } = map.getCenter()
  return [lng, lat]
}

function contains([west, south, east, north]: Bounds, [w, s, e, n]: Bounds): boolean {
  return w >= west && s >= south && e <= east && n <= north
}

function update(map: MaplibreMap): void {
  const bounds = viewBounds(map)
  const step = props.step ?? graticuleStep(map.getZoom())
  // 视口仍在外扩范围内且步长不变时沿用线条，避免小幅拖动重算
  if (!current || current.step !== step || !contains(current.extent, bounds)) {
    const next = graticuleLines(bounds, step)
    current = { extent: next.extent, step }
    lines.value = next.data
  }
  if (props.labels) labelData.value = graticuleLabels(bounds, step, labelAnchor(map, bounds))
}

let boundMap: MaplibreMap | undefined
const onMoveEnd = () => boundMap && update(boundMap)

// style.load 后 onReady 重跑：先解绑再绑定，避免监听堆叠
const stopReady = ctx.onReady((map) => {
  boundMap?.off('moveend', onMoveEnd)
  boundMap = map
  map.on('moveend', onMoveEnd)
  current = undefined
  update(map)
})

watch(() => [props.step, props.labels], () => {
  current = undefined
  if (boundMap) update(boundMap)
})

onUnmounted(() => {
  stopReady()
  boundMap?.off('moveend', onMoveEnd)
  boundMap = undefined
})

// 关闭简化：共线的加密点被简化为端点后，长线段在瓦片裁剪与球形投影下会丢失
const lineSource = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: lines.value, tolerance: 0 }))
const labelSource = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: labelData.value }))
const linePaint = computed(() => ({ 'line-color': props.color, 'line-width': props.width }))
const labelPaint = computed(() => ({ 'text-color': props.color, 'text-halo-color': '#fff', 'text-halo-width': 1 }))
const labelLayout = {
  'text-field': ['get', 'label'],
  'text-size': 10,
  'text-anchor': ['match', ['get', 'axis'], 'lon', 'bottom', 'left'],
  'text-offset': ['match', ['get', 'axis'], 'lon', ['literal', [0, -0.3]], ['literal', [0.3, 0]]],
  'text-allow-overlap': true,
  ...textFontLayout()
}
</script>

<template>
  <MaplibreLayer :layer-id="`${id}-line`" type="line" :source="lineSource" :paint="linePaint" :before-id="beforeId" />
  <MaplibreLayer
    v-if="labels"
    :layer-id="`${id}-label`"
    type="symbol"
    :source="labelSource"
    :layout="labelLayout"
    :paint="labelPaint"
    :before-id="beforeId"
  />
</template>
