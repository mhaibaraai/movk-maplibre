<script setup lang="ts">
import type { FeatureCollection } from 'geojson'
import type { LayerSpecification } from 'maplibre-gl'

const belowLabels = ref(true)

// 按图层特征匹配底图注记，换一套样式同样适用；提到 script 中避免每次渲染生成新函数
const isLabel = (layer: LayerSpecification) => layer.type === 'symbol'

const data: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[116.37, 39.93], [116.43, 39.93], [116.43, 39.89], [116.37, 39.89], [116.37, 39.93]]] } }]
}
</script>

<template>
  <div class="relative h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/liberty', center: [116.4, 39.91], zoom: 13 }">
      <MaplibreLayerGroup :before-id="belowLabels ? isLabel : undefined">
        <MaplibreLayer type="fill" :source="{ type: 'geojson', data }" :paint="{ 'fill-color': '#f43f5e', 'fill-opacity': 0.8 }" />
      </MaplibreLayerGroup>
    </MaplibreMap>
    <div class="absolute left-3 top-3 z-10 rounded-md bg-default/90 p-2 ring ring-default">
      <USwitch v-model="belowLabels" label="压在注记下方" size="sm" />
    </div>
  </div>
</template>
