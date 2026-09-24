import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerPmtilesProtocol } from '../src/runtime/utils/pmtiles'
import { registerCogProtocol } from '../src/runtime/utils/cog'

const { addProtocol, Protocol, cogProtocol } = vi.hoisted(() => ({
  addProtocol: vi.fn(),
  Protocol: vi.fn(function (this: { tile: () => void, options: unknown }, options?: unknown) {
    this.tile = () => {}
    this.options = options
  }),
  cogProtocol: vi.fn()
}))
vi.mock('maplibre-gl', () => ({ addProtocol }))
vi.mock('pmtiles', () => ({ Protocol }))
vi.mock('@geomatico/maplibre-cog-protocol', () => ({ cogProtocol }))

const PMTILES_KEY = Symbol.for('movk-maplibre:protocol:pmtiles')
const COG_KEY = Symbol.for('movk-maplibre:protocol:cog')

afterEach(() => {
  Reflect.deleteProperty(globalThis, PMTILES_KEY)
  Reflect.deleteProperty(globalThis, COG_KEY)
  vi.clearAllMocks()
})

describe('registerPmtilesProtocol', () => {
  it('registers the pmtiles protocol with the Protocol tile handler', () => {
    const protocol = registerPmtilesProtocol({ metadata: true })
    expect(Protocol).toHaveBeenCalledWith({ metadata: true })
    expect(addProtocol).toHaveBeenCalledWith('pmtiles', protocol.tile)
  })

  it('registers only once and returns the same instance', () => {
    const first = registerPmtilesProtocol()
    const second = registerPmtilesProtocol()
    expect(second).toBe(first)
    expect(addProtocol).toHaveBeenCalledTimes(1)
  })

  it('registers again after the global singleton is cleared', () => {
    registerPmtilesProtocol()
    Reflect.deleteProperty(globalThis, PMTILES_KEY)
    registerPmtilesProtocol()
    expect(addProtocol).toHaveBeenCalledTimes(2)
  })
})

describe('registerCogProtocol', () => {
  it('registers the cog protocol once', () => {
    registerCogProtocol()
    registerCogProtocol()
    expect(addProtocol).toHaveBeenCalledTimes(1)
    expect(addProtocol).toHaveBeenCalledWith('cog', cogProtocol)
  })

  it('registers again after the global singleton is cleared', () => {
    registerCogProtocol()
    Reflect.deleteProperty(globalThis, COG_KEY)
    registerCogProtocol()
    expect(addProtocol).toHaveBeenCalledTimes(2)
  })
})
