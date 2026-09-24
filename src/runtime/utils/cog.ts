import { addProtocol } from 'maplibre-gl'
import { cogProtocol } from '@geomatico/maplibre-cog-protocol'
import { defineGlobalSingleton } from '@movk/core'

/** 注册 `cog://` 协议（全局单例、幂等），用于直接加载 Cloud Optimized GeoTIFF */
export function registerCogProtocol(): void {
  defineGlobalSingleton('movk-maplibre:protocol:cog', () => {
    addProtocol('cog', cogProtocol)
    return true
  })
}
