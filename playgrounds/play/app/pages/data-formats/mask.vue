<script setup lang="ts">
import type { MultiPolygon } from 'geojson'
import type { AdministrativeDivision } from '#maplibre/types'

const keyword = ref('杭州市')
const boundary = ref<MultiPolygon>()
const loading = ref(false)
const error = ref<string>()
const opacity = ref(0.6)
const outline = ref(true)

const { fitBounds } = useMaplibreCamera({ mapId: 'mask-demo' })

async function query() {
  loading.value = true
  error.value = undefined
  try {
    const { divisions } = await $fetch<{ divisions: AdministrativeDivision[] }>('/api/tianditu-administrative', {
      query: { keyword: keyword.value }
    })
    boundary.value = divisions[0]?.boundary
    if (boundary.value) fitBounds(boundary.value, { padding: 40 })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

onMounted(query)
</script>

<template>
  <MapShowcase
    title="Mask 区域遮罩"
    description="MaplibreMaskLayer 以全球范围为外环、目标区域为孔洞压暗区域外范围；数据取自天地图行政区划边界，切换区域经 setData 增量更新。"
    :state="{ loading, error: error ?? null, polygons: boundary?.coordinates.length }"
  >
    <template #toolbar>
      <UInput v-model="keyword" placeholder="行政区名" size="sm" class="w-32" />
      <UButton size="sm" :loading="loading" @click="query">
        查询
      </UButton>
      <USwitch v-model="outline" label="描边" />
      <USlider v-model="opacity" :min="0" :max="1" :step="0.05" class="w-28" />
    </template>

    <DemoMap map-id="mask-demo" :center="[120.15, 30.28]" :zoom="7">
      <MaplibreMaskLayer
        v-if="boundary"
        :data="boundary"
        :opacity="opacity"
        :outline="outline"
        outline-color="#3b82f6"
        :outline-width="2"
      />
    </DemoMap>
  </MapShowcase>
</template>
