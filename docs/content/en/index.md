---
seo:
  title: Movk MapLibre — Declarative MapLibre GL Component Library
  description: Compose maps, sources, layers, markers and controls declaratively with MaplibreMap / MaplibreLayer components and composables. Native Nuxt 4 module plus a Vite plugin for plain Vue. Ships 3D buildings, radar / diffusion / glow effects, fog / terrain / weather, Tianditu and WMS / WMTS basemaps, and multi-CRS localization.
---

::u-page-hero
---
orientation: horizontal
---
#title
:::motion
Declarative [MapLibre GL]{.text-primary} Components
:::

#description
:::motion
---
transition: { duration: 0.6, delay: 0.3 }
---
Compose maps, layers, markers and controls declaratively with two-way `v-model` camera bindings. One component set works across Nuxt 4 and plain Vue + Vite, with built-in 3D buildings, dynamic effects, 3D environment, and localization basemaps — no access token required.
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
  Get Started
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
  View Source
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
Core Features

#description
Declarative composition, context injection, and dual-mode runtime — from a simple basemap to complex 3D effects and localized tile services, adopt only what you need.

#features
  :::u-page-feature{icon="i-lucide-blocks"}
  #title
  Declarative Composition

  #description
  Compose maps, sources, layers, markers, popups and controls as components. State is the view — no more imperative add/remove boilerplate.
  :::

  :::u-page-feature{icon="i-lucide-share-2"}
  #title
  MaplibreContext Injection

  #description
  The root component provides context down the tree. Child components access the map instance, isLoaded, and whenLoaded() via useMap() — no id lookups needed.
  :::

  :::u-page-feature{icon="i-lucide-move"}
  #title
  Camera Two-Way Binding

  #description
  v-model:center / zoom / bearing / pitch keeps camera parameters in sync both ways, with cross-route persistent support.
  :::

  :::u-page-feature{icon="i-lucide-layers"}
  #title
  Rich Layers & Effects

  #description
  Built-in circle / fill / line / symbol / fill-extrusion / heatmap layers plus clustering, buildings, raster and video layers. Overlay radar, diffusion, glow, ripple, migration, and trajectory dynamic effects.
  :::

  :::u-page-feature{icon="i-lucide-cloud-sun"}
  #title
  3D Environment

  #description
  Sky and atmosphere, terrain, and temperature heatmaps — combined with camera tilt for an immersive 3D scene.
  :::

  :::u-page-feature{icon="i-lucide-map"}
  #title
  Localization Extensions

  #description
  Tianditu basemaps, WMS / WMTS services, terra-draw integration, and WGS84 / GCJ02 / BD09 coordinate conversion via gcoord — all out of the box.
  :::

  :::u-page-feature{icon="i-lucide-package"}
  #title
  Nuxt / Vue Dual Mode

  #description
  Works as a Nuxt 4 module and also provides @movk/maplibre/vite + vue-plugin, so the same components are available in plain Vue + Vite projects.
  :::

  :::u-page-feature{icon="i-lucide-toy-brick"}
  #title
  Composables & Utilities

  #description
  Composables including useMap, useMaplibreCamera, useMeasure, and useMapExport, paired with coordinate, buffer, geometry, and measurement utilities for progressive adoption.
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
  - label: Get Started
    to: /docs/getting-started
    color: neutral
    variant: outline
    trailingIcon: i-lucide-arrow-right
---
#title
Start Building Your Next Map

#description
From a simple basemap to 3D buildings, dynamic effects, and localized tile services — Movk MapLibre distills the complexity of MapLibre GL into composable, declarative components.
::
