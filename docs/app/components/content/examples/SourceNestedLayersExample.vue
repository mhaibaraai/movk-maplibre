<script setup lang="ts">
import type { FeatureCollection } from 'geojson'

const data: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '天安门' }, geometry: { type: 'Point', coordinates: [116.397, 39.908] } },
    { type: 'Feature', properties: { name: '国贸' }, geometry: { type: 'Point', coordinates: [116.461, 39.909] } },
    { type: 'Feature', properties: { name: '中关村' }, geometry: { type: 'Point', coordinates: [116.316, 39.983] } }
  ]
}
</script>

<template>
  <div class="h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/positron', center: [116.39, 39.93], zoom: 11 }">
      <MaplibreSource :source="{ type: 'geojson', data }">
        <MaplibreLayer type="circle" :paint="{ 'circle-radius': 18, 'circle-color': '#3b82f6', 'circle-opacity': 0.2 }" />
        <MaplibreLayer type="circle" :paint="{ 'circle-radius': 7, 'circle-color': '#3b82f6', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }">
          <MaplibreTooltip v-slot="{ feature }">
            <span v-if="feature" class="px-1 text-sm font-semibold">{{ feature.properties?.name }}</span>
          </MaplibreTooltip>
        </MaplibreLayer>
      </MaplibreSource>
    </MaplibreMap>
  </div>
</template>
