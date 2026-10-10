<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { addProtocol, removeProtocol } from 'maplibre-gl'
import mlcontour from 'maplibre-contour'
import type { FilterSpecification, VectorSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { textFontLayout } from '../../domains/map/config'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

type DemSource = InstanceType<typeof mlcontour.DemSource>

/** 等高线：由 raster-dem 瓦片在浏览器端实时生成矢量等高线，主次线按间距区分，可沿线标注高程。 */
const props = withDefaults(defineProps<{
  /** DEM 瓦片模板（含 {z}/{x}/{y}），可与 MaplibreTerrain 共用；变更需配合 `:key` 重建 */
  demUrl: string
  /**
   * DEM 高程编码；变更需配合 `:key` 重建
   * @defaultValue 'terrarium'
   */
  encoding?: 'terrarium' | 'mapbox'
  /**
   * DEM 瓦片最大缩放级别；变更需配合 `:key` 重建
   * @defaultValue 12
   */
  maxzoom?: number
  /**
   * 缩放级别到 [次线间距, 主线间距] 的映射，未列出的级别沿用更低一级
   * @defaultValue `{ 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100] }`
   */
  thresholds?: Record<number, number | number[]>
  /**
   * 高程换算系数，如 3.28084 将米换算为英尺
   * @defaultValue 1
   */
  multiplier?: number
  /**
   * 标注的高程单位后缀
   * @defaultValue 'm'
   */
  unit?: string
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 线条颜色
   * @defaultValue '#a0522d'
   */
  lineColor?: string
  /**
   * 是否沿主线标注高程
   * @defaultValue true
   */
  labels?: boolean
  /** 覆盖合并到等高线的 paint */
  linePaint?: Record<string, unknown>
  /** 覆盖合并到标注的 layout */
  labelLayout?: Record<string, unknown>
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  encoding: 'terrarium',
  maxzoom: 12,
  thresholds: () => ({ 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100] }),
  multiplier: 1,
  unit: 'm',
  lineColor: '#a0522d',
  labels: true
})

const CONTOUR_LAYER = 'contours'

const id = useStyleId('contour', props.layerId)

// worker 模式在构造时创建 Worker，仅在客户端挂载后实例化
const demSource = shallowRef<DemSource>()

onMounted(() => {
  const source = new mlcontour.DemSource({ url: props.demUrl, encoding: props.encoding, maxzoom: props.maxzoom, worker: true })
  source.setupMaplibre({ addProtocol })
  demSource.value = source
})

onUnmounted(() => {
  if (!demSource.value) return
  removeProtocol(demSource.value.sharedDemProtocolId)
  removeProtocol(demSource.value.contourProtocolId)
})

// thresholds / multiplier 变化时 tiles 随之变化，经 MaplibreSource 增量 setTiles
const source = computed<VectorSourceSpecification | undefined>(() => demSource.value && {
  type: 'vector',
  tiles: [demSource.value.contourProtocolUrl({
    thresholds: props.thresholds,
    multiplier: props.multiplier,
    elevationKey: 'ele',
    levelKey: 'level',
    contourLayer: CONTOUR_LAYER
  })],
  maxzoom: 15
})

const paint = computed(() => ({
  'line-color': props.lineColor,
  'line-width': ['match', ['get', 'level'], 1, 1, 0.5],
  ...props.linePaint
}))
const labelPaint = computed(() => ({ 'text-color': props.lineColor, 'text-halo-color': '#fff', 'text-halo-width': 1 }))
const layout = computed(() => ({
  'symbol-placement': 'line',
  'text-field': ['concat', ['number-format', ['get', 'ele'], {}], props.unit],
  'text-size': 10,
  ...textFontLayout(),
  ...props.labelLayout
}))
const labelFilter: FilterSpecification = ['>', ['get', 'level'], 0]
</script>

<template>
  <MaplibreSource v-if="source" :source-id="id" :source="source">
    <MaplibreLayer
      :layer-id="`${id}-line`"
      type="line"
      :source="id"
      :source-layer="CONTOUR_LAYER"
      :paint="paint"
      :before-id="beforeId"
    />
    <MaplibreLayer
      v-if="labels"
      :layer-id="`${id}-label`"
      type="symbol"
      :source="id"
      :source-layer="CONTOUR_LAYER"
      :filter="labelFilter"
      :layout="layout"
      :paint="labelPaint"
      :before-id="beforeId"
    />
  </MaplibreSource>
</template>
