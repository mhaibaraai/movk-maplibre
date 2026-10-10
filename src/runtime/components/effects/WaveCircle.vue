<script setup lang="ts">
import { computed } from 'vue'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { ringFade, ringProgress } from '../../utils/effects'
import { useMapAnimation } from '../../composables/useMapAnimation'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 波浪圆：常驻实心底圆 + 周期向外扩张的描边波纹。 */
const props = withDefaults(defineProps<{
  /** 点要素数据（GeoJSON 或其 URL） */
  data: GeoJSONSourceSpecification['data']
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 主色
   * @defaultValue '#10b981'
   */
  color?: string
  /**
   * 底圆半径（像素）
   * @defaultValue 6
   */
  baseRadius?: number
  /**
   * 波纹最大半径（像素）
   * @defaultValue 36
   */
  maxRadius?: number
  /**
   * 波纹周期（毫秒）
   * @defaultValue 2000
   */
  duration?: number
  /**
   * 波纹圈数
   * @defaultValue 2
   */
  rings?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  color: '#10b981',
  baseRadius: 6,
  maxRadius: 36,
  duration: 2000,
  rings: 2
})

const id = useStyleId('wave', props.layerId)
const source = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: props.data }))

const basePaint = computed(() => ({
  'circle-color': props.color,
  'circle-radius': props.baseRadius
}))
const wavePaint = computed(() => ({
  'circle-color': props.color,
  'circle-opacity': 0,
  'circle-radius': props.baseRadius,
  'circle-stroke-color': props.color,
  'circle-stroke-width': 2,
  'circle-stroke-opacity': 0
}))

useMapAnimation((map, elapsed) => {
  for (let ring = 0; ring < props.rings; ring++) {
    const layerId = `${id}-wave-${ring}`
    if (!map.getLayer(layerId)) continue
    const progress = ringProgress(ring, props.rings, elapsed, props.duration)
    map.setPaintProperty(layerId, 'circle-radius', props.baseRadius + progress * (props.maxRadius - props.baseRadius))
    map.setPaintProperty(layerId, 'circle-stroke-opacity', ringFade(progress))
  }
})
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer
      v-for="ring in rings"
      :key="ring"
      :layer-id="`${id}-wave-${ring - 1}`"
      type="circle"
      :source="id"
      :paint="wavePaint"
      :before-id="beforeId"
    />
    <MaplibreLayer :layer-id="`${id}-base`" type="circle" :source="id" :paint="basePaint" :before-id="beforeId" />
  </MaplibreSource>
</template>
