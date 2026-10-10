<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { GeoJSONSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { decodeAnimatedImage } from '../../utils/animated-image'
import { useMap } from '../../composables/useMap'
import { useFrameIcon } from '../../composables/useFrameIcon'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 动图图标层：ImageDecoder 解码 GIF/APNG/WebP 为帧，按各帧时长驱动 symbol 循环播放，零解码依赖。 */
const props = withDefaults(defineProps<{
  /** 点要素数据（GeoJSON 或其 URL） */
  data: GeoJSONSourceSpecification['data']
  /** 动图 URL（GIF/APNG/WebP/AVIF） */
  image: string
  /**
   * 图标边长（像素），帧统一缩放到 size×size
   * @defaultValue 64
   */
  size?: number
  /**
   * 解码无原生帧时长时的回退帧率
   * @defaultValue 12
   */
  fps?: number
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  size: 64,
  fps: 12
})

const ctx = useMap()
const id = useStyleId('animated', props.layerId)
const imageName = `${id}-frames`

const source = computed<GeoJSONSourceSpecification>(() => ({ type: 'geojson', data: props.data }))

const layout = computed(() => ({
  'icon-image': imageName,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true
}))

// 解码后的逐帧 ImageData 与每帧时长;无 ImageDecoder 环境保持空,render 自然跳过
const frames = ref<ImageData[]>([])
const durations = ref<number[]>([])

useFrameIcon({
  imageName,
  size: () => props.size,
  frames: () => frames.value,
  fps: () => props.fps,
  durations: () => durations.value
})

let loadToken = 0

async function load(): Promise<void> {
  // 竞态保护:image/size 连续变化时丢弃晚到的旧解码结果
  const token = ++loadToken
  frames.value = []
  durations.value = []
  const decoded = await decodeAnimatedImage(props.image, props.size)
  if (token !== loadToken) return
  frames.value = decoded.frames
  durations.value = decoded.durations
  // 解码晚于 onReady,就绪后触发一次以启动渲染循环
  ctx.map.value?.triggerRepaint()
}

onMounted(load)
watch([() => props.image, () => props.size], load)
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="symbol" :source="id" :layout="layout" :before-id="beforeId" />
  </MaplibreSource>
</template>
