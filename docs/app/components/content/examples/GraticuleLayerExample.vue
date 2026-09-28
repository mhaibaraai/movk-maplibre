<script setup lang="ts">
withDefaults(defineProps<{ color?: string, labels?: boolean }>(), {
  color: '#2563eb',
  labels: true
})
</script>

<template>
  <div class="h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/liberty', center: [105, 30], zoom: 1.5 }">
      <MaplibreProjection type="globe" />
      <MaplibreGraticuleLayer :color="color" :labels="labels" />
    </MaplibreMap>
  </div>
</template>
