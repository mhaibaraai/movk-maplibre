<script setup lang="ts">
const mediaUrl = ref('')
const opacity = ref(1)
</script>

<template>
  <MapShowcase
    title="ZZTS 动态切片"
    description="nuxt.config 开启 maplibre.protocols.zzts 后，MaplibreRasterLayer 的 url 写 zzts:// + media 接口地址，协议把 GeoSOT 网格图片拼合为 512 墨卡托瓦片。"
  >
    <template #toolbar>
      <UInput v-model.lazy="mediaUrl" placeholder="media 接口地址（含 layerName、dictCode）" class="w-96" />
      <USlider v-model="opacity" :min="0" :max="1" :step="0.05" class="w-32" />
    </template>

    <DemoMap :center="[121.6, 29.98]" :zoom="11">
      <MaplibreRasterLayer
        v-if="mediaUrl"
        :key="mediaUrl"
        layer-id="zzts-image"
        :url="`zzts://${mediaUrl}`"
        :tile-size="512"
        :opacity="opacity"
      />
    </DemoMap>
  </MapShowcase>
</template>
