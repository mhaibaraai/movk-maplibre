import type { CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem } from '@nuxt/ui'

const coreNav: NavigationMenuItem = {
  label: '核心',
  icon: 'i-lucide-map',
  defaultOpen: true,
  children: [
    { label: '基础地图', to: '/core/basic-map' },
    { label: '相机双向绑定', to: '/core/camera' },
    { label: '跨路由持久化', to: '/core/persistent' }
  ]
}

const sourcesNav: NavigationMenuItem = {
  label: '数据源',
  icon: 'i-lucide-database',
  defaultOpen: true,
  children: [
    { label: 'GeoJSON', to: '/sources/geojson' },
    { label: 'Vector 矢量瓦片', to: '/sources/vector' },
    { label: 'Raster 栅格瓦片', to: '/sources/raster' },
    { label: 'Image 图片', to: '/sources/image' }
  ]
}

const layersNav: NavigationMenuItem = {
  label: '图层',
  icon: 'i-lucide-layers',
  defaultOpen: true,
  children: [
    { label: 'Circle 圆点', to: '/layers/circle' },
    { label: 'Line 线', to: '/layers/line' },
    { label: 'Fill 填充', to: '/layers/fill' },
    { label: 'Symbol 符号', to: '/layers/symbol' },
    { label: 'Heatmap 热力', to: '/layers/heatmap' },
    { label: 'FillExtrusion 3D', to: '/layers/fill-extrusion' },
    { label: '内联 Source', to: '/layers/inline-source' },
    { label: 'Image 图片图层', to: '/layers/image' },
    { label: 'Video 视频图层', to: '/layers/video' },
    { label: 'Raster URL 模板', to: '/layers/raster-tiles' },
    { label: 'Building 3D 建筑', to: '/layers/building' },
    { label: 'Cluster 点聚合', to: '/layers/cluster' },
    { label: 'LayerGroup 图层组', to: '/layers/group' }
  ]
}

const interactionsNav: NavigationMenuItem = {
  label: '交互',
  icon: 'i-lucide-mouse-pointer-click',
  defaultOpen: true,
  children: [
    { label: 'FeatureState 悬浮/选中', to: '/interactions/feature-state' },
    { label: 'Tooltip 悬浮提示', to: '/interactions/tooltip' },
    { label: 'Camera 相机助手', to: '/interactions/camera' },
    { label: 'Image 图标注册', to: '/interactions/icons' }
  ]
}

const environmentNav: NavigationMenuItem = {
  label: '环境',
  icon: 'i-lucide-mountain-snow',
  defaultOpen: true,
  children: [
    { label: 'Terrain 3D 地形', to: '/environment/terrain' },
    { label: 'Sky 天空', to: '/environment/sky' },
    { label: 'Projection 球形投影', to: '/environment/projection' },
    { label: 'Temperature 温度热力', to: '/environment/temperature' }
  ]
}

const effectsNav: NavigationMenuItem = {
  label: '动效',
  icon: 'i-lucide-sparkles',
  defaultOpen: true,
  children: [
    { label: 'Diffusion 扩散圆', to: '/effects/diffusion' },
    { label: 'Wave 波浪圆', to: '/effects/wave' },
    { label: 'Glow 炫光圆', to: '/effects/glow' },
    { label: 'Radar 雷达扫描', to: '/effects/radar' },
    { label: 'Trail 动态轨迹', to: '/effects/trail' },
    { label: 'Migration 迁徙图', to: '/effects/migration' },
    { label: 'SpriteImage 帧动画图标', to: '/effects/sprite-image' },
    { label: 'AnimatedImage 动图图标', to: '/effects/animated-image' },
    { label: 'Building 建筑特效', to: '/effects/buildings' }
  ]
}

const toolsNav: NavigationMenuItem = {
  label: '工具',
  icon: 'i-lucide-ruler',
  defaultOpen: true,
  children: [
    { label: 'Buffer 缓冲区', to: '/tools/buffers' },
    { label: 'Measure 测量', to: '/tools/measure' },
    { label: 'Print 导出', to: '/tools/print' }
  ]
}

const annotationsNav: NavigationMenuItem = {
  label: '标注',
  icon: 'i-lucide-map-pin',
  defaultOpen: true,
  children: [
    { label: 'Marker 标记', to: '/annotations/marker' },
    { label: 'Popup 弹窗', to: '/annotations/popup' },
    { label: 'LottieMarker 动画标记', to: '/annotations/lottie-marker' }
  ]
}

const controlsNav: NavigationMenuItem = {
  label: '控件',
  icon: 'i-lucide-sliders-horizontal',
  defaultOpen: true,
  children: [
    { label: '内置控件', to: '/controls' },
    { label: '图层管理', to: '/layer-management' }
  ]
}

const dataFormatsNav: NavigationMenuItem = {
  label: '数据格式',
  icon: 'i-lucide-file-stack',
  defaultOpen: true,
  children: [
    { label: 'PMTiles 单文件瓦片', to: '/data-formats/pmtiles' },
    { label: 'COG 云优化 GeoTIFF', to: '/data-formats/cog' },
    { label: 'Contour 实时等高线', to: '/data-formats/contour' },
    { label: 'Mask 区域遮罩', to: '/data-formats/mask' },
    { label: 'Graticule 经纬网', to: '/data-formats/graticule' }
  ]
}

const multiMapNav: NavigationMenuItem = {
  label: '多图联动',
  icon: 'i-lucide-columns-2',
  defaultOpen: true,
  children: [
    { label: 'Swipe 卷帘对比', to: '/multi-map/swipe' },
    { label: 'Minimap 鹰眼', to: '/multi-map/minimap' },
    { label: 'useMapSync 多图联动', to: '/multi-map/sync' }
  ]
}

const extensionsNav: NavigationMenuItem = {
  label: '扩展',
  icon: 'i-lucide-puzzle',
  defaultOpen: true,
  children: [
    { label: 'Draw 绘制', to: '/extensions/draw' },
    { label: 'Draw 模式子集', to: '/extensions/draw-modes' },
    { label: 'Draw 样式主题', to: '/extensions/draw-theme' },
    { label: 'Draw 跨组件树驱动', to: '/extensions/draw-remote' },
    { label: '天地图底图', to: '/extensions/tianditu' },
    { label: '天地图地名定位/检索', to: '/extensions/tianditu-search' },
    { label: '天地图地名搜索其他类型', to: '/extensions/tianditu-search-types' },
    { label: '天地图逆地理编码', to: '/extensions/tianditu-reverse-geocode' },
    { label: '天地图行政区划边界', to: '/extensions/tianditu-administrative' },
    { label: '天地图路线规划', to: '/extensions/tianditu-route' },
    { label: 'WMTS 图层', to: '/extensions/wmts' },
    { label: 'WMS 图层', to: '/extensions/wms' },
    { label: '坐标系转换', to: '/extensions/coordinate' }
  ]
}

const components: NavigationMenuItem[] = [
  coreNav,
  sourcesNav,
  layersNav,
  annotationsNav,
  interactionsNav,
  environmentNav,
  effectsNav,
  toolsNav,
  controlsNav,
  dataFormatsNav,
  multiMapNav,
  extensionsNav
]

export const useNavigation = () => {
  const items: NavigationMenuItem[] = [
    { label: '首页', icon: 'i-lucide-house', to: '/' }
  ]

  const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [
    { id: 'links', items: items as unknown as CommandPaletteItem[] },
    { id: 'components', label: '能力点', items: components as unknown as CommandPaletteItem[] }
  ])

  return { components, groups, items }
}
