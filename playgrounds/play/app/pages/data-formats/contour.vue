<script setup lang="ts">
import type { RasterDEMSourceSpecification } from '@maplibre/maplibre-gl-style-spec'

const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

const visible = ref(true)
const opacity = ref(1)
const feet = ref(false)

// 等高线与 3D 地形共用同一套 Terrarium DEM
const dem: RasterDEMSourceSpecification = { type: 'raster-dem', tiles: [DEM_URL], encoding: 'terrarium', tileSize: 256, maxzoom: 15 }
</script>

<template>
  <MapShowcase
    title="Contour 实时等高线"
    description="MaplibreContourLayer 由 DEM 瓦片在 worker 中生成等高线，主次线按缩放切换间距；放在 MaplibreLayerGroup 中随组显隐与透明度联动。"
    :state="{ visible, opacity, unit: feet ? 'ft' : 'm' }"
  >
    <template #toolbar>
      <USwitch v-model="visible" label="显示" />
      <USwitch v-model="feet" label="英尺" />
      <USlider v-model="opacity" :min="0" :max="1" :step="0.05" class="w-32" />
    </template>

    <MaplibreMap :options="{ center: [86.925, 27.99], zoom: 12, pitch: 50, maxPitch: 85 }">
      <MaplibreTiandituLayer layer="img" annotation />
      <MaplibreTerrain :source="dem" :exaggeration="1.2" />
      <MaplibreLayerGroup v-model:visible="visible" v-model:opacity="opacity" title="等高线">
        <MaplibreContourLayer
          layer-id="everest-contour"
          :dem-url="DEM_URL"
          line-color="#fde68a"
          :multiplier="feet ? 3.28084 : 1"
          :unit="feet ? 'ft' : 'm'"
          :thresholds="feet ? { 11: [500, 2500], 12: [250, 1000], 14: [100, 500] } : undefined"
        />
      </MaplibreLayerGroup>
    </MaplibreMap>
  </MapShowcase>
</template>
