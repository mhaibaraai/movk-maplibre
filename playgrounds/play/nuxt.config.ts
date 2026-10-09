export default defineNuxtConfig({
  modules: ['../../src/module', '@nuxt/ui'],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    tiandituApiToken: ''
  },

  compatibilityDate: '2026-06-30',

  vite: {
    optimizeDeps: {
      include: [
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

  maplibre: {
    // OpenFreeMap 公开字体服务：空白样式与内置文字图层共用
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    textFont: ['Noto Sans Regular'],
    protocols: { pmtiles: true, cog: true, zzts: true }
  }
})
