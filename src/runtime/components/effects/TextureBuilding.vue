<script setup lang="ts">
import { computed } from 'vue'
import { useMaplibreImage } from '../../composables/useMaplibreImage'
import { buildingExtrusionPaint } from '../../utils/building'
import type { BuildingSourceOptions } from '../../utils/building'
import MaplibreBuildingLayer from '../layers/BuildingLayer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 纹理建筑：用户贴图 url 作 fill-extrusion-pattern。 */
const props = withDefaults(defineProps<BuildingSourceOptions & {
  /** 贴图地址 */
  url: string
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 整体透明度
   * @defaultValue 1
   */
  opacity?: number
  /**
   * 最小缩放级别
   * @defaultValue 15
   */
  minzoom?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  minzoom: 15
})

const id = useStyleId('texture-building', props.layerId)
const imageName = `${id}-texture`

// 复用 useMaplibreImage:加载贴图并在 setStyle 后自动补回
const { loaded } = useMaplibreImage(imageName, () => props.url)

const paint = computed(() => ({
  'fill-extrusion-pattern': imageName,
  ...buildingExtrusionPaint({ minzoom: props.minzoom, heightProperty: props.heightProperty, baseProperty: props.baseProperty }),
  'fill-extrusion-opacity': props.opacity ?? 1
}))
</script>

<template>
  <MaplibreBuildingLayer
    v-if="loaded"
    :layer-id="id"
    :source="source"
    :source-layer="sourceLayer"
    :height-property="heightProperty"
    :base-property="baseProperty"
    :minzoom="minzoom"
    :paint="paint"
    :before-id="beforeId"
  />
</template>
