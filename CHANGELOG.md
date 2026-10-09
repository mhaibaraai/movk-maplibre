# 📋 Changelog

## [1.2.0](https://github.com/mhaibaraai/movk-maplibre/compare/v1.1.0...v1.2.0) (2026-10-09)

### ✨ Features

* **utils:** 新增 zzts:// 协议适配 ZZTS 二维动态切片服务 ([10c3403](https://github.com/mhaibaraai/movk-maplibre/commit/10c3403579432ec307db71d9c77638f9f74b6951))

### 📝 Documentation

* 新增 ZZTS 协议文档 ([1b491f3](https://github.com/mhaibaraai/movk-maplibre/commit/1b491f329eec82dea7314ed10dc1568a2bf8ce95))

### ♻️ Code Refactoring

* **utils:** 移除 ZZTS png_status 判定，仅以请求结果识别缺图 ([b2428f7](https://github.com/mhaibaraai/movk-maplibre/commit/b2428f782d60e18466c29586f9d2aa3cba04b678))

### 🔧 Chores

* **deps:** update all non-major dependencies ([2ff8fe7](https://github.com/mhaibaraai/movk-maplibre/commit/2ff8fe74c6513d264abeb8b2b89f45b71611b722))
* **playground:** 新增 ZZTS 动态切片演示页 ([d528ba7](https://github.com/mhaibaraai/movk-maplibre/commit/d528ba73dc2375b98903eca389a1af6e5d6a65ea))

## [1.1.0](https://github.com/mhaibaraai/movk-maplibre/compare/v1.0.0...v1.1.0) (2026-09-28)

### ⚠ BREAKING CHANGES

* **draw:** 移除 controls prop，改用 modes 限定模式、toolbar 控制工具栏显隐；
  移除 movkDrawModes、drawThemeStyles 自动导入及 @movk/maplibre/draw-modes 导出，
  自定义模式直接在 modes 中传入 terra-draw 实例。

### ✨ Features

* **components:** MaplibreRasterLayer 支持 url 以加载 TileJSON 与协议地址 ([040c03b](https://github.com/mhaibaraai/movk-maplibre/commit/040c03beb9f3b933215457e525df66b295ec4e39))
* **components:** 图层组支持透明度、图层树与认领底图样式图层，新增 useLayerTree ([03e8119](https://github.com/mhaibaraai/movk-maplibre/commit/03e8119abf60ad8815da92a0e5785a7edb578adf))
* **components:** 新增 MaplibreCompare 卷帘对比组件 ([5f22a45](https://github.com/mhaibaraai/movk-maplibre/commit/5f22a45f69fdb2620a2278c5cfc734ef33218ed6))
* **components:** 新增 MaplibreContourLayer 实时等高线图层 ([30448e7](https://github.com/mhaibaraai/movk-maplibre/commit/30448e74ef7601b35999617ff68427ddc7a40a96))
* **components:** 新增 MaplibreControl 通用控件容器 ([b407c1a](https://github.com/mhaibaraai/movk-maplibre/commit/b407c1a03a6b9971230638845475a8fe3401d6e5))
* **components:** 新增 MaplibreGraticuleLayer 经纬网图层 ([6b148aa](https://github.com/mhaibaraai/movk-maplibre/commit/6b148aa1ba3dbe4704720c71e204bee1286eadf9))
* **components:** 新增 MaplibreLayerControl、MaplibreLegend 与 MaplibreBasemapControl ([51cb3e3](https://github.com/mhaibaraai/movk-maplibre/commit/51cb3e3f145579a74f24914ebaa2837591304596))
* **components:** 新增 MaplibreMaskLayer 区域遮罩图层 ([9298618](https://github.com/mhaibaraai/movk-maplibre/commit/92986184ff2bcf13681f6eb502434a5120dd0e8f))
* **components:** 新增 MaplibreMinimap 鹰眼控件 ([0667569](https://github.com/mhaibaraai/movk-maplibre/commit/066756927b5969f5972b124b54490adedb261662))
* **components:** 新增 MaplibreProjection 与 MaplibreGlobeControl 球形投影组件 ([8e87219](https://github.com/mhaibaraai/movk-maplibre/commit/8e87219c04d2a7543c790498c5b132df68b29bac))
* **composables:** 新增 useMapSync 多地图相机联动 ([2e92bcf](https://github.com/mhaibaraai/movk-maplibre/commit/2e92bcfdaa4543811f0fe70dd8234e8d87c95748))
* **draw:** 收敛绘制 API，modes 支持模式名、theme 响应式、controls 改为 toolbar ([87824b1](https://github.com/mhaibaraai/movk-maplibre/commit/87824b137a1c5c89c5e6aef5510169fc711320e9))
* **map:** 上下文新增 styleLayerIds，在 style.load 时快照样式自带图层 ([8da7c8f](https://github.com/mhaibaraai/movk-maplibre/commit/8da7c8fc1d20d56c7d93e0b7f9d296262003d8c2))
* **map:** 上下文新增 whenAttached，Marker/Popup/控件/相机不再等待 load ([14800e6](https://github.com/mhaibaraai/movk-maplibre/commit/14800e6bb0e5d9afc6203b41ce8813e470fb6273))
* **module:** 新增 protocols 选项按需注册 pmtiles 与 cog 协议 ([5339a42](https://github.com/mhaibaraai/movk-maplibre/commit/5339a42b00c36163d343db21a5b7b00c3e6e264c))
* **utils:** 新增 pmtiles 与 cog 协议注册函数 ([6ca0ca0](https://github.com/mhaibaraai/movk-maplibre/commit/6ca0ca06d84ec092c20565399cd9720d42a0c7b6))
* **utils:** 新增 tiandituStyle，将天地图底图组装为完整样式 ([929e14c](https://github.com/mhaibaraai/movk-maplibre/commit/929e14c8aff162e11a5fc644f6e0d0bca4224872))

### 🐛 Bug Fixes

* **composables:** useMapAnimation 改按样式解析状态门控，拖动缩放不再跳帧 ([28b43f8](https://github.com/mhaibaraai/movk-maplibre/commit/28b43f88a835b39096926e6095406a95aaa848cc))
* **composables:** useMapAnimation 首次 load 前不出帧，避免推迟地图 load 事件 ([c66ded4](https://github.com/mhaibaraai/movk-maplibre/commit/c66ded4b90d0bf74aafd5e226e34b8c1ae41cb0e))
* **custom-layer:** layer 与 beforeId 响应式 ([fedd6e6](https://github.com/mhaibaraai/movk-maplibre/commit/fedd6e633a7314ed5b15df7482e5afc8f37e1047))
* **docs:** 修复 prop 描述中 :key 被 MDC 解析为组件的告警 ([a32c57f](https://github.com/mhaibaraai/movk-maplibre/commit/a32c57f2b75bba91e374477d1cf3785e3951eb48))
* **docs:** 修复 Props 表 maplibre 可选类型展开导致高亮请求 431 ([4d52100](https://github.com/mhaibaraai/movk-maplibre/commit/4d521004daec040a6ea9629be9a9d06cf21c3499))
* **draw:** 工具栏换用 Lucide 图标，修复未居中并突出选中态 ([d936757](https://github.com/mhaibaraai/movk-maplibre/commit/d936757f9ad2ae96e32af88b2941e85f42232ddb))
* **draw:** 线模式图标改为带顶点的折线，避免误读为曲线 ([467096e](https://github.com/mhaibaraai/movk-maplibre/commit/467096eb67d7965e4c7b966c88614fa2e2893057))
* **events:** onLayerDataChange 改为等待 source 加载完成后的 render ([42ff3b8](https://github.com/mhaibaraai/movk-maplibre/commit/42ff3b8ce7d9c28bbeccf7a587494f405ded2029))
* **feature-state:** 图层数据更新后校验 hover 与 selected 状态 ([0998372](https://github.com/mhaibaraai/movk-maplibre/commit/09983728a779743fe778e5927f38825deb3ef285))
* **frame-icon:** size 与 fps 响应式，换尺寸时重建 StyleImage ([e5eff7e](https://github.com/mhaibaraai/movk-maplibre/commit/e5eff7ea406020be5b06d7dead3ab0630b617c05))
* **image:** useMaplibreImage 的 url 响应式，TextureBuilding 贴图可切换 ([e62404b](https://github.com/mhaibaraai/movk-maplibre/commit/e62404bd850033783725838e65add5ed92b0ce38))
* **layer:** 内联 source 与 beforeId 响应变化，移除的 paint/layout 属性恢复默认值 ([2cf0bc3](https://github.com/mhaibaraai/movk-maplibre/commit/2cf0bc39e9b309394e2db2bb56b8afaef5908b28))
* **lottie-marker:** path、animationData、loop、autoplay 变化时重新加载动画 ([6948e22](https://github.com/mhaibaraai/movk-maplibre/commit/6948e228d7be7f3189e691147ee587d178341692))
* **marker:** options 响应式，有 setter 的字段增量更新 ([718e404](https://github.com/mhaibaraai/movk-maplibre/commit/718e404a5f1dab771dfc82890484f35b9868373d))
* **playground:** 图层管理页认领天地图注记栅格图层 ([b88e696](https://github.com/mhaibaraai/movk-maplibre/commit/b88e696c82996d58456077251ac14931b3ed6c77))
* **popup:** options 值变化时重建弹窗 ([90abd83](https://github.com/mhaibaraai/movk-maplibre/commit/90abd831f27f4b683a5419c234aaf44b1fb368f2))
* **source:** 抽取 updateSource 并支持聚类参数增量更新 ([d35bfb5](https://github.com/mhaibaraai/movk-maplibre/commit/d35bfb56660c711c2e3cda0036645f55423d33ff))
* **terrain:** DEM source 变化时原地更新瓦片 ([2175123](https://github.com/mhaibaraai/movk-maplibre/commit/2175123658abaea32f1c190ddf2dd5a07b263798))
* **tooltip:** options 与 layerId 响应式 ([f5ddba3](https://github.com/mhaibaraai/movk-maplibre/commit/f5ddba341a777d75816a4f148a9be0232a15424d))
* **tooltip:** 图层数据更新后重新校验弹窗要素 ([d5fa5cf](https://github.com/mhaibaraai/movk-maplibre/commit/d5fa5cf32e19b9821ecef4800b08a82fe79fdc3b))

### 📝 Documentation

* **components:** 新增 MaplibreCompare、MaplibreMinimap 与 useMapSync 文档及示例 ([67b60ca](https://github.com/mhaibaraai/movk-maplibre/commit/67b60cac8cecaa80f81adbe861347f0735116e60))
* **components:** 新增 MaplibreProjection 与 MaplibreGlobeControl 文档及示例 ([e9fa342](https://github.com/mhaibaraai/movk-maplibre/commit/e9fa34215ff03716e89169c145a6232fab17559f))
* **components:** 新增 MaplibreSwipe 文档与示例并补充 useMapSync 按钮开启用法 ([59a2640](https://github.com/mhaibaraai/movk-maplibre/commit/59a2640bfd8224616af35e95cde1de042e27aa01))
* **components:** 新增图层管理相关组件文档与示例 ([cd53545](https://github.com/mhaibaraai/movk-maplibre/commit/cd53545f8efebc2363f5a131150429f6764370aa))
* **components:** 标注仅在创建时读取的 props ([aceb22e](https://github.com/mhaibaraai/movk-maplibre/commit/aceb22e57247b21d351071c21199f87c41db2f9b))
* **composables:** 补充 useMapAnimation 的 deltaMs 参数与门控说明 ([bb75313](https://github.com/mhaibaraai/movk-maplibre/commit/bb75313707b670336a87caec86dc4b9eeedec564))
* **composables:** 补充 useMapAnimation 首次 load 门控与 useMap 的 whenAttached 字段 ([fc7a7c0](https://github.com/mhaibaraai/movk-maplibre/commit/fc7a7c0d25d4ab99436e1059fb9683bdbf73cc00))
* **draw:** 合并模式与主题文档至 MaplibreDrawControl 页 ([9fec103](https://github.com/mhaibaraai/movk-maplibre/commit/9fec103c907ed332562c658058e9f3ab4644623a))
* 新增等高线、遮罩、经纬网图层与 PMTiles、COG 协议文档 ([647bd74](https://github.com/mhaibaraai/movk-maplibre/commit/647bd744fbe537350e74ce0bde7c1344920d43bf))
* 说明天地图样式图层 id 及注记认领方式 ([1d6682c](https://github.com/mhaibaraai/movk-maplibre/commit/1d6682cdbdaa6ab12d6d5f25ce2380a4023b7809))

### ♻️ Code Refactoring

* **components:** 以主图内叠加层 MaplibreSwipe 替换 MaplibreCompare ([f620e7e](https://github.com/mhaibaraai/movk-maplibre/commit/f620e7ea33e2bceaf5196d573f8872304e09c5e7))
* 改用 @movk/core 的通用函数替换本地实现 ([1a2e981](https://github.com/mhaibaraai/movk-maplibre/commit/1a2e981c8af471eb1587a0046820fc30cf456632))

### ✅ Tests

* **components:** 覆盖图层组按 id 认领天地图栅格注记 ([44373c8](https://github.com/mhaibaraai/movk-maplibre/commit/44373c845a3cbc4bdec40b4798af0d66085bdcf6))
* **composables:** 补充 useMapSync 地图注销后解绑用例 ([89ac8d1](https://github.com/mhaibaraai/movk-maplibre/commit/89ac8d1c22cd6ed56813d9b78ff3586beeff8eb6))

### 📦 Build System

* **deps:** @movk/core 暂用 pkg.pr.new 预览版 2faf6cb ([10d1b4d](https://github.com/mhaibaraai/movk-maplibre/commit/10d1b4d58cb55acc1d8333d11e1019ca816b714a))
* **deps:** 升级 @movk/core 至 1.5.0 正式版与 @movk/nuxt-docs 至 2.4.1 ([74fa131](https://github.com/mhaibaraai/movk-maplibre/commit/74fa131d13f309424a1401b3633a4479cf08b902))
* **deps:** 新增 pmtiles、maplibre-cog-protocol 与 maplibre-contour 可选依赖 ([a09178b](https://github.com/mhaibaraai/movk-maplibre/commit/a09178bb12a685bf5e34540a5bff94b0ad67096a))

### 🔧 Chores

* **deps:** 升级依赖版本并移除天地图文档版本徽章 ([5c5edb1](https://github.com/mhaibaraai/movk-maplibre/commit/5c5edb1c1d74a93e3c1ef58ded2fdc7c66d25a56))
* **playground:** 卷帘演示页改用 MaplibreSwipe ([fd2b11f](https://github.com/mhaibaraai/movk-maplibre/commit/fd2b11f756602a94d8fd550e59918561704a2f56))
* **playground:** 新增图层管理演示页 ([9ba5e4f](https://github.com/mhaibaraai/movk-maplibre/commit/9ba5e4fe1abbf5f5bb2f8da034c3411f01e01d29))
* **playground:** 新增多图联动演示页 ([75e0e80](https://github.com/mhaibaraai/movk-maplibre/commit/75e0e8032d79c6f0e07afd0b8eca31c53dc0df6b))
* **playground:** 新增数据格式演示页 ([ce08010](https://github.com/mhaibaraai/movk-maplibre/commit/ce08010d0e56d21f2959a87c4b1894c112a2c177))
* **playground:** 新增球形投影页并在控件页加入 GlobeControl ([f2b4103](https://github.com/mhaibaraai/movk-maplibre/commit/f2b4103b3c714bfe76e2ba7aaff4a421db97a455))
* **playground:** 适配绘制控件新 props，主题页演示即时换色 ([e18cc56](https://github.com/mhaibaraai/movk-maplibre/commit/e18cc56e65c147412f1a38b9179d14db8f6fd4d1))

> 本包前身为 `@movk/mapbox`（基于 mapbox-gl，已从 npm 下架）。`@movk/maplibre` 基于 maplibre-gl 6 重写，组件前缀由 `Mapbox` 改为 `Maplibre`，不再需要 access token，版本号从 1.0.0 重新开始。

## 1.0.0 (2026-09-22)

### ✨ Features

- **声明式核心与双分发架构**
  * `MaplibreMap` / `MaplibreSource` / `MaplibreLayer` / `MaplibreMarker` / `MaplibrePopup` / `MaplibreTooltip` 等声明式组件，配套 `useMap` / `useMaplibre` composables。
  * 基于 provide/inject 下发地图上下文，子组件无需等待地图就绪即可挂载；实例仅在客户端创建，SSR 安全无需 `<ClientOnly>`。
  * 双分发：Nuxt 4 模块与 Vue/Vite 插件共用同一 runtime，组件按裸文件名自动导入；配置以 `globalThis` 单例共享。
  * 缺省使用空白样式，文字标注经运行时配置 `glyphs` / `textFont` 提供；文档与示例统一使用免 key 的 OpenFreeMap 与天地图。
  * `MaplibreCustomLayer` 逃生舱，承接自定义 WebGL/Canvas 渲染。
- **图层组件**
  * `MaplibreClusterLayer` 点聚合、`MaplibreLayerGroup` 图层组。
  * `MaplibreImageLayer` / `MaplibreVideoLayer` / `MaplibreRasterLayer` / `MaplibreBuildingLayer` 便捷图层。
- **控件**
  * `MaplibreNavigationControl` / `MaplibreScaleControl` / `MaplibreFullscreenControl` / `MaplibreGeolocateControl` / `MaplibreAttributionControl`，以及 `defineMaplibreControl` 自定义控件。
- **标注与帧动画**
  * `MaplibreLottieMarker` 动画标记；`MaplibreMarker` 支持 `#popup` 插槽，`MaplibreTooltip` 支持 hover / click / none 触发。
  * `MaplibreSpriteImage` / `MaplibreAnimatedImage` 帧动画图标，`useMapAnimation` 帧动画原语与 `useFrameIcon` 基础设施。
- **动效组件**
  * 建筑特效：`MaplibreFlowBuilding` / `MaplibreGradientBuilding` / `MaplibreTextureBuilding` / `MaplibreWindowBuilding`。
  * `MaplibreDiffusionCircle` / `MaplibreGlowCircle` / `MaplibreWaveCircle` / `MaplibreRadar` / `MaplibreMigration` / `MaplibreTrail` 等动效组件与配套纯函数。
- **环境组件**
  * `MaplibreSky` 天空与大气、`MaplibreTerrain` 地形、`MaplibreTemperature` 温度热力图。
- **绘制与量算**
  * 基于 terra-draw 的 `MaplibreDrawControl`，支持 `v-model:features` / `v-model:mode`；`useMaplibreDraw` 可按 `mapId` 跨组件树驱动绘制。
  * 矩形 / 圆 / 椭圆 / 扇形自定义模式（`movkDrawModes`，亦可从 `@movk/maplibre/draw-modes` 显式导入）与 `drawThemeStyles` 主题工厂。
  * `useMeasure` 测距 / 测面；`MaplibreBufferCircle` 等五类 turf 缓冲区组件。
- **Composables 与工具**
  * `useFeatureState` / `useMaplibreImage` / `useMaplibreCamera` / `useMapExport`。
  * geometry / building / cluster / effects 等纯函数工具，经 `@movk/maplibre/utils/*` 子路径导出。
- **本土化与集成**
  * 坐标转换（WGS84 / GCJ02 / BD09）、`MaplibreTiandituLayer` 天地图底图与天地图 WEB 服务 API 工具、`MaplibreWmsLayer` / `MaplibreWmtsLayer`。
  * `@movk/maplibre/index.css` 样式入口；文档站与 MCP / llms.txt / Agent Skill 集成。

### ⚠ 相对 @movk/mapbox 的变化

- 底层由 mapbox-gl 切换为 maplibre-gl 6，组件前缀、composable 名称中的 `Mapbox` 统一改为 `Maplibre`。
- 移除 `Rain` / `Snow` / `Lights`（maplibre 无对应能力）；`Fog` 由 `MaplibreSky` 取代。
- 绘制由 mapbox-gl-draw 改为 terra-draw，模式名沿用 terra-draw 命名（`select` / `polygon` 等）。
