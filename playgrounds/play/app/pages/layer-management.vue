<script setup lang="ts">
import type { FeatureCollection } from 'geojson'
import type { LayerSpecification } from 'maplibre-gl'
import type { BasemapItem } from '#maplibre/types'
import { tiandituStyle } from '#maplibre/utils/tianditu'

const mapId = 'layer-management-demo'

const basemaps: BasemapItem[] = [
  { label: 'OpenFreeMap Liberty', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { label: 'OpenFreeMap Positron', style: 'https://tiles.openfreemap.org/styles/positron' },
  { label: 'OpenFreeMap Dark', style: 'https://tiles.openfreemap.org/styles/dark' },
  { label: '天地图 影像', style: tiandituStyle('img', { annotation: true }) },
  { label: '天地图 矢量', style: tiandituStyle('vec', { annotation: true }) }
]
const style = shallowRef(basemaps[0]!.style)

const schools: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { kind: '小学' }, geometry: { type: 'Point', coordinates: [116.38, 39.92] } },
    { type: 'Feature', properties: { kind: '中学' }, geometry: { type: 'Point', coordinates: [116.42, 39.9] } },
    { type: 'Feature', properties: { kind: '大学' }, geometry: { type: 'Point', coordinates: [116.35, 39.96] } }
  ]
}

const districts: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { pop: 60 }, geometry: { type: 'Polygon', coordinates: [[[116.34, 39.88], [116.38, 39.88], [116.38, 39.91], [116.34, 39.91], [116.34, 39.88]]] } },
    { type: 'Feature', properties: { pop: 240 }, geometry: { type: 'Polygon', coordinates: [[[116.39, 39.88], [116.43, 39.88], [116.43, 39.91], [116.39, 39.91], [116.39, 39.88]]] } },
    { type: 'Feature', properties: { pop: 800 }, geometry: { type: 'Polygon', coordinates: [[[116.44, 39.88], [116.48, 39.88], [116.48, 39.91], [116.44, 39.91], [116.44, 39.88]]] } }
  ]
}

// 矢量样式的文字图层，或天地图注记栅格图层（tianditu-cva / cia / cta）
const isLabel = (layer: LayerSpecification) => layer.type === 'symbol' || /^tianditu-c[vit]a$/.test(layer.id)
const isRoad = (layer: LayerSpecification) => 'source-layer' in layer && layer['source-layer'] === 'transportation'

const tree = useLayerTree({ mapId })

// 业务图层组的层级（越大越靠上）；侧栏上移、下移经 setZIndex 写回
const zIndex = reactive({ districts: 1, schools: 2 })
const services = computed(() => tree.value.filter(item => item.title === '人口片区' || item.title === '学校'))

function move(index: number, offset: -1 | 1): void {
  const current = services.value[index]
  const target = services.value[index + offset]
  if (!current || !target) return
  const { zIndex: currentZ } = current
  current.setZIndex(target.zIndex)
  target.setZIndex(currentZ)
}
</script>

<template>
  <MapShowcase
    title="图层管理"
    description="MaplibreLayerGroup 是唯一数据源：图层控件、图例与右侧 useLayerTree 侧栏读写同一份 v-model；业务图层按 zIndex 排序并经谓词 beforeId 压在底图注记下方，底图切换后顺序与状态保留。天地图道路绘制在底图瓦片中，无法单独控制。"
  >
    <MaplibreMap :map-id="mapId" :options="{ style, center: [116.41, 39.91], zoom: 11.5 }">
      <MaplibreLayerGroup v-model:z-index="zIndex.districts" title="人口片区" :opacity="0.7" :before-id="isLabel">
        <MaplibreLayer
          type="fill"
          :source="{ type: 'geojson', data: districts }"
          :paint="{ 'fill-color': ['step', ['get', 'pop'], '#fde68a', 100, '#f59e0b', 500, '#b45309'], 'fill-opacity': 0.8 }"
        />
      </MaplibreLayerGroup>
      <MaplibreLayerGroup v-model:z-index="zIndex.schools" title="学校" :before-id="isLabel">
        <MaplibreLayer
          type="circle"
          :source="{ type: 'geojson', data: schools }"
          :paint="{ 'circle-radius': 8, 'circle-color': ['match', ['get', 'kind'], '小学', '#22c55e', '中学', '#3b82f6', '大学', '#a855f7', '#999'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }"
        />
      </MaplibreLayerGroup>
      <MaplibreLayerGroup title="底图注记" :style-layers="isLabel" :legend="[]" />
      <MaplibreLayerGroup title="底图道路" :style-layers="isRoad" :legend="[]" />

      <MaplibreBasemapControl v-model="style" :items="basemaps" position="top-right" />
      <MaplibreLayerControl position="top-left" />
      <MaplibreLegend position="bottom-left" />
      <MaplibreNavigationControl position="top-right" />
    </MaplibreMap>

    <template #aside>
      <div class="flex flex-col gap-3 rounded-lg border border-default bg-default p-3">
        <p class="text-xs font-medium uppercase text-dimmed">
          useLayerTree 侧栏
        </p>
        <div v-for="item in tree" :key="item.id" class="flex flex-col gap-1">
          <USwitch :model-value="item.visible" :label="item.title" @update:model-value="item.setVisible($event)" />
          <USlider
            :model-value="item.opacity"
            :min="0"
            :max="1"
            :step="0.05"
            size="sm"
            :disabled="!item.visible"
            @update:model-value="item.setOpacity($event ?? 1)"
          />
        </div>
        <p class="text-xs font-medium uppercase text-dimmed">
          业务图层顺序
        </p>
        <div v-for="(item, index) in services" :key="item.id" class="flex items-center gap-2 text-sm">
          <span class="flex-1">{{ item.title }}</span>
          <UButton
            icon="i-lucide-arrow-up"
            size="xs"
            variant="ghost"
            color="neutral"
            :disabled="index === 0"
            @click="move(index, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            size="xs"
            variant="ghost"
            color="neutral"
            :disabled="index === services.length - 1"
            @click="move(index, 1)"
          />
        </div>
      </div>
    </template>
  </MapShowcase>
</template>
