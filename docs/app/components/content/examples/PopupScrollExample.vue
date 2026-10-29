<script setup lang="ts">
import type { PopupOptions } from 'maplibre-gl'

const opened = ref(true)
const closeButton = ref(true)
const dark = ref(false)
const anchor = ref<NonNullable<PopupOptions['anchor']>>('bottom')
const anchors: NonNullable<PopupOptions['anchor']>[] = ['top', 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right', 'left', 'right']
const records = Array.from({ length: 24 }, (_, index) => ({
  index: index + 1,
  title: `途经记录 ${index + 1}：中心城区主干道路口与公共停车场出入口`,
  time: `2026-10-07 ${String(6 + Math.floor(index / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}:00`
}))
</script>

<template>
  <div class="space-y-3 w-full">
    <div class="flex flex-wrap items-center gap-3">
      <UButton size="sm" @click="opened = true">
        打开弹窗
      </UButton>
      <USwitch v-model="closeButton" label="关闭按钮" />
      <USwitch v-model="dark" label="深色外观" />
      <USelect v-model="anchor" :items="anchors" aria-label="弹窗锚点" class="w-36" />
    </div>
    <div :class="{ dark }" class="h-130 w-full overflow-hidden rounded-(--ui-radius) border border-default">
      <MaplibreMap :options="{ style: 'https://tiles.openfreemap.org/styles/liberty', center: [116.397, 39.908], zoom: 12 }">
        <MaplibrePopup
          v-if="opened"
          :lnglat="[116.397, 39.908]"
          :options="{ closeOnClick: false, closeButton, anchor, maxWidth: '320px', className: 'popup-scroll-example' }"
          @close="opened = false"
        >
          <div class="space-y-2">
            <h3 class="font-semibold">
              长标题示例：同一位置的多次途经记录与道路出入口详情
            </h3>
            <p class="text-xs">
              共 {{ records.length }} 条，列表高度由插槽内容控制。
            </p>
            <ol class="max-h-52 space-y-2 overflow-y-auto pr-2" aria-label="途经记录">
              <li v-for="record in records" :key="record.index" class="space-y-1 border-t border-default pt-2">
                <p class="font-medium">
                  {{ record.title }}
                </p>
                <p class="text-xs">
                  过车时间：{{ record.time }}
                </p>
              </li>
            </ol>
          </div>
        </MaplibrePopup>
      </MaplibreMap>
    </div>
  </div>
</template>
