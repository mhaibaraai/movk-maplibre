import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec'

/** 图例项：面、线、点为单色色块，gradient 为连续色带 */
export interface LegendItem {
  /** 标签文字 */
  label: string
  /** 色块形状 */
  type: 'fill' | 'line' | 'circle' | 'gradient'
  /** 单色色块颜色 */
  color?: string
  /** 渐变色带颜色，按顺序 */
  colors?: string[]
}

/** 认领底图样式图层的过滤函数，按图层特征（类型、source-layer 等）匹配 */
export type StyleLayerPredicate = (layer: LayerSpecification) => boolean

/** 插入锚点：图层 id，或在底图样式自带图层中取首个匹配的过滤函数 */
export type LayerBeforeId = string | StyleLayerPredicate

/** 图层树中的一项，对应一个带 title 的 MaplibreLayerGroup */
export interface LayerTreeItem {
  /** 组的唯一标识 */
  id: string
  /** 组标题 */
  title: string
  /** 组自身的显隐开关 */
  visible: boolean
  /** 组自身的透明度 0..1 */
  opacity: number
  /** 组自身的层级，越大越靠上 */
  zIndex: number
  /** 图例项：legend prop 优先，否则由子图层颜色推导 */
  legend: LegendItem[]
  /** 写回组的 v-model:visible */
  setVisible: (visible: boolean) => void
  /** 写回组的 v-model:opacity */
  setOpacity: (opacity: number) => void
  /** 写回组的 v-model:z-index */
  setZIndex: (zIndex: number) => void
}

/** 底图切换项 */
export interface BasemapItem {
  /** 显示名称 */
  label: string
  /** 底图样式（对象或样式 URL）；天地图可用 tiandituStyle() 生成 */
  style: StyleSpecification | string
  /** 缩略图地址；任一项提供时以网格展示 */
  thumbnail?: string
}
