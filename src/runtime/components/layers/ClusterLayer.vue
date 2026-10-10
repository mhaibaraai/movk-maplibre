<script setup lang="ts">
import { computed } from 'vue'
import type { GeoJSONSource, MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { Point } from 'geojson'
import { clusterLayerSpecs } from '../../utils/cluster'
import { useMap } from '../../composables/useMap'
import { logger } from '../../utils/logger'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

type PropBag = Record<string, unknown>

const props = withDefaults(defineProps<{
  /** 点要素数据（GeoJSON 或其 URL） */
  data: GeoJSONSourceSpecification['data']
  /** source 与图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  sourceId?: string
  /**
   * 聚合半径（像素）
   * @defaultValue 50
   */
  clusterRadius?: number
  /**
   * 超过该缩放级别不再聚合
   * @defaultValue 14
   */
  clusterMaxZoom?: number
  /** 覆盖聚合圆 paint */
  clusterPaint?: PropBag
  /** 覆盖计数文字 layout */
  countLayout?: PropBag
  /** 覆盖计数文字 paint */
  countPaint?: PropBag
  /** 覆盖散点 paint */
  pointPaint?: PropBag
  /**
   * 点击聚合圆自动放大到展开级别
   * @defaultValue true
   */
  autoExpand?: boolean
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  clusterRadius: 50,
  clusterMaxZoom: 14,
  autoExpand: true
})

const emit = defineEmits<{
  clusterClick: [payload: { clusterId: number, coordinates: [number, number], expansionZoom: number }]
  pointClick: [feature: MapGeoJSONFeature]
}>()

const ctx = useMap()
const id = useStyleId('cluster', props.sourceId)

const source = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  data: props.data,
  cluster: true,
  clusterRadius: props.clusterRadius,
  clusterMaxZoom: props.clusterMaxZoom
}))

const specs = computed(() => clusterLayerSpecs({
  id,
  sourceId: id,
  clusterPaint: props.clusterPaint,
  countLayout: props.countLayout,
  countPaint: props.countPaint,
  pointPaint: props.pointPaint
}))

function onClusterClick(event: MapLayerMouseEvent): void {
  const map = ctx.map.value
  const feature = event.features?.[0]
  const clusterId = feature?.properties?.cluster_id as number | undefined
  if (!map || !feature || clusterId === undefined) return

  const coordinates = (feature.geometry as Point).coordinates as [number, number]
  const geojsonSource = map.getSource(id) as GeoJSONSource
  geojsonSource.getClusterExpansionZoom(clusterId)
    .then((expansionZoom) => {
      if (props.autoExpand) map.easeTo({ center: coordinates, zoom: expansionZoom })
      emit('clusterClick', { clusterId, coordinates, expansionZoom })
    })
    .catch(error => logger.warn('Failed to get cluster expansion zoom', error))
}

function onPointClick(event: MapLayerMouseEvent): void {
  const feature = event.features?.[0]
  if (feature) emit('pointClick', feature)
}
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer
      :layer-id="specs.clusters.id"
      type="circle"
      :source="id"
      :filter="specs.clusters.filter"
      :paint="specs.clusters.paint"
      :before-id="beforeId"
      @click="onClusterClick"
    />
    <MaplibreLayer
      :layer-id="specs.count.id"
      type="symbol"
      :source="id"
      :filter="specs.count.filter"
      :layout="specs.count.layout"
      :paint="specs.count.paint"
      :before-id="beforeId"
    />
    <MaplibreLayer
      :layer-id="specs.points.id"
      type="circle"
      :source="id"
      :filter="specs.points.filter"
      :paint="specs.points.paint"
      :before-id="beforeId"
      @click="onPointClick"
    />
  </MaplibreSource>
</template>
