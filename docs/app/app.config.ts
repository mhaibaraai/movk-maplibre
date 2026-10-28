export default defineAppConfig({
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
