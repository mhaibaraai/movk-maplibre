<script setup lang="ts">
import { computed } from 'vue'
import { tiandituAnnotationFor, tiandituRasterSource, type TiandituLayerType } from '../../utils/tianditu'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import type { LayerBeforeId } from '../../types'

const props = withDefaults(defineProps<{
  /**
   * 天地图图层类型（vec 矢量底图）
   * @defaultValue 'vec'
   */
  layer?: TiandituLayerType
  /** 天地图 token；缺省时回退运行时配置 */
  tk?: string
  /** 叠加对应注记图层（vec→cva / img→cia / ter→cta） */
  annotation?: boolean
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  layer: 'vec',
  annotation: false
})

// 与类型无关的稳定 id：切换类型走 source 原地 setTiles 更新，避免整层重建
const BASE_ID = 'tianditu-base'
const ANNOTATION_ID = 'tianditu-annotation'

const source = computed(() => tiandituRasterSource(props.layer, { tk: props.tk }))

const annoType = computed(() => (props.annotation ? tiandituAnnotationFor(props.layer) : undefined))
const annoSource = computed(() => (annoType.value ? tiandituRasterSource(annoType.value, { tk: props.tk }) : undefined))
</script>

<template>
  <MaplibreSource :source-id="BASE_ID" :source="source">
    <MaplibreLayer :layer-id="BASE_ID" type="raster" :source="BASE_ID" :before-id="beforeId" />
  </MaplibreSource>
  <MaplibreSource v-if="annoSource" :source-id="ANNOTATION_ID" :source="annoSource">
    <MaplibreLayer :layer-id="ANNOTATION_ID" type="raster" :source="ANNOTATION_ID" :before-id="beforeId" />
  </MaplibreSource>
</template>
