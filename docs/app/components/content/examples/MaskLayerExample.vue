<script setup lang="ts">
import type { Polygon } from 'geojson'

withDefaults(defineProps<{ opacity?: number, outline?: boolean }>(), {
  opacity: 0.5,
  outline: true
})

// 示意区域：北京二环附近的多边形
const area: Polygon = {
  type: 'Polygon',
  coordinates: [[
    [116.35, 39.87], [116.44, 39.86], [116.45, 39.9], [116.44, 39.95],
    [116.39, 39.96], [116.35, 39.95], [116.34, 39.91], [116.35, 39.87]
  ]]
}
</script>

<template>
  <div class="h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/positron', center: [116.4, 39.91], zoom: 11.5 }">
      <MaplibreMaskLayer :data="area" :opacity="opacity" :outline="outline" outline-color="#3b82f6" :outline-width="2" />
    </MaplibreMap>
  </div>
</template>
