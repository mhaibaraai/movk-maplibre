import type { Map as MaplibreMap } from 'maplibre-gl'
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { LayerBeforeId, MaplibreContext, StyleLayerPredicate } from '../../types'

/** 排序键：自外层组到图层逐级的 [zIndex, seq]，按字典序比较，越大越靠上 */
export type StackKey = readonly number[]

/** 托管图层向图层栈登记的条目，均为取值函数以反映最新 props */
export interface StackEntry {
  layerId: () => string
  key: () => StackKey
  beforeId: () => LayerBeforeId | undefined
}

export interface StackHandle {
  /** 计算本图层 addLayer 时的 beforeId */
  insertBefore: (map: MaplibreMap) => string | undefined
  unregister: () => void
}

export interface LayerStack {
  /** 分配每图单调递增的挂载序号，作为同 zIndex 时的次级排序键 */
  nextSeq: () => number
  register: (entry: StackEntry) => StackHandle
  /** 按排序键重排已在地图中的托管图层；同一 tick 内的多次调用合并为一次 */
  reflow: (map: MaplibreMap) => void
}

interface Member {
  id: string
  key: StackKey
}

function compareKeys(a: StackKey, b: StackKey): number {
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return a.length - b.length
}

// 每张地图一份图层栈：托管图层（MaplibreLayer / MaplibreCustomLayer）在此登记排序键与锚点
const stacks = new WeakMap<MaplibreContext, LayerStack>()

export function getLayerStack(context: MaplibreContext): LayerStack {
  let stack = stacks.get(context)
  if (!stack) {
    stack = createLayerStack(context)
    stacks.set(context, stack)
  }
  return stack
}

function createLayerStack(context: MaplibreContext): LayerStack {
  const entries = new Set<StackEntry>()
  // 谓词解析结果按 style.load 快照缓存，换样式后快照引用变化即重新解析
  const predicateCache = new WeakMap<StyleLayerPredicate, { snapshot: readonly string[], id: string | undefined }>()
  let seq = 0
  let scheduled = false

  // 仅在底图快照内匹配：运行时由组件添加的图层不会成为锚点
  function matchStyleLayer(map: MaplibreMap, predicate: StyleLayerPredicate): string | undefined {
    const snapshot = context.styleLayerIds.value
    const cached = predicateCache.get(predicate)
    if (cached?.snapshot === snapshot) return cached.id
    const ids = new Set(snapshot)
    const layers = (map.getStyle()?.layers ?? []) as LayerSpecification[]
    const id = layers.find(layer => ids.has(layer.id) && predicate(layer))?.id
    predicateCache.set(predicate, { snapshot, id })
    return id
  }

  // 锚点图层不存在时返回 undefined，即置于图层栈顶部
  function resolveAnchor(map: MaplibreMap, beforeId: LayerBeforeId | undefined): string | undefined {
    const id = typeof beforeId === 'function' ? matchStyleLayer(map, beforeId) : beforeId
    return id && map.getLayer(id) ? id : undefined
  }

  // 同桶（同锚点）内已在地图中、排序键大于自身者取最小，插到它之前；没有则插到锚点之前
  function insertBefore(map: MaplibreMap, entry: StackEntry): string | undefined {
    const anchor = resolveAnchor(map, entry.beforeId())
    const key = entry.key()
    let next: Member | undefined
    for (const other of entries) {
      if (other === entry) continue
      const id = other.layerId()
      if (!map.getLayer(id) || resolveAnchor(map, other.beforeId()) !== anchor) continue
      const otherKey = other.key()
      if (compareKeys(otherKey, key) > 0 && (!next || compareKeys(otherKey, next.key) < 0)) next = { id, key: otherKey }
    }
    return next?.id ?? anchor
  }

  // 置顶桶的天花板：最高成员之上首个既非底图、也非托管的图层（如量算、标绘工具层），没有则为栈顶
  function topCeiling(order: readonly string[], highest: number, skip: Set<string>): string | undefined {
    return order.slice(highest + 1).find(id => !skip.has(id))
  }

  function run(map: MaplibreMap): void {
    const order = map.getLayersOrder()
    const position = new Map(order.map((id, index) => [id, index]))
    const buckets = new Map<string | undefined, Member[]>()
    for (const entry of entries) {
      const id = entry.layerId()
      if (!position.has(id)) continue
      const anchor = resolveAnchor(map, entry.beforeId())
      buckets.set(anchor, [...(buckets.get(anchor) ?? []), { id, key: entry.key() }])
    }
    const styleIds = new Set(context.styleLayerIds.value)
    const skip = new Set([...styleIds, ...[...buckets.values()].flat().map(member => member.id)])
    const lastStylePosition = Math.max(-1, ...order.flatMap((id, index) => (styleIds.has(id) ? [index] : [])))

    for (const [anchor, members] of buckets) {
      const expected = [...members].sort((a, b) => compareKeys(a.key, b.key)).map(member => member.id)
      const positions = expected.map(id => position.get(id)!)
      const ordered = positions.every((value, index) => index === 0 || value > positions[index - 1]!)
      const top = positions.at(-1)!
      const underCeiling = anchor === undefined ? positions[0]! > lastStylePosition : top < position.get(anchor)!
      if (ordered && underCeiling) continue

      const ceiling = anchor ?? topCeiling(order, Math.max(...positions), skip)
      map.moveLayer(expected.at(-1)!, ceiling)
      for (let i = expected.length - 2; i >= 0; i--) map.moveLayer(expected[i]!, expected[i + 1])
    }
  }

  return {
    nextSeq: () => ++seq,
    register(entry) {
      entries.add(entry)
      return {
        insertBefore: map => insertBefore(map, entry),
        unregister: () => entries.delete(entry)
      }
    },
    reflow(map) {
      if (scheduled) return
      scheduled = true
      // 样式加载窗口期跳过：重载完成后由 onReady 按排序键逐个插入
      queueMicrotask(() => {
        scheduled = false
        if (context.isStyleReady.value) run(map)
      })
    }
  }
}
