import { createRequire } from 'node:module'
import { addComponentsDir, addImportsDir, addPlugin, addPluginTemplate, createResolver, defineNuxtModule, extendViteConfig } from '@nuxt/kit'
import { defu } from 'defu'
import { name, version } from '../package.json'

export type * from './runtime/types'

export interface ModuleOptions {
  /** 天地图服务 token（tk） */
  tk?: string
  /** 空白样式的字体 pbf 地址模板（含 {fontstack} 与 {range}） */
  glyphs?: string
  /** 库内置文字图层使用的字体栈 */
  textFont?: string[]
  /**
   * 组件前缀
   * @defaultValue 'Maplibre'
   */
  prefix?: string
  /** 按需注册数据协议（需安装对应可选依赖）；开启后在客户端插件中注册，未开启时不打包相关依赖 */
  protocols?: {
    /** 注册 `pmtiles://` 协议，依赖 pmtiles */
    pmtiles?: boolean
    /** 注册 `cog://` 协议，依赖 @geomatico/maplibre-cog-protocol */
    cog?: boolean
    /** 注册 `zzts://` 协议（ZZTS 二维动态切片服务），无额外依赖；需自定义请求时改为自行调用 `registerZztsProtocol` */
    zzts?: boolean
  }
}

// 需 Vite 预构建的可选依赖：含 CJS 或 CJS 传递依赖，未预构建时无法具名导入
const OPTIONAL_DEPS = ['lottie-web', 'pmtiles', '@geomatico/maplibre-cog-protocol', 'maplibre-contour']

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: 'maplibre',
    compatibility: { nuxt: '>=4.0.0' }
  },
  defaults: {
    prefix: 'Maplibre'
  },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    nuxt.options.alias['#maplibre'] = resolve('./runtime')

    const publicConfig = nuxt.options.runtimeConfig.public as Record<string, unknown>
    publicConfig.maplibre = defu(publicConfig.maplibre as Record<string, unknown> | undefined, {
      tk: options.tk || process.env.NUXT_PUBLIC_MAPLIBRE_TK,
      glyphs: options.glyphs,
      textFont: options.textFont
    })

    nuxt.options.css.push(resolve('./runtime/index.css'))

    addComponentsDir({
      path: resolve('./runtime/components'),
      prefix: options.prefix,
      pathPrefix: false
    })
    addImportsDir(resolve('./runtime/composables'))
    addPlugin({ src: resolve('./runtime/plugins/config') })
    // maplibre-gl v6 经打包工具使用时无法自动解析 worker 地址；由应用自身的 Vite 处理 ?worker&url 并注入
    addPluginTemplate({
      filename: 'movk-maplibre-worker.client.mjs',
      mode: 'client',
      getContents: () => [
        `import { defineNuxtPlugin } from '#app'`,
        `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'`,
        `import { setMaplibreConfig } from ${JSON.stringify(resolve('./runtime/domains/map/config'))}`,
        `export default defineNuxtPlugin(() => { setMaplibreConfig({ workerUrl }) })`
      ].join('\n')
    })

    const protocols = [
      options.protocols?.pmtiles && { path: './runtime/utils/pmtiles', register: 'registerPmtilesProtocol' },
      options.protocols?.cog && { path: './runtime/utils/cog', register: 'registerCogProtocol' },
      options.protocols?.zzts && { path: './runtime/utils/zzts', register: 'registerZztsProtocol' }
    ].filter(item => !!item)
    // 协议须在首个地图请求瓦片前注册，静态导入并在客户端插件内同步调用
    if (protocols.length) {
      addPluginTemplate({
        filename: 'movk-maplibre-protocols.client.mjs',
        mode: 'client',
        getContents: () => [
          `import { defineNuxtPlugin } from '#app'`,
          ...protocols.map(({ path, register }) => `import { ${register} } from ${JSON.stringify(resolve(path))}`),
          `export default defineNuxtPlugin(() => { ${protocols.map(({ register }) => `${register}()`).join('; ')} })`
        ].join('\n')
      })
    }

    extendViteConfig((config) => {
      config.optimizeDeps ||= {}
      const include = (config.optimizeDeps.include ||= [])
      const require = createRequire(import.meta.url)
      for (const dep of OPTIONAL_DEPS) {
        if (include.includes(dep)) continue
        try {
          require.resolve(dep, { paths: [nuxt.options.rootDir] })
          include.push(dep)
        } catch {
          // 可选依赖未安装时跳过，避免 Vite optimizeDeps 解析告警
        }
      }
    })
  }
})
