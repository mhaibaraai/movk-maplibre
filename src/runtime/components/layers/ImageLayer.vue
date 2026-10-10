<script setup lang="ts">
import { computed } from 'vue'
import type { ImageSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

const props = withDefaults(defineProps<{
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 图片地址 */
  url: string
  /** 四角经纬度：左上/右上/右下/左下 */
  coordinates: ImageSourceSpecification['coordinates']
  /**
   * 不透明度
   * @defaultValue 1
   */
  opacity?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  opacity: 1
})

const id = useStyleId('image', props.layerId)

const source = computed<ImageSourceSpecification>(() => ({
  type: 'image',
  url: props.url,
  coordinates: props.coordinates
}))
const paint = computed(() => ({ 'raster-opacity': props.opacity }))
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="raster" :source="id" :paint="paint" :before-id="beforeId" />
  </MaplibreSource>
</template>
