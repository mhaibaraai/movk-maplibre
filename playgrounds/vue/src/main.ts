import './assets/css/main.css'
import '@movk/maplibre/index.css'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { $fetch } from 'ofetch'
import ui from '@nuxt/ui/vue-plugin'
import MaplibrePlugin from '@movk/maplibre/vue-plugin'
import { registerPmtilesProtocol } from '#maplibre/utils/pmtiles'
import { registerCogProtocol } from '#maplibre/utils/cog'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import App from './App.vue'

// 复用的 play 页面裸写 $fetch(...)（Nuxt 下由 ofetch 全局提供）；这里在真正的
// globalThis 上挂载同一份实现，而不是逐文件注入 import——避免跨 workspace 包
// （play 页面物理路径在 playgrounds/play）解析 ofetch 时因未提升到根 node_modules 而失败。
// globalThis.$fetch 的环境类型来自 Nuxt 的 NitroFetchRequest 泛型特化，与裸 ofetch 的
// $fetch 类型结构不完全兼容，这里按运行时实际形状显式收窄赋值目标类型
const globalWithFetch = globalThis as unknown as { $fetch: typeof $fetch }
globalWithFetch.$fetch = $fetch

// 复用 Nuxt playground（playgrounds/play）的演示页：import.meta.glob 为每个匹配文件生成 import()，
// 经 vite.config 的 #maplibre 别名与组件/composable 复用即可在纯 Vite 下运行
const playPages = import.meta.glob('../../play/app/pages/**/*.vue')
// 本地 vue 专属页（同路径覆盖）
const localPages = import.meta.glob('./pages/**/*.vue')

function toRoutePath(file: string): string {
  const name = file.match(/\/pages(.*)\.vue$/)![1].toLowerCase()
  return name === '/index' ? '/' : name
}

const routeMap = new Map<string, RouteRecordRaw>()
for (const [file, component] of Object.entries(playPages)) {
  const path = toRoutePath(file)
  routeMap.set(path, { path, component })
}
for (const [file, component] of Object.entries(localPages)) {
  const path = toRoutePath(file)
  routeMap.set(path, { path, component })
}

// 对齐 Nuxt playground 的 maplibre.protocols：在首个地图创建前同步注册
registerPmtilesProtocol()
registerCogProtocol()

const router = createRouter({
  routes: [...routeMap.values()],
  history: createWebHistory()
})

createApp(App)
  .use(router)
  .use(ui)
  .use(MaplibrePlugin, {
    // maplibre-gl v6 经 Vite 打包时无法自动解析 worker 地址，需显式传入
    workerUrl,
    tk: import.meta.env.VITE_TIANDITU_TK,
    // OpenFreeMap 公开字体服务：空白样式与内置文字图层共用
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    textFont: ['Noto Sans Regular']
  })
  .mount('#app')
