<script setup lang="ts">
import type { VectorSourceSpecification } from '@maplibre/maplibre-gl-style-spec'

// Protomaps 公开 demo：佛罗伦萨矢量瓦片单文件
const source: VectorSourceSpecification = {
  type: 'vector',
  url: 'pmtiles://https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles',
  attribution: '© OpenStreetMap contributors, Protomaps'
}
</script>

<template>
  <div class="h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ center: [11.255, 43.77], zoom: 13 }">
      <MaplibreSource source-id="firenze" :source="source">
        <MaplibreLayer
          layer-id="firenze-water"
          type="fill"
          source="firenze"
          source-layer="water"
          :paint="{ 'fill-color': '#93c5fd' }"
        />
        <MaplibreLayer
          layer-id="firenze-buildings"
          type="fill"
          source="firenze"
          source-layer="buildings"
          :paint="{ 'fill-color': '#d6d3d1' }"
        />
        <MaplibreLayer
          layer-id="firenze-roads"
          type="line"
          source="firenze"
          source-layer="roads"
          :paint="{ 'line-color': '#78716c', 'line-width': 1 }"
        />
      </MaplibreSource>
    </MaplibreMap>
  </div>
</template>
