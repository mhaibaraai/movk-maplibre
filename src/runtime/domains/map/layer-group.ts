import type { InjectionKey, Ref } from 'vue'
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { LayerBeforeId } from '../../types'
import type { StackKey } from './layer-stack'

/** 子图层上报给所属组的描述，供图例推导 */
export interface LayerDescriptor {
  layerId: string
  type: LayerSpecification['type']
  paint?: Record<string, unknown>
}

/** MaplibreLayerGroup 向子图层下发的组上下文 */
export interface LayerGroupContext {
  /** 组内图层缺省插入锚点（子图层自身 beforeId 优先，未设置时继承父组） */
  beforeId: Readonly<Ref<LayerBeforeId | undefined>>
  /** 组在图层栈中的排序路径（父组路径 + 自身 [zIndex, seq]），子图层在其后追加自身键 */
  stackKey: Readonly<Ref<StackKey>>
  /** 有效显隐：父组有效显隐与自身开关取与 */
  visible: Readonly<Ref<boolean>>
  /** 有效透明度：父组有效透明度与自身透明度相乘 */
  opacity: Readonly<Ref<number>>
  /** 上报子图层描述（取值函数，paint 变化随之反映），返回注销函数 */
  registerLayer: (descriptor: () => LayerDescriptor) => () => void
}

export const LayerGroupKey: InjectionKey<LayerGroupContext> = Symbol('movk-maplibre:layer-group')
