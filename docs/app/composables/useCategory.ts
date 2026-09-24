export function useCategory() {
  const { t } = useI18n()

  const categories = computed(() => ({
    'getting-started': [
      {
        id: 'ai',
        title: t('category.gettingStarted.ai'),
        icon: 'i-lucide-bot'
      }
    ],
    'core': [
      {
        id: 'basics',
        title: t('category.core.basics'),
        icon: 'i-lucide-box'
      },
      {
        id: 'overlay',
        title: t('category.core.overlay'),
        icon: 'i-lucide-map-pin'
      }
    ],
    'layers': [
      {
        id: 'builtin',
        title: t('category.layers.builtin'),
        icon: 'i-lucide-shapes'
      },
      {
        id: 'data-driven',
        title: t('category.layers.dataDriven'),
        icon: 'i-lucide-database'
      },
      {
        id: 'buffers',
        title: t('category.layers.buffers'),
        icon: 'i-lucide-circle-dashed'
      },
      {
        id: 'analysis',
        title: t('category.layers.analysis'),
        icon: 'i-lucide-grid-3x3'
      }
    ],
    'controls': [
      {
        id: 'interactive',
        title: t('category.controls.interactive'),
        icon: 'i-lucide-mouse-pointer-click'
      },
      {
        id: 'info',
        title: t('category.controls.info'),
        icon: 'i-lucide-info'
      },
      {
        id: 'layer-management',
        title: t('category.controls.layerManagement'),
        icon: 'i-lucide-layers'
      }
    ],
    'effects': [
      {
        id: 'dynamic',
        title: t('category.effects.dynamic'),
        icon: 'i-lucide-activity'
      },
      {
        id: 'building',
        title: t('category.effects.building'),
        icon: 'i-lucide-building-2'
      },
      {
        id: 'annotation',
        title: t('category.effects.annotation'),
        icon: 'i-lucide-map-pin'
      }
    ],
    'environment': [
      {
        id: 'ambience',
        title: t('category.environment.ambience'),
        icon: 'i-lucide-mountain'
      },
      {
        id: 'weather',
        title: t('category.environment.weather'),
        icon: 'i-lucide-thermometer'
      }
    ],
    'extensions': [
      {
        id: 'draw',
        title: t('category.extensions.draw'),
        icon: 'i-lucide-pencil-ruler'
      },
      {
        id: 'basemap',
        title: t('category.extensions.basemap'),
        icon: 'i-lucide-map'
      },
      {
        id: 'multi-map',
        title: t('category.extensions.multiMap'),
        icon: 'i-lucide-columns-2'
      },
      {
        id: 'protocols',
        title: t('category.extensions.protocols'),
        icon: 'i-lucide-file-stack'
      }
    ],
    'composables': [
      {
        id: 'context',
        title: t('category.composables.context'),
        icon: 'i-lucide-network'
      },
      {
        id: 'interaction',
        title: t('category.composables.interaction'),
        icon: 'i-lucide-mouse-pointer-click'
      },
      {
        id: 'icon-export',
        title: t('category.composables.iconExport'),
        icon: 'i-lucide-download'
      }
    ],
    'utils': [
      {
        id: 'geometry',
        title: t('category.utils.geometry'),
        icon: 'i-lucide-shapes'
      },
      {
        id: 'coordinate',
        title: t('category.utils.coordinate'),
        icon: 'i-lucide-locate-fixed'
      }
    ]
  }))

  return {
    categories
  }
}
