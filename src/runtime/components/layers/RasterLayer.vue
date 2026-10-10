<script setup lang="ts">
import { computed } from 'vue'
import { omitUndefined } from '@movk/core'
import type { RasterSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { logger } from '../../utils/logger'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

const props = withDefaults(defineProps<{
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** URL 模板瓦片地址（{z}/{x}/{y} 占位）；与 `url` 至少提供一个 */
  tiles?: string[]
  /** TileJSON 地址或协议地址（如 `cog://https://.../image.tif`）；与 `tiles` 至少提供一个 */
  url?: string
  /**
   * 瓦片尺寸
   * @defaultValue 256
   */
  tileSize?: number
  /**
   * 瓦片坐标方案
   * @defaultValue 'xyz'
   */
  scheme?: 'xyz' | 'tms'
  /** 数据源最小缩放级别 */
  minzoom?: number
  /** 数据源最大缩放级别 */
  maxzoom?: number
  /** 版权信息 */
  attribution?: string
  /**
   * 不透明度
   * @defaultValue 1
   */
  opacity?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  tileSize: 256,
  opacity: 1
})

const id = useStyleId('raster', props.layerId)

const hasSource = computed(() => !!props.url || !!props.tiles?.length)
if (!hasSource.value) {
  logger.warn('MaplibreRasterLayer: provide either "url" or "tiles".')
}

const source = computed<RasterSourceSpecification>(() => omitUndefined({
  type: 'raster' as const,
  tiles: props.tiles,
  url: props.url,
  tileSize: props.tileSize,
  scheme: props.scheme,
  minzoom: props.minzoom,
  maxzoom: props.maxzoom,
  attribution: props.attribution
}) as RasterSourceSpecification)
const paint = computed(() => ({ 'raster-opacity': props.opacity }))
</script>

<template>
  <MaplibreSource v-if="hasSource" :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="raster" :source="id" :paint="paint" :before-id="beforeId" />
  </MaplibreSource>
</template>
