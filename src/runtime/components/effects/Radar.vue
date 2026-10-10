<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { radarSweepImage } from '../../utils/effects'
import { useMap } from '../../composables/useMap'
import { useMapAnimation } from '../../composables/useMapAnimation'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'

/** 雷达：canvas 生成扇形扫描贴图，symbol 图层按帧旋转。 */
const props = withDefaults(defineProps<{
  /** 点要素数据（GeoJSON 或其 URL） */
  data: GeoJSONSourceSpecification['data']
  /** 图层 id 前缀；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 主色
   * @defaultValue '#22c55e'
   */
  color?: string
  /**
   * 扫描半径（像素）
   * @defaultValue 60
   */
  radius?: number
  /**
   * 旋转速度（度/秒）
   * @defaultValue 120
   */
  speed?: number
  /** 插入到该图层之前 */
  beforeId?: string
}>(), {
  color: '#22c55e',
  radius: 60,
  speed: 120
})

// 贴图固定 256px，经 icon-size 缩放到目标半径
const IMAGE_SIZE = 256

const ctx = useMap()
const id = useStyleId('radar', props.layerId)
const imageName = `${id}-sweep`

const source = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: props.data }))

const layout = computed(() => ({
  'icon-image': imageName,
  'icon-size': (props.radius * 2) / IMAGE_SIZE,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  // 贴图随地图旋转而非屏幕，扫描方位与地理方向一致
  'icon-rotation-alignment': 'map' as const
}))

// setStyle 清空样式图片后经 onReady 自动补回
const stopReady = ctx.onReady((map) => {
  if (map.hasImage(imageName)) return
  const image = radarSweepImage(IMAGE_SIZE, props.color)
  if (image) map.addImage(imageName, image)
})

useMapAnimation((map, elapsed) => {
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'icon-rotate', ((elapsed / 1000) * props.speed) % 360)
})

onUnmounted(() => {
  stopReady()
  const map = ctx.map.value
  if (map?.hasImage(imageName)) map.removeImage(imageName)
})
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="symbol" :source="id" :layout="layout" :before-id="beforeId" />
  </MaplibreSource>
</template>
