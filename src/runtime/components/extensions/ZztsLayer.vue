<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { FitBoundsOptions, MapSourceDataEvent, RasterTileSource } from 'maplibre-gl'
import type { RasterLayerSpecification, RasterSourceSpecification } from '@maplibre/maplibre-gl-style-spec'
import { omitUndefined } from '@movk/core'
import MaplibreSource from '../Source.vue'
import MaplibreLayer from '../Layer.vue'
import { useMap } from '../../composables/useMap'
import type { MaskInput } from '../../utils/mask'
import { registerZztsProtocol } from '../../utils/zzts'
import { deleteZztsClip, setZztsClip } from '../../utils/zzts-clip'
import { ZZTS_TILE_SIZE, zztsSourceUrl } from '../../utils/zzts-tile'
import { useStyleId } from '../../domains/map/style-id'
import type { LayerBeforeId } from '../../types'

/** ZZTS 二维动态切片影像：经 zzts:// 协议拼合为 512 墨卡托瓦片，支持多边形裁剪、定位与高分屏出图，可用于 globe 与地形场景。 */
const props = withDefaults(defineProps<{
  /** media 接口地址（不含协议前缀），查询参数（`layerName`、`dictCode`、`token` 等）原样带给服务端 */
  url: string
  /**
   * 协议名；需自定义请求时先以该名称调用 `registerZztsProtocol`，否则按缺省配置自动注册
   * @defaultValue 'zzts'
   */
  scheme?: string
  /** source/layer id；省略时自动生成，变更需配合 `:key` 重建 */
  layerId?: string
  /** 显示范围：仅保留区域内的影像像素，区域外露出下层底图；孔洞（飞地）同样挖空 */
  clip?: MaskInput
  /**
   * 拼合画布倍率（1-4），设为 `devicePixelRatio` 可在高分屏下取更细一级网格
   * @defaultValue 1
   */
  pixelRatio?: number
  /**
   * 元数据加载后自动定位到图层范围（与 `clip` 求交）
   * @defaultValue false
   */
  autoFit?: boolean
  /**
   * 定位动画选项，`autoFit` 与暴露的 `fit()` 共用
   * @see https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/
   */
  fitOptions?: FitBoundsOptions
  /**
   * 不透明度
   * @defaultValue 1
   */
  opacity?: number
  /**
   * raster 图层 paint（色相、饱和度、对比度、亮度等），与 `opacity` 合并
   * @see https://maplibre.org/maplibre-style-spec/layers/#raster
   */
  paint?: RasterLayerSpecification['paint']
  /** 数据源最小缩放级别，缺省 0 */
  minzoom?: number
  /** 数据源最大缩放级别，缺省按影像原始分辨率推算，更高级别自动超采样 */
  maxzoom?: number
  /** 插入到该图层之前：图层 id，或在底图样式图层中取首个匹配的过滤函数 */
  beforeId?: LayerBeforeId
}>(), {
  scheme: 'zzts',
  pixelRatio: 1,
  autoFit: false,
  opacity: 1
})

const id = useStyleId('zzts', props.layerId)
const ctx = useMap()

// 裁剪区域按版本换键：键随 url 变化，促使 MapLibre 重载瓦片；旧键即时注销
let clipVersion = 0
const clipKey = ref(props.clip ? `${id}:0` : undefined)

function registerClip(): void {
  if (props.clip && clipKey.value) setZztsClip(clipKey.value, props.clip)
}

watch(() => props.clip, (clip) => {
  if (clipKey.value) deleteZztsClip(clipKey.value)
  clipKey.value = clip ? `${id}:${++clipVersion}` : undefined
  registerClip()
}, { deep: true })

// 先于子级 MaplibreSource 注册：就绪回调按注册顺序执行，协议与裁剪须在建源前就位
const stopReady = ctx.onReady(() => {
  registerZztsProtocol({ scheme: props.scheme })
  registerClip()
})

const sourceUrl = computed(() => zztsSourceUrl(props.scheme, props.url, { pixelRatio: props.pixelRatio, clip: clipKey.value }))
const source = computed<RasterSourceSpecification>(() => omitUndefined({
  type: 'raster' as const,
  url: sourceUrl.value,
  tileSize: ZZTS_TILE_SIZE,
  minzoom: props.minzoom,
  maxzoom: props.maxzoom
}) as RasterSourceSpecification)
const layerPaint = computed(() => ({ ...props.paint, 'raster-opacity': props.opacity }))

/** 定位到图层范围；元数据尚未加载时返回 false */
function fit(options?: FitBoundsOptions): boolean {
  const map = ctx.map.value
  const bounds = (map?.getSource(id) as RasterTileSource | undefined)?.bounds
  if (!map || !bounds) return false
  map.fitBounds(bounds, { ...props.fitOptions, ...options })
  return true
}

// 每个 source 地址只自动定位一次，切换底图重建 source 时不重复飞行
let fittedUrl: string | undefined
watch(ctx.map, (map, _, onCleanup) => {
  if (!map) return
  const onSourceData = (event: MapSourceDataEvent): void => {
    if (!props.autoFit || event.sourceId !== id || event.sourceDataType !== 'metadata') return
    if (fittedUrl === sourceUrl.value) return
    if (fit()) fittedUrl = sourceUrl.value
  }
  map.on('sourcedata', onSourceData)
  onCleanup(() => map.off('sourcedata', onSourceData))
}, { immediate: true })

onUnmounted(() => {
  stopReady()
  if (clipKey.value) deleteZztsClip(clipKey.value)
})

defineExpose({ fit })
</script>

<template>
  <MaplibreSource :source-id="id" :source="source">
    <MaplibreLayer :layer-id="id" type="raster" :source="id" :paint="layerPaint" :before-id="beforeId" />
  </MaplibreSource>
</template>
