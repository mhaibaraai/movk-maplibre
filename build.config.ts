import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // Vue（非 Nuxt）支持入口
    './src/unplugin',
    './src/vite',
    './src/vue-plugin'
  ],
  declaration: true,
  failOnWarn: false,
  externals: ['vite', 'maplibre-gl', 'terra-draw', 'terra-draw-maplibre-gl-adapter', 'lottie-web', 'pmtiles', '@geomatico/maplibre-cog-protocol', 'maplibre-contour', 'vue', '@vueuse/core', 'unplugin', 'consola'],
  hooks: {
    'mkdist:entry:options'(_ctx, _entry, options) {
      options.addRelativeDeclarationExtensions = false
    }
  }
})
