import { useMap } from '../../composables/useMap'
import type { MaplibreContext } from '../../types'
import { logger } from '../../utils/logger'

interface StyleIdState {
  /** kind → 已分配的最大序号 */
  counters: Map<string, number>
  /** 本库发出过的、以及手写占用的保留形式 id */
  issued: Set<string>
}

// 自动 id 的保留形式 `<kind>#<n>`；手写 id 几乎不含 #，两者天然隔离
const RESERVED_ID = /^[a-z]+(?:-[a-z]+)*#\d+$/

// 每张地图一份状态
const states = new WeakMap<MaplibreContext, StyleIdState>()

function stateOf(context: MaplibreContext): StyleIdState {
  let state = states.get(context)
  if (!state) {
    state = { counters: new Map(), issued: new Set() }
    states.set(context, state)
  }
  return state
}

/**
 * 解析 layer / source id：传入手写 id 时原样返回，否则生成 `<kind>#<n>`（n 按地图与 kind 单调递增）。
 * 手写 id 占用保留形式时告警并登记，后续生成会跳过它；本库自己发出的 id 回传给内部组件时不告警。
 */
export function useStyleId(kind: string, explicit?: string): string {
  const context = useMap()
  const { counters, issued } = stateOf(context)

  if (explicit !== undefined) {
    if (RESERVED_ID.test(explicit) && !issued.has(explicit)) {
      logger.warn(`id "${explicit}" uses the reserved auto-generated form "<kind>#<n>"; rename it to avoid collisions.`)
      issued.add(explicit)
    }
    return explicit
  }

  const map = context.map.value
  let n = counters.get(kind) ?? 0
  let id: string
  do {
    n += 1
    id = `${kind}#${n}`
  } while (issued.has(id) || map?.getLayer(id) || map?.getSource(id))
  counters.set(kind, n)
  issued.add(id)
  return id
}
