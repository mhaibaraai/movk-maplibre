<script setup lang="ts">
withDefaults(defineProps<{ opacity?: number }>(), {
  opacity: 1
})
</script>

<template>
  <div class="h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/positron', center: [1.83369, 41.5937], zoom: 14 }">
      <!-- COG 须为 EPSG:3857；tileSize 保持 256 与协议输出一致 -->
      <MaplibreRasterLayer url="cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif" :opacity="opacity" />
    </MaplibreMap>
  </div>
</template>
