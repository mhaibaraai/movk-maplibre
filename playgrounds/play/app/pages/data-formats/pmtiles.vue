<script setup lang="ts">
import type { VectorSourceSpecification } from '@maplibre/maplibre-gl-style-spec'

// Protomaps 公开 demo：佛罗伦萨矢量瓦片单文件（Protomaps basemap schema）
const source: VectorSourceSpecification = {
  type: 'vector',
  url: 'pmtiles://https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles',
  attribution: '© OpenStreetMap contributors, Protomaps'
}
</script>

<template>
  <MapShowcase
    title="PMTiles 单文件瓦片"
    description="nuxt.config 开启 maplibre.protocols.pmtiles 后，vector / raster 源的 url 直接写 pmtiles:// 地址，经 HTTP Range 按需读取单个 .pmtiles 文件。"
  >
    <MaplibreMap :options="{ center: [11.255, 43.77], zoom: 13 }">
      <MaplibreSource source-id="firenze" :source="source">
        <MaplibreLayer layer-id="firenze-water" type="fill" source="firenze" source-layer="water" :paint="{ 'fill-color': '#93c5fd' }" />
        <MaplibreLayer layer-id="firenze-buildings" type="fill" source="firenze" source-layer="buildings" :paint="{ 'fill-color': '#d6d3d1', 'fill-outline-color': '#a8a29e' }" />
        <MaplibreLayer layer-id="firenze-roads" type="line" source="firenze" source-layer="roads" :paint="{ 'line-color': '#78716c', 'line-width': 1 }" />
      </MaplibreSource>
    </MaplibreMap>
  </MapShowcase>
</template>
