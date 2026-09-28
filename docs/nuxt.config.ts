import pkg from '../package.json'

export default defineNuxtConfig({
  extends: ['@movk/nuxt-docs'],

  modules: [
    '../src/module',
    '@nuxtjs/i18n',
    '@vercel/analytics',
    '@vercel/speed-insights'
  ],

  $development: {
    site: {
      url: 'http://localhost:3000'
    }
  },

  $production: {
    site: {
      url: 'https://maplibre.mhaibaraai.cn'
    }
  },

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  site: {
    name: 'Movk MapLibre'
  },

  runtimeConfig: {
    public: {
      version: pkg.version
    }
  },

  routeRules: {
    '/docs': { redirect: '/docs/getting-started', prerender: false },
    '/docs/core': { redirect: '/docs/core/map', prerender: false },
    '/docs/layers': { redirect: '/docs/layers/circle', prerender: false },
    '/docs/controls': { redirect: '/docs/controls/navigation', prerender: false },
    '/docs/effects': { redirect: '/docs/effects/radar', prerender: false },
    '/docs/environment': { redirect: '/docs/environment/sky', prerender: false },
    '/docs/extensions': { redirect: '/docs/extensions/draw', prerender: false },
    '/docs/composables': { redirect: '/docs/composables/use-map', prerender: false },
    '/docs/utils': { redirect: '/docs/utils/buffer', prerender: false },
    '/en/docs': { redirect: '/en/docs/getting-started', prerender: false },
    '/en/docs/core': { redirect: '/en/docs/core/map', prerender: false },
    '/en/docs/layers': { redirect: '/en/docs/layers/circle', prerender: false },
    '/en/docs/controls': { redirect: '/en/docs/controls/navigation', prerender: false },
    '/en/docs/effects': { redirect: '/en/docs/effects/radar', prerender: false },
    '/en/docs/environment': { redirect: '/en/docs/environment/sky', prerender: false },
    '/en/docs/extensions': { redirect: '/en/docs/extensions/draw', prerender: false },
    '/en/docs/composables': { redirect: '/en/docs/composables/use-map', prerender: false },
    '/en/docs/utils': { redirect: '/en/docs/utils/buffer', prerender: false }
  },

  compatibilityDate: '2026-06-30',

  vite: {
    optimizeDeps: {
      include: [
        '@unhead/schema-org/vue',
        'terra-draw',
        'terra-draw-maplibre-gl-adapter',
        '@movk/core',
        '@turf/area',
        '@turf/bearing',
        '@turf/buffer',
        '@turf/circle',
        '@turf/distance',
        '@turf/ellipse',
        '@turf/length',
        '@turf/sector',
        '@vueuse/core',
        'gcoord'
      ]
    }
  },

  aiChat: {
    model: 'alibaba/qwen3.8-27b',
    models: [
      'alibaba/qwen3.8-27b',
      'deepseek/deepseek-v4-pro-0813'
    ]
  },

  componentMeta: {
    checkerOptions: {
      forceUseTs: true,
      schema: {
        ignore: [
          // maplibre 表达式 / 样式规范是递归元组联合，展开 schema 会耗尽内存；
          // 可选 prop 的 `T | undefined` 联合无声明，需按成员判定，否则 Props 表按成员拼出超长类型致高亮请求 431
          (_name: string, type: import('typescript').Type) => {
            const fromMaplibre = (t: import('typescript').Type): boolean => {
              const declaration = t.aliasSymbol?.declarations?.[0] ?? t.symbol?.declarations?.[0]
              return /maplibre-gl/.test(declaration?.getSourceFile().fileName ?? '')
            }
            return (fromMaplibre(type) || (type.isUnion() && type.types.some(fromMaplibre))) ? true : undefined
          }
        ]
      }
    }
  },

  i18n: {
    defaultLocale: 'zh-CN',
    locales: [
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ]
  },

  llms: {
    domain: 'https://maplibre.mhaibaraai.cn',
    title: 'Movk MapLibre',
    description: '声明式 MapLibre GL 封装库：提供 MaplibreMap / MaplibreSource / MaplibreLayer 等组件与 composables，原生支持 Nuxt 4 模块，并经 Vite 插件在纯 Vue + Vite 项目中通用；内置 3D 建筑、雷达 / 扩散 / 辉光等动态效果，sky / terrain 环境，terra-draw 绘制、天地图、WMS / WMTS 与多坐标系本土化。',
    full: {
      title: 'Movk MapLibre — 声明式 MapLibre GL 封装库',
      description: '声明式 MapLibre GL 封装库的完整文档：同一套 src/runtime 既作为 Nuxt 4 模块发布，也经 Vite / unplugin 插件在纯 Vue + Vite 项目通用。涵盖快速开始与双分发接入、核心组件（MaplibreMap / MaplibreSource / MaplibreLayer 等）、图层与控件、3D 建筑及雷达 / 扩散 / 辉光等动态效果、sky / terrain 环境、terra-draw 绘制扩展、天地图与 WMS / WMTS、多坐标系（WGS84 / GCJ02 / BD09）本土化、composables 与工具函数的全部 API 与示例。'
    },
    notes: ['maplibre', 'maplibre-gl', 'maplibre-gl-v6', 'declarative', 'nuxt', 'nuxt4', 'vue', 'vite', 'vue-plugin', 'unplugin', 'auto-import', 'map', 'source', 'layer', 'marker', 'popup', 'controls', 'navigation', '3d-buildings', 'effects', 'radar', 'glow', 'sky', 'terrain', 'draw', 'terra-draw', 'no-access-token', 'tianditu', 'wms', 'wmts', 'coordinate', 'wgs84', 'gcj02', 'bd09', 'turf', 'composables', 'use-map', '纯 Vue + Vite 场景经 @movk/maplibre/vite 自动导入组件与 composables，并经 @movk/maplibre/vue-plugin 注入运行时配置；MapLibre 无需 access token，天地图 token 与字体配置在 Nuxt 模式由模块配置注入，地图实例仅客户端创建，无需 ClientOnly 包裹']
  },

  maplibre: {
    // OpenFreeMap 公开字体服务：空白样式与内置文字图层共用
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    textFont: ['Noto Sans Regular'],
    protocols: { pmtiles: true, cog: true }
  },

  mcp: {
    name: 'Movk MapLibre',
    browserRedirect: '/docs/getting-started/ai/mcp'
  }
})
