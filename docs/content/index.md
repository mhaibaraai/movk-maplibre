---
seo:
  title: Movk MapLibre — 声明式 MapLibre GL 封装库
  description: Compose maps, sources, layers, markers and controls declaratively with MaplibreMap / MaplibreLayer components and composables. Native Nuxt 4 module plus a Vite plugin for plain Vue. Ships 3D buildings, radar / diffusion / glow effects, fog / terrain / weather, Tianditu and WMS / WMTS basemaps, and multi-CRS localization.
---

::u-page-hero
---
orientation: horizontal
---
#title
:::motion
声明式 [MapLibre GL]{.text-primary} 组件库
:::

#description
:::motion
---
transition: { duration: 0.6, delay: 0.3 }
---
声明式组合地图、图层、标记与控件，相机参数 `v-model` 双向绑定。一套组件通用于 Nuxt 4 与纯 Vue + Vite，内置 3D 建筑、动态效果、三维环境与本土化底图，无需 access token。
:::

#links
:::motion{class="flex flex-wrap gap-x-6 gap-y-3"}
---
transition: { duration: 0.6, delay: 0.5 }
---
  ::::u-button
  ---
  to: /docs/getting-started
  size: xl
  trailing-icon: i-lucide-arrow-right
  ---
  快速入门
  ::::

  ::::u-button
  ---
  icon: i-simple-icons-github
  color: neutral
  variant: outline
  size: xl
  to: https://github.com/mhaibaraai/movk-maplibre
  target: _blank
  ---
  查看源码
  ::::
:::

#default
:::motion{class="mx-auto w-full"}
---
transition: { duration: 0.6, delay: 0.1 }
---
:home-hero-demo
:::
::

::u-page-section
#title
核心特性

#description
声明式组合、上下文注入与双模式运行，从一张底图到复杂的三维效果与本土化底图服务，按需采用。

#features
  :::u-page-feature{icon="i-lucide-blocks"}
  #title
  声明式组合

  #description
  以组件组合地图、数据源、图层、标记、弹窗与控件，状态即视图，告别命令式的 add/remove 样板。
  :::

  :::u-page-feature{icon="i-lucide-share-2"}
  #title
  MaplibreContext 注入

  #description
  根组件下发上下文，子组件经 useMap() 直接取实例与 isLoaded / whenLoaded()，无需 id 查表。
  :::

  :::u-page-feature{icon="i-lucide-move"}
  #title
  相机双向绑定

  #description
  v-model:center / zoom / bearing / pitch 双向同步相机参数，并支持跨路由 persistent 持久化。
  :::

  :::u-page-feature{icon="i-lucide-layers"}
  #title
  丰富图层与效果

  #description
  内置 circle / fill / line / symbol / fill-extrusion / heatmap 与聚合、建筑、栅格、视频图层，叠加雷达、扩散、辉光、波纹、迁徙、轨迹等动态效果。
  :::

  :::u-page-feature{icon="i-lucide-cloud-sun"}
  #title
  三维环境

  #description
  sky 天空与大气、terrain 地形与 temperature 温度热力，配合相机倾斜还原沉浸式三维场景。
  :::

  :::u-page-feature{icon="i-lucide-map"}
  #title
  本土化扩展

  #description
  天地图底图、WMS / WMTS 服务、terra-draw 绘制，以及基于 gcoord 的 WGS84 / GCJ02 / BD09 坐标转换，开箱即用。
  :::

  :::u-page-feature{icon="i-lucide-package"}
  #title
  Nuxt / Vue 双模式

  #description
  既是 Nuxt 4 模块，也提供 @movk/maplibre/vite + vue-plugin，让同一套组件在纯 Vue + Vite 项目中通用。
  :::

  :::u-page-feature{icon="i-lucide-toy-brick"}
  #title
  Composables 与工具

  #description
  useMap、useMaplibreCamera、useMeasure、useMapExport 等 composables，搭配坐标、缓冲、几何与量算工具，按需渐进式采用。
  :::
::

::u-page-c-t-a
---
links:
  - label: Star on GitHub
    to: https://github.com/mhaibaraai/movk-maplibre
    target: _blank
    icon: i-lucide-star
    color: neutral
  - label: 快速入门
    to: /docs/getting-started
    color: neutral
    variant: outline
    trailingIcon: i-lucide-arrow-right
---
#title
开始构建你的下一张地图

#description
从一张底图到三维建筑、动态效果与本土化底图服务，Movk MapLibre 用声明式组件把 MapLibre GL 的复杂度收敛为可组合的能力。
::
