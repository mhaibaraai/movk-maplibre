interface FakeLayer {
  'id': string
  'type': string
  'source-layer'?: string
  'layout': Record<string, unknown>
  'paint': Record<string, unknown>
}

type Handler = (e?: unknown) => void

/** 带样式图层状态的 Map 桩：记录 layout/paint 读写，可模拟 setStyle 重载，用于图层组与样式图层认领测试 */
export function fakeStyleMap(styleLayers: Array<Omit<FakeLayer, 'layout' | 'paint'> & Partial<Pick<FakeLayer, 'layout' | 'paint'>>> = []) {
  const handlers: Record<string, Set<Handler>> = {}
  const layers = new Map<string, FakeLayer>()
  const sources = new Map<string, Record<string, unknown>>()
  const toLayer = (spec: Omit<FakeLayer, 'layout' | 'paint'> & Partial<Pick<FakeLayer, 'layout' | 'paint'>>): FakeLayer =>
    ({ ...spec, layout: { ...spec.layout }, paint: { ...spec.paint } })
  for (const spec of styleLayers) layers.set(spec.id, toLayer(spec))

  // 控件槽位：addControl 调 onAdd 并挂到文档中，removeControl 调 onRemove
  const controlContainer = document.createElement('div')
  document.body.appendChild(controlContainer)

  const self = {
    layers,
    controlContainer,
    addControl(control: { onAdd: (map: unknown) => HTMLElement }, position?: string) {
      const el = control.onAdd(self)
      el.dataset.position = position ?? 'top-right'
      controlContainer.appendChild(el)
    },
    removeControl(control: { onRemove: (map: unknown) => void }) {
      control.onRemove(self)
    },
    sources,
    layoutCalls: [] as [string, string, unknown][],
    paintCalls: [] as [string, string, unknown][],
    /** source 增量更新记录：[sourceId, 方法名, 参数] */
    sourceCalls: [] as [string, string, unknown][],
    styleLoaded: true,
    zoom: 1,
    /** 视口范围 [west, south, east, north] */
    bounds: [-180, -85, 180, 85] as [number, number, number, number],
    on(type: string, a: unknown, b?: unknown) {
      (handlers[type] ??= new Set()).add((b ?? a) as Handler)
    },
    off(type: string, a: unknown, b?: unknown) {
      handlers[type]?.delete((b ?? a) as Handler)
    },
    fire(type: string, e?: unknown) {
      for (const fn of [...(handlers[type] ?? [])]) fn(e)
    },
    isStyleLoaded: () => self.styleLoaded,
    getLayersOrder: () => [...layers.keys()],
    getStyle: () => ({ layers: [...layers.values()].map(({ layout, paint, ...rest }) => ({ ...rest, layout: { ...layout }, paint: { ...paint } })) }),
    getLayer: (id: string) => layers.get(id),
    addLayer(spec: { id: string, type: string, layout?: Record<string, unknown>, paint?: Record<string, unknown> }) {
      layers.set(spec.id, toLayer(spec))
    },
    removeLayer: (id: string) => layers.delete(id),
    moveLayer() {},
    getLayoutProperty: (id: string, key: string) => layers.get(id)?.layout[key],
    getPaintProperty: (id: string, key: string) => layers.get(id)?.paint[key],
    setLayoutProperty(id: string, key: string, value: unknown) {
      self.layoutCalls.push([id, key, value])
      const layer = layers.get(id)
      if (layer) layer.layout[key] = value
    },
    setPaintProperty(id: string, key: string, value: unknown) {
      self.paintCalls.push([id, key, value])
      const layer = layers.get(id)
      if (layer) layer.paint[key] = value
    },
    setFilter() {},
    setLayerZoomRange() {},
    getSource(id: string) {
      if (!sources.has(id)) return undefined
      const record = (method: string) => (arg: unknown) => {
        self.sourceCalls.push([id, method, arg])
      }
      return { setData: record('setData'), setTiles: record('setTiles'), setUrl: record('setUrl') }
    },
    addSource: (id: string, spec: Record<string, unknown> = {}) => sources.set(id, spec),
    removeSource: (id: string) => sources.delete(id),
    /** 模拟 setStyle 整体替换：清空全部图层后装入新样式并派发 style.load */
    replaceStyle(next: Array<Omit<FakeLayer, 'layout' | 'paint'> & Partial<Pick<FakeLayer, 'layout' | 'paint'>>>) {
      layers.clear()
      for (const spec of next) layers.set(spec.id, toLayer(spec))
      self.fire('style.load')
    },
    resize() {},
    remove() {},
    getCanvas: () => ({ style: {} }),
    getCenter: () => ({ lng: 0, lat: 0 }),
    getZoom: () => self.zoom,
    getBounds: () => {
      const [west, south, east, north] = self.bounds
      return { getWest: () => west, getSouth: () => south, getEast: () => east, getNorth: () => north }
    },
    getBearing: () => 0,
    getPitch: () => 0,
    setCenter() {},
    setZoom() {},
    setBearing() {},
    setPitch() {},
    setStyle() {}
  }
  return self
}

export type FakeStyleMap = ReturnType<typeof fakeStyleMap>
