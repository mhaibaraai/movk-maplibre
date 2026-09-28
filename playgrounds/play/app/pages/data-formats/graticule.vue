<script setup lang="ts">
const globe = ref(true)
const auto = ref(true)
const step = ref(10)
</script>

<template>
  <MapShowcase
    title="Graticule 经纬网"
    description="MaplibreGraticuleLayer 按缩放级别自动选择步长，平移缩放后按视口重算；纬线已加密，球形投影下呈曲线。"
    :state="{ globe, step: auto ? 'auto' : step }"
  >
    <template #toolbar>
      <USwitch v-model="globe" label="球形投影" />
      <USwitch v-model="auto" label="自动步长" />
      <USlider
        v-if="!auto"
        v-model="step"
        :min="1"
        :max="30"
        :step="1"
        class="w-28"
      />
    </template>

    <DemoMap map-style="https://tiles.openfreemap.org/styles/liberty" :center="[105, 30]" :zoom="1.5">
      <MaplibreProjection v-if="globe" type="globe" />
      <MaplibreGraticuleLayer :step="auto ? undefined : step" color="#2563eb" />
    </DemoMap>
  </MapShowcase>
</template>
