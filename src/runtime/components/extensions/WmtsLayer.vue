<script setup lang="ts">
import { computed } from 'vue'
import { wmtsRasterSource } from '../../utils/wmts'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import type { LayerBeforeId } from '../../types'

const props = withDefaults(defineProps<{
  /** WMTS 服务基础地址；含 {s} 时配合 subdomains 展开 */
  url: string
  /** 图层标识 LAYER */
  layer: string
  /**
   * source/layer id
   * @defaultValue `wmts-${layer}`
   */
  layerId?: string
  /**
   * 瓦片矩阵集
   * @defaultValue 'w'
   */
  tileMatrixSet?: string
  /**
   * 样式
   * @defaultValue 'default'
   */
  style?: string
  /**
   * 瓦片格式
   * @defaultValue 'tiles'
   */
  format?: string
  /** 子域名列表，替换 url 中的 {s} */
  subdomains?: string[]
  /**
   * 瓦片尺寸
   * @defaultValue 256
   */
  tileSize?: number
  /** 版权信息 */
  attribution?: string
  /** 透传查询参数（如 { tk }） */
  params?: Record<string, string | undefined>
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {})

const id = computed(() => props.layerId ?? `wmts-${props.layer}`)
const source = computed(() => wmtsRasterSource({
  url: props.url,
  layer: props.layer,
  tileMatrixSet: props.tileMatrixSet,
  style: props.style,
  format: props.format,
  subdomains: props.subdomains,
  tileSize: props.tileSize,
  attribution: props.attribution,
  params: props.params
}))
</script>

<template>
  <MaplibreSource :key="id" :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="raster" :source="id" :before-id="beforeId" />
  </MaplibreSource>
</template>
