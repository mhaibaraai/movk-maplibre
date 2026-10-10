<script setup lang="ts">
import { computed } from 'vue'
import { wmsRasterSource } from '../../utils/wms'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import type { LayerBeforeId } from '../../types'

const props = withDefaults(defineProps<{
  /** WMS 服务基础地址 */
  url: string
  /** 图层 LAYERS（逗号分隔多层） */
  layers: string
  /**
   * source/layer id
   * @defaultValue `wms-${layers}`
   */
  layerId?: string
  /**
   * WMS 版本
   * @defaultValue '1.1.1'
   */
  version?: string
  /**
   * 图片格式
   * @defaultValue 'image/png'
   */
  format?: string
  /**
   * 是否透明
   * @defaultValue true
   */
  transparent?: boolean
  /**
   * 样式
   * @defaultValue ''
   */
  styles?: string
  /**
   * 坐标参考系
   * @defaultValue 'EPSG:3857'
   */
  crs?: string
  /**
   * 瓦片尺寸
   * @defaultValue 256
   */
  tileSize?: number
  /** 版权信息 */
  attribution?: string
  /** 透传查询参数 */
  params?: Record<string, string | undefined>
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {})

const id = computed(() => props.layerId ?? `wms-${props.layers}`)
const source = computed(() => wmsRasterSource({
  url: props.url,
  layers: props.layers,
  version: props.version,
  format: props.format,
  transparent: props.transparent,
  styles: props.styles,
  crs: props.crs,
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
