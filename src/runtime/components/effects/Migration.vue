<script setup lang="ts">
import { computed } from 'vue'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { GeoJSONSource } from 'maplibre-gl'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { arcLine, createLineSampler, type Position2D } from '../../utils/effects'
import { useMapAnimation } from '../../composables/useMapAnimation'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

export interface MigrationRoute {
  from: Position2D
  to: Position2D
  /** 透传到弧线与粒子要素的属性 */
  properties?: Record<string, unknown>
}

/** 迁徙图：OD 对生成贝塞尔弧线，粒子沿线循环飞行 + 渐变尾迹。 */
const props = withDefaults(defineProps<{
  /** 起讫点对列表 */
  data: MigrationRoute[]
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 主色
   * @defaultValue '#f43f5e'
   */
  color?: string
  /**
   * 弧线弯曲程度
   * @defaultValue 0.3
   */
  curvature?: number
  /**
   * 单程飞行周期（毫秒）
   * @defaultValue 3000
   */
  duration?: number
  /**
   * 线宽（像素）
   * @defaultValue 2
   */
  lineWidth?: number
  /**
   * 粒子半径（像素）
   * @defaultValue 4
   */
  particleRadius?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  color: '#f43f5e',
  curvature: 0.3,
  duration: 3000,
  lineWidth: 2,
  particleRadius: 4
})

const id = useStyleId('migration', props.layerId)
const linesId = `${id}-lines`
const particlesId = `${id}-particles`

// 弧线坐标与采样器随 data 派生；采样器闭包预置长度表供每帧取位
const arcs = computed(() => props.data.map(route => ({
  coords: arcLine(route.from, route.to, { curvature: props.curvature }),
  properties: route.properties ?? {}
})))
const samplers = computed(() => arcs.value.map(arc => createLineSampler(arc.coords)))

const linesSource = computed<GeoJSONSourceSpecification>(() => ({
  type: 'geojson',
  lineMetrics: true,
  data: {
    type: 'FeatureCollection',
    features: arcs.value.map<Feature<LineString>>(arc => ({
      type: 'Feature',
      properties: arc.properties,
      geometry: { type: 'LineString', coordinates: arc.coords }
    }))
  } satisfies FeatureCollection<LineString>
}))

const particlesSource: GeoJSONSourceSpecification = {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] }
}

// 静态渐变尾迹：起点透明渐入主色
const linePaint = computed(() => ({
  'line-width': props.lineWidth,
  'line-gradient': [
    'interpolate', ['linear'], ['line-progress'],
    0, 'rgba(0, 0, 0, 0)',
    1, props.color
  ] as never
}))
const lineLayout = { 'line-cap': 'round' as const, 'line-join': 'round' as const }

const particlePaint = computed(() => ({
  'circle-color': '#ffffff',
  'circle-radius': props.particleRadius,
  'circle-stroke-color': props.color,
  'circle-stroke-width': 2
}))

useMapAnimation((map, elapsed) => {
  const source = map.getSource(particlesId) as GeoJSONSource | undefined
  if (!source) return
  const base = (elapsed % props.duration) / props.duration
  const features = samplers.value.map<Feature<Point>>((sample, index) => {
    // 各航线按序错相，避免粒子同步起飞
    const t = (base + index / Math.max(samplers.value.length, 1)) % 1
    return {
      type: 'Feature',
      properties: arcs.value[index]!.properties,
      geometry: { type: 'Point', coordinates: sample(t) }
    }
  })
  source.setData({ type: 'FeatureCollection', features })
})
</script>

<template>
  <MaplibreSource :source-id="linesId" :source="linesSource">
    <MaplibreLayer
      :layer-id="linesId"
      type="line"
      :source="linesId"
      :layout="lineLayout"
      :paint="linePaint"
      :before-id="beforeId"
    />
  </MaplibreSource>
  <MaplibreSource :source-id="particlesId" :source="particlesSource">
    <MaplibreLayer :layer-id="particlesId" type="circle" :source="particlesId" :paint="particlePaint" :before-id="beforeId" />
  </MaplibreSource>
</template>
