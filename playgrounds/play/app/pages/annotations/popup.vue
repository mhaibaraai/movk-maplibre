<script setup lang="ts">
import type { PopupOptions } from 'maplibre-gl'

const open = ref(true)
const closedAt = ref<string>()
const closeButton = ref(true)
const dark = ref(false)
const anchor = ref<NonNullable<PopupOptions['anchor']>>('bottom')
const anchors: NonNullable<PopupOptions['anchor']>[] = ['top', 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right', 'left', 'right']
const records = Array.from({ length: 24 }, (_, index) => ({
  index: index + 1,
  title: `途经记录 ${index + 1}：中心城区主干道路口与公共停车场出入口`
}))

function onClose() {
  open.value = false
  closedAt.value = new Date().toLocaleTimeString()
}
</script>

<template>
  <MapShowcase
    title="Popup 弹窗"
    description="检查长内容滚动、原生关闭按钮、深色外观与不同锚点方向。此页面同时用于 Nuxt 和纯 Vue。"
    height="560px"
    :state="{ open, closedAt, closeButton, anchor, dark }"
  >
    <template #toolbar>
      <UButton size="xs" variant="soft" :disabled="open" @click="open = true">
        重新打开
      </UButton>
      <USwitch v-model="closeButton" size="xs" label="关闭按钮" />
      <USwitch v-model="dark" size="xs" label="深色外观" />
      <USelect v-model="anchor" :items="anchors" aria-label="弹窗锚点" size="xs" class="w-32" />
    </template>

    <DemoMap :class="{ dark }" :center="[116.397, 39.909]" :zoom="12" map-style="https://tiles.openfreemap.org/styles/liberty">
      <MaplibrePopup
        v-if="open"
        :lnglat="[116.397, 39.909]"
        :options="{ offset: 12, closeOnClick: false, closeButton, anchor, maxWidth: '320px', className: 'play-popup' }"
        @close="onClose"
      >
        <div class="space-y-2">
          <h2 class="font-semibold">
            同一位置的多次途经记录与道路出入口详情
          </h2>
          <p>共 {{ records.length }} 条，标题固定、列表独立滚动。</p>
          <ol class="max-h-52 space-y-2 overflow-y-auto pr-2" aria-label="途经记录">
            <li v-for="record in records" :key="record.index" class="border-t border-default pt-2">
              {{ record.title }}
            </li>
          </ol>
        </div>
      </MaplibrePopup>
    </DemoMap>
  </MapShowcase>
</template>
