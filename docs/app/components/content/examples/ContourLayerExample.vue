<script setup lang="ts">
withDefaults(defineProps<{ lineColor?: string, labels?: boolean }>(), {
  lineColor: '#fde68a',
  labels: true
})

// 公开 Terrarium 编码高程瓦片，无需 key
const demUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
</script>

<template>
  <div class="h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ center: [86.925, 27.989], zoom: 12 }">
      <MaplibreTiandituLayer layer="img" />
      <MaplibreContourLayer :dem-url="demUrl" :line-color="lineColor" :labels="labels" />
    </MaplibreMap>
  </div>
</template>
