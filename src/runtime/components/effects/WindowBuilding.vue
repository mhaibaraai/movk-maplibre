<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { windowTextureImage } from '../../utils/building-effects'
import { useMap } from '../../composables/useMap'
import { buildingExtrusionPaint } from '../../utils/building'
import type { BuildingSourceOptions } from '../../utils/building'
import MaplibreBuildingLayer from '../layers/BuildingLayer.vue'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** 窗户建筑：程序生成窗户点阵贴图 fill-extrusion-pattern。 */
const props = withDefaults(defineProps<BuildingSourceOptions & {
  /** 图层 id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /**
   * 窗户行数
   * @defaultValue 8
   */
  rows?: number
  /**
   * 窗户列数
   * @defaultValue 6
   */
  cols?: number
  /**
   * 亮窗颜色
   * @defaultValue '#fde68a'
   */
  litColor?: string
  /**
   * 暗窗/墙体颜色
   * @defaultValue '#1f2937'
   */
  darkColor?: string
  /**
   * 亮窗比例
   * @defaultValue 0.45
   */
  litRatio?: number
  /**
   * 随机种子
   * @defaultValue 1
   */
  seed?: number
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

const ctx = useMap()
const id = useStyleId('window-building', props.layerId)
const imageName = `${id}-pattern`

const paint = computed(() => ({
  'fill-extrusion-pattern': imageName,
  ...buildingExtrusionPaint({ minzoom: props.minzoom, heightProperty: props.heightProperty, baseProperty: props.baseProperty }),
  'fill-extrusion-opacity': props.opacity ?? 1
}))

// setStyle 清空样式图片后经 onReady 自动补回(同 Radar 模式)
const stopReady = ctx.onReady((map) => {
  if (map.hasImage(imageName)) return
  const image = windowTextureImage({
    rows: props.rows,
    cols: props.cols,
    litColor: props.litColor,
    darkColor: props.darkColor,
    litRatio: props.litRatio,
    seed: props.seed
  })
  if (image) map.addImage(imageName, image)
})

onUnmounted(() => {
  stopReady()
  const map = ctx.map.value
  if (map?.hasImage(imageName)) map.removeImage(imageName)
})
</script>

<template>
  <MaplibreBuildingLayer
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
