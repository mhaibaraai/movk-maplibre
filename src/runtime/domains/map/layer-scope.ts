import type { InjectionKey } from 'vue'

/** MaplibreSource 向子树下发的 source id，子图层省略 source 时引用它 */
export const SourceScopeKey: InjectionKey<{ sourceId: string }> = Symbol('movk-maplibre:source-scope')

/** MaplibreLayer 向子树下发的图层 id，MaplibreTooltip 省略 layerId 时绑定它 */
export const LayerScopeKey: InjectionKey<{ layerId: string }> = Symbol('movk-maplibre:layer-scope')
