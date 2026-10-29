<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { Popup } from 'maplibre-gl'
import type { LngLatLike, Map as MaplibreMap, PopupOptions } from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { isDeepEqual } from '@movk/core'

const props = defineProps<{
  /** 弹窗锚定的经纬度 */
  lnglat: LngLatLike
  /**
   * Popup 选项；值变化时重建弹窗
   * @see https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupOptions/
   */
  options?: PopupOptions
}>()

const emit = defineEmits<{ close: [] }>()

defineOptions({ inheritAttrs: false })

const ctx = useMap()
const el = useTemplateRef<HTMLDivElement>('el')
let popup: Popup | undefined
let disposed = false

function onClose(): void {
  emit('close')
}

function createPopup(map: MaplibreMap): void {
  popup = new Popup({ ...props.options, className: ['movk-popup', props.options?.className].filter(Boolean).join(' ') })
  popup.setLngLat(props.lnglat)
  if (el.value) popup.setDOMContent(el.value)
  popup.on('close', onClose)
  popup.addTo(map)
}

onMounted(async () => {
  const map = await ctx.whenAttached()
  if (disposed) return
  createPopup(map)
})

watch(() => props.lnglat, value => popup?.setLngLat(value))

// 构造期选项（anchor、closeButton 等）无 setter，值变化时重建；模板内联对象值相同则跳过
watch(() => props.options, (next, prev) => {
  const map = ctx.map.value
  if (!popup || !map || isDeepEqual(next, prev)) return
  // 重建是内部行为：先解绑再移除，不对外派发 close
  popup.off('close', onClose)
  popup.remove()
  createPopup(map)
})

onUnmounted(() => {
  disposed = true
  popup?.remove()
})

defineExpose({ popup: () => popup })
</script>

<template>
  <div style="display: none">
    <div ref="el" v-bind="$attrs">
      <slot />
    </div>
  </div>
</template>
