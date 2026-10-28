export default defineAppConfig({
  header: {
    nav: [
      { label: { 'zh-CN': '文档', 'en': 'Docs' }, to: '/docs/getting-started', activeMatch: '/docs' },
      { label: { 'zh-CN': '版本发布', 'en': 'Releases' }, to: '/releases' }
    ],
    mobileNav: [
      { label: { 'zh-CN': '快速开始', 'en': 'Getting Started' }, icon: 'i-lucide-square-play', to: '/docs/getting-started' },
      { label: { 'zh-CN': '核心组件', 'en': 'Core' }, icon: 'i-lucide-box', to: '/docs/core' },
      { label: { 'zh-CN': '图层', 'en': 'Layers' }, icon: 'i-lucide-layers', to: '/docs/layers' },
      { label: { 'zh-CN': '控件', 'en': 'Controls' }, icon: 'i-lucide-sliders-horizontal', to: '/docs/controls' },
      { label: { 'zh-CN': '效果', 'en': 'Effects' }, icon: 'i-lucide-sparkles', to: '/docs/effects' },
      { label: { 'zh-CN': '环境', 'en': 'Environment' }, icon: 'i-lucide-cloud-sun', to: '/docs/environment' },
      { label: { 'zh-CN': '扩展', 'en': 'Extensions' }, icon: 'i-lucide-puzzle', to: '/docs/extensions' },
      { label: { 'zh-CN': 'Composables', 'en': 'Composables' }, icon: 'i-lucide-square-function', to: '/docs/composables' },
      { label: { 'zh-CN': '工具函数', 'en': 'Utils' }, icon: 'i-lucide-wrench', to: '/docs/utils' },
      { label: { 'zh-CN': '版本发布', 'en': 'Releases' }, icon: 'i-lucide-newspaper', to: '/releases' },
      { label: 'GitHub', icon: 'i-simple-icons-github', to: 'https://github.com/mhaibaraai/movk-maplibre', target: '_blank' }
    ]
  },
  docs: {
    categories: {
      'getting-started': [
        { id: 'ai', title: { 'zh-CN': 'AI 集成', 'en': 'AI Integration' }, icon: 'i-lucide-bot' }
      ],
      'core': [
        { id: 'basics', title: { 'zh-CN': '基础', 'en': 'Basics' }, icon: 'i-lucide-box' },
        { id: 'overlay', title: { 'zh-CN': '标注与浮层', 'en': 'Markers & Overlays' }, icon: 'i-lucide-map-pin' }
      ],
      'layers': [
        { id: 'builtin', title: { 'zh-CN': '内置类型', 'en': 'Built-in Types' }, icon: 'i-lucide-shapes' },
        { id: 'data-driven', title: { 'zh-CN': '数据驱动', 'en': 'Data-Driven' }, icon: 'i-lucide-database' },
        { id: 'buffers', title: { 'zh-CN': '缓冲区', 'en': 'Buffers' }, icon: 'i-lucide-circle-dashed' },
        { id: 'analysis', title: { 'zh-CN': '分析与辅助', 'en': 'Analysis & Overlays' }, icon: 'i-lucide-grid-3x3' }
      ],
      'controls': [
        { id: 'interactive', title: { 'zh-CN': '交互控件', 'en': 'Interactive' }, icon: 'i-lucide-mouse-pointer-click' },
        { id: 'info', title: { 'zh-CN': '信息控件', 'en': 'Informational' }, icon: 'i-lucide-info' },
        { id: 'layer-management', title: { 'zh-CN': '图层管理', 'en': 'Layer Management' }, icon: 'i-lucide-layers' }
      ],
      'effects': [
        { id: 'dynamic', title: { 'zh-CN': '动态', 'en': 'Dynamic' }, icon: 'i-lucide-activity' },
        { id: 'building', title: { 'zh-CN': '建筑', 'en': 'Building' }, icon: 'i-lucide-building-2' },
        { id: 'annotation', title: { 'zh-CN': '标注', 'en': 'Annotation' }, icon: 'i-lucide-map-pin' }
      ],
      'environment': [
        { id: 'ambience', title: { 'zh-CN': '场景氛围', 'en': 'Ambience' }, icon: 'i-lucide-mountain' },
        { id: 'weather', title: { 'zh-CN': '温度', 'en': 'Temperature' }, icon: 'i-lucide-thermometer' }
      ],
      'extensions': [
        { id: 'draw', title: { 'zh-CN': '绘制', 'en': 'Drawing' }, icon: 'i-lucide-pencil-ruler' },
        { id: 'basemap', title: { 'zh-CN': '底图与坐标', 'en': 'Basemaps & Coordinates' }, icon: 'i-lucide-map' },
        { id: 'multi-map', title: { 'zh-CN': '多图联动', 'en': 'Multi-map' }, icon: 'i-lucide-columns-2' },
        { id: 'protocols', title: { 'zh-CN': '数据协议', 'en': 'Data Protocols' }, icon: 'i-lucide-file-stack' }
      ],
      'composables': [
        { id: 'context', title: { 'zh-CN': '上下文注入', 'en': 'Context Injection' }, icon: 'i-lucide-network' },
        { id: 'interaction', title: { 'zh-CN': '相机与交互', 'en': 'Camera & Interaction' }, icon: 'i-lucide-mouse-pointer-click' },
        { id: 'icon-export', title: { 'zh-CN': '图标与导出', 'en': 'Icons & Export' }, icon: 'i-lucide-download' }
      ],
      'utils': [
        { id: 'geometry', title: { 'zh-CN': '几何与样式', 'en': 'Geometry & Styles' }, icon: 'i-lucide-shapes' },
        { id: 'coordinate', title: { 'zh-CN': '坐标与度量', 'en': 'Coordinates & Measurement' }, icon: 'i-lucide-locate-fixed' }
      ]
    }
  },
  aside: {
    filter: {
      enabled: true
    }
  },
  toaster: {
    position: 'top-center' as const,
    duration: 3000
  },
  aiChat: {
    faqQuestions: {
      'zh-CN': [
        {
          category: '集成与上手',
          items: [
            'Nuxt 4 如何安装并配置天地图 token？',
            'Vue + Vite 项目怎么接入？',
            'center / zoom 怎么 v-model 绑定？'
          ]
        },
        {
          category: '数据与图层',
          items: [
            '如何添加 circle / fill / line 图层？',
            '怎么做点聚合与热力图？',
            'useFeatureState 怎么做高亮？'
          ]
        },
        {
          category: '标注与动效',
          items: [
            '如何添加 Marker / Popup 标注？',
            '怎么叠加 3D 建筑与动态效果？',
            'sky / terrain 怎么开启？'
          ]
        },
        {
          category: '本土化与工具',
          items: [
            '怎么接入天地图 / WMS / WMTS？',
            'GCJ02 / BD09 坐标怎么转换？',
            '如何绘制要素并导出图片？'
          ]
        }
      ],
      'en': [
        {
          category: 'Getting Started',
          items: [
            'How to install and configure the Tianditu token in Nuxt 4?',
            'How to integrate in a Vue + Vite project?',
            'How to v-model bind center / zoom?'
          ]
        },
        {
          category: 'Data & Layers',
          items: [
            'How to add circle / fill / line layers?',
            'How to implement point clustering and heatmaps?',
            'How to highlight features with useFeatureState?'
          ]
        },
        {
          category: 'Markers & Effects',
          items: [
            'How to add Marker / Popup annotations?',
            'How to overlay 3D buildings and dynamic effects?',
            'How to enable sky / terrain?'
          ]
        },
        {
          category: 'Localization & Utilities',
          items: [
            'How to integrate Tianditu / WMS / WMTS?',
            'How to convert GCJ02 / BD09 coordinates?',
            'How to draw features and export images?'
          ]
        }
      ]
    }
  },
  ui: {
    colors: {
      primary: 'indigo'
    }
  },
  github: {
    rootDir: 'docs',
    commitPath: 'src/runtime',
    dateFormat: {
      options: {
        timeZone: 'Asia/Shanghai'
      }
    }
  },
  toc: {
    bottom: {
      links: [
        {
          icon: 'i-lucide-message-circle-code',
          to: 'https://maplibre.mhaibaraai.cn/llms.txt',
          target: '_blank',
          label: 'Open LLMs'
        }
      ]
    }
  },
  footer: {
    credits: `Copyright © 2026 - ${new Date().getFullYear()} YiXuan - <span class="text-highlighted">MIT License</span>`,
    socials: [
      {
        'icon': 'i-simple-icons-github',
        'to': 'https://github.com/mhaibaraai/movk-maplibre',
        'target': '_blank',
        'aria-label': 'movk-maplibre on GitHub'
      },
      {
        'icon': 'i-lucide-mail',
        'to': 'mailto:mhaibaraai@gmail.com',
        'target': '_blank',
        'aria-label': 'YiXuan\'s Gmail'
      }
    ]
  }
})
