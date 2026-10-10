<script setup lang="ts">
import { computed } from 'vue'
import type { VideoSource } from 'maplibre-gl'
import type { VideoSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { useMap } from '../../composables/useMap'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

const props = withDefaults(defineProps<{
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 视频地址列表（多格式回退） */
  urls: string[]
  /** 四角经纬度：左上/右上/右下/左下 */
  coordinates: VideoSourceSpecification['coordinates']
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

const ctx = useMap()
const id = useStyleId('video', props.layerId)

const source = computed<VideoSourceSpecification>(() => ({
  type: 'video',
  urls: props.urls,
  coordinates: props.coordinates
}))
const paint = computed(() => ({ 'raster-opacity': props.opacity }))

function videoSource(): VideoSource | undefined {
  return ctx.map.value?.getSource(id) as VideoSource | undefined
}

defineExpose({
  /** 播放视频 */
  play: () => videoSource()?.play(),
  /** 暂停视频 */
  pause: () => videoSource()?.pause(),
  /** 底层 video 元素 */
  video: () => videoSource()?.getVideo()
})
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="raster" :source="id" :paint="paint" :before-id="beforeId" />
  </MaplibreSource>
</template>
