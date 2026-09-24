<script setup lang="ts">
const opacity = ref(1)
</script>

<template>
  <MapShowcase
    title="COG 云优化 GeoTIFF"
    description="nuxt.config 开启 maplibre.protocols.cog 后，MaplibreRasterLayer 的 url 直接写 cog:// 地址，浏览器端按视口读取并解码 GeoTIFF（须为 EPSG:3857）。"
  >
    <template #toolbar>
      <USlider v-model="opacity" :min="0" :max="1" :step="0.05" class="w-32" />
    </template>

    <DemoMap :center="[1.83369, 41.5937]" :zoom="14">
      <MaplibreRasterLayer
        layer-id="cog-image"
        url="cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif"
        :opacity="opacity"
      />
    </DemoMap>
  </MapShowcase>
</template>
