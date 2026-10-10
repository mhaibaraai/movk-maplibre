<script setup lang="ts">
import type { Feature, Polygon } from 'geojson'

interface Service {
  name: string
  color: string
  data: Feature<Polygon>
}

const square = (lng: number, lat: number): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[lng, lat], [lng + 0.06, lat], [lng + 0.06, lat - 0.04], [lng, lat - 0.04], [lng, lat]]] }
})

// 数组顺序即上下顺序：首项在最上层
const services = ref<Service[]>([
  { name: '规划用地', color: '#f43f5e', data: square(116.36, 39.94) },
  { name: '水系', color: '#3b82f6', data: square(116.38, 39.93) },
  { name: '绿地', color: '#22c55e', data: square(116.4, 39.92) }
])

function move(index: number, offset: -1 | 1): void {
  const target = index + offset
  const next = [...services.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  services.value = next
}
</script>

<template>
  <div class="relative h-115 w-full overflow-hidden rounded-(--ui-radius) border border-default">
    <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/positron', center: [116.41, 39.915], zoom: 12 }">
      <MaplibreLayerGroup
        v-for="(service, index) in services"
        :key="service.name"
        :title="service.name"
        :z-index="services.length - index"
      >
        <MaplibreLayer type="fill" :source="{ type: 'geojson', data: service.data }" :paint="{ 'fill-color': service.color, 'fill-opacity': 0.85 }" />
      </MaplibreLayerGroup>
      <MaplibreLayerControl position="top-right" />
    </MaplibreMap>
    <div class="absolute left-3 top-3 z-10 flex w-44 flex-col gap-1 rounded-md bg-default/90 p-2 ring ring-default">
      <div v-for="(service, index) in services" :key="service.name" class="flex items-center gap-2 text-sm">
        <span class="size-3 rounded-sm" :style="{ backgroundColor: service.color }" />
        <span class="flex-1">{{ service.name }}</span>
        <UButton
          icon="i-lucide-arrow-up"
          size="xs"
          variant="ghost"
          color="neutral"
          :disabled="index === 0"
          @click="move(index, -1)"
        />
        <UButton
          icon="i-lucide-arrow-down"
          size="xs"
          variant="ghost"
          color="neutral"
          :disabled="index === services.length - 1"
          @click="move(index, 1)"
        />
      </div>
    </div>
  </div>
</template>
