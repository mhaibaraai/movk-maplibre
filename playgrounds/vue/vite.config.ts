import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { maplibreAutoImports, maplibreComponentResolver } from '@movk/maplibre/unplugin'
import { tiandituDevServer } from './vite-plugins/tianditu-dev-server'

// @nuxt/ui 的 Vite 插件内置唯一的 unplugin-auto-import / unplugin-vue-components 实例，
// 并在检测到第二个实例时直接抛错。故复用本库导出的 resolver / imports 工厂，
// 注入 ui() 的 components / autoImport 选项（清单由库侧自动派生，单一数据源），
// 同时复用 playgrounds/play 的演示组件与 composables。
export default defineConfig(({ mode }) => {
  // 第三个参数传 '' 加载全部前缀的变量，取到未加 VITE_ 前缀的 server-only TIANDITU_API_TOKEN
  const env = loadEnv(mode, process.cwd(), '')

  return {
    resolve: {
      alias: {
        // 对齐 Nuxt 模块的 #maplibre 别名，使复用的 play 页面中 '#maplibre/utils/*' 可解析
        '#maplibre': fileURLToPath(new URL('../../src/runtime', import.meta.url)),
        // dev:prepare 用 --stub 产出的 dist 入口经 jiti 运行时加载 TS 源，浏览器打包会拖入 jiti；
        // 故 vue 模式直接指向源码 vue-plugin
        '@movk/maplibre/vue-plugin': fileURLToPath(new URL('../../src/vue-plugin.ts', import.meta.url))
      }
    },
    plugins: [
      vue(),
      // 开发期镜像 Nuxt playground 的 /api/tianditu-* 路由；token 仅 Node 侧持有，不进浏览器 bundle
      tiandituDevServer({ token: env.TIANDITU_API_TOKEN }),
      ui({
        components: {
          // 复用 playgrounds/play 的演示组件（MapShowcase 等）
          dirs: ['../play/app/components'],
          // 解析本库 Maplibre* 组件
          resolvers: [maplibreComponentResolver()]
        },
        autoImport: {
          // 复用 playgrounds/play 的 composables（useNavigation）
          dirs: ['../play/app/composables'],
          imports: [
            'vue',
            'vue-router',
            ...maplibreAutoImports()
          ]
        }
      })
    ],
    optimizeDeps: {
      include: [
        'terra-draw',
        'terra-draw-maplibre-gl-adapter',
        'pmtiles',
        '@geomatico/maplibre-cog-protocol',
        'maplibre-contour',
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
  }
})
