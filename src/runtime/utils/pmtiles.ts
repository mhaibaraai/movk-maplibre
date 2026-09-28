import { addProtocol } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { defineGlobalSingleton } from '@movk/core'

/** 注册 `pmtiles://` 协议（全局单例、幂等）；返回 Protocol 实例，可经 `protocol.add(new PMTiles(...))` 登记自定义来源 */
export function registerPmtilesProtocol(options?: ConstructorParameters<typeof Protocol>[0]): Protocol {
  return defineGlobalSingleton('movk-maplibre:protocol:pmtiles', () => {
    const protocol = new Protocol(options)
    addProtocol('pmtiles', protocol.tile)
    return protocol
  })
}
