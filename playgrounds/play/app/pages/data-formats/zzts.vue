<script setup lang="ts">
import type { Polygon } from 'geojson'
import type { RasterDEMSourceSpecification } from '@maplibre/maplibre-gl-style-spec'

const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const dem: RasterDEMSourceSpecification = { type: 'raster-dem', tiles: [DEM_URL], encoding: 'terrarium', tileSize: 256, maxzoom: 15 }

// 镇海城区附近的示意裁剪区域，内含一处孔洞用于验证飞地挖空
const district: Polygon = {
  type: 'Polygon',
  coordinates: [
    [[121.55, 29.93], [121.72, 29.93], [121.72, 30.03], [121.55, 30.03], [121.55, 29.93]],
    [[121.6, 29.96], [121.64, 29.96], [121.64, 29.99], [121.6, 29.99], [121.6, 29.96]]
  ]
}

const mediaUrl = ref('')
const opacity = ref(1)
const globe = ref(false)
const terrain = ref(false)
const clipped = ref(false)
const hidpi = ref(false)
const pitch = ref(0)
const imagery = useTemplateRef('imagery')

// 统计 elements 请求数，用于对比合并请求的效果
const elementRequests = ref(0)
onMounted(() => {
  const observer = new PerformanceObserver((list) => {
    elementRequests.value += list.getEntries().filter(entry => entry.name.includes('/elements?')).length
  })
  observer.observe({ type: 'resource', buffered: false })
  onUnmounted(() => observer.disconnect())
})
</script>

<template>
  <MapShowcase
    title="ZZTS 动态切片"
    description="MaplibreZztsLayer 经 zzts:// 协议把 GeoSOT 网格图片拼合为 512 墨卡托瓦片；可切换 globe、地形、俯仰、裁剪与高分屏出图验证 3D 场景。"
    :state="{ globe, terrain, clipped, hidpi, pitch, elementRequests }"
  >
    <template #toolbar>
      <UInput v-model.lazy="mediaUrl" placeholder="media 接口地址（含 layerName、dictCode）" class="w-96" />
      <USlider v-model="opacity" :min="0" :max="1" :step="0.05" class="w-32" />
      <USlider v-model="pitch" :min="0" :max="85" :step="5" class="w-32" />
      <USwitch v-model="globe" label="Globe" />
      <USwitch v-model="terrain" label="地形" />
      <USwitch v-model="clipped" label="裁剪" />
      <USwitch v-model="hidpi" label="高分屏" />
      <UButton label="定位" size="sm" :disabled="!mediaUrl" @click="imagery?.fit()" />
    </template>

    <MaplibreMap v-model:pitch="pitch" :options="{ center: [121.6, 29.98], zoom: 11, maxPitch: 85 }">
      <MaplibreTiandituLayer layer="vec" annotation />
      <MaplibreProjection v-if="globe" type="globe" />
      <MaplibreTerrain v-if="terrain" :source="dem" :exaggeration="1.5" />
      <MaplibreZztsLayer
        v-if="mediaUrl"
        ref="imagery"
        :key="mediaUrl"
        layer-id="zzts-image"
        :url="mediaUrl"
        :opacity="opacity"
        :clip="clipped ? district : undefined"
        :pixel-ratio="hidpi ? 2 : 1"
        auto-fit
      />
    </MaplibreMap>
  </MapShowcase>
</template>
