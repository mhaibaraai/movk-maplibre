import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerPmtilesProtocol } from '../src/runtime/utils/pmtiles'
import { registerCogProtocol } from '../src/runtime/utils/cog'
import { registerZztsProtocol } from '../src/runtime/utils/zzts'

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
const ZZTS_KEY = Symbol.for('movk-maplibre:protocol:zzts')

afterEach(() => {
  Reflect.deleteProperty(globalThis, PMTILES_KEY)
  Reflect.deleteProperty(globalThis, COG_KEY)
  Reflect.deleteProperty(globalThis, ZZTS_KEY)
  vi.clearAllMocks()
  vi.unstubAllGlobals()
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

describe('registerZztsProtocol', () => {
  const MEDIA_URL = 'http://zzts.test/v1/zzts/layer/media?layerName=demo-01&dictCode=demo'
  const TILE_URL = `zzts://${MEDIA_URL}#15/27450/13368`
  const media = {
    name: 'demo-01',
    extent: { xmin: 121.46, ymin: 29.89, xmax: 121.76, ymax: 30.07 },
    minZoom: 6,
    maxZoom: 18,
    resolution: 0.7
  }
  const element = (id: string) => ({
    id,
    type: 'image',
    url: `http://zzts.test/images/${id}.webp`,
    extent: { xmin: 121, ymin: 29, xmax: 122, ymax: 32 }
  })
  const composed = { composed: true }

  function json(body: unknown): Response {
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  }

  type ElementsByLevel = (scale: number) => unknown[] | Record<string, unknown>

  function setup(elements: unknown[] | Record<string, unknown> | ElementsByLevel = [element('a')]) {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes('/elements?')) {
        const body = typeof elements === 'function' ? elements(Number(new URL(input).searchParams.get('scale'))) : elements
        return json(Array.isArray(body) ? { elements: body } : body)
      }
      if (input.includes('/media?')) return json(media)
      if (input.includes('missing')) return new Response(null, { status: 404 })
      return { ok: true, blob: async () => Object.assign(new Blob(['webp']), { id: input.split('/').at(-1)!.replace('.webp', '') }) }
    })
    const drawImage = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async (blob: Blob) => ({ width: 512, height: 512, id: (blob as Blob & { id?: string }).id })))
    vi.stubGlobal('OffscreenCanvas', vi.fn(function () {
      return { getContext: () => ({ drawImage }), transferToImageBitmap: () => composed }
    }))
    registerZztsProtocol({ fetch: fetchMock as unknown as typeof fetch })
    const handler = addProtocol.mock.calls[0]![1] as (params: { url: string }, controller: AbortController) => Promise<{ data: unknown }>
    return { fetchMock, drawImage, load: (url: string, controller = new AbortController()) => handler({ url }, controller) }
  }

  it('registers the zzts protocol once', () => {
    registerZztsProtocol()
    registerZztsProtocol()
    expect(addProtocol).toHaveBeenCalledTimes(1)
    expect(addProtocol).toHaveBeenCalledWith('zzts', expect.any(Function))
  })

  it('answers the source url with TileJSON built from media metadata', async () => {
    const { load, fetchMock } = setup()
    const { data } = await load(`zzts://${MEDIA_URL}`)

    expect(fetchMock).toHaveBeenCalledWith(MEDIA_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(data).toMatchObject({ tiles: [`zzts://${MEDIA_URL}#{z}/{x}/{y}`], bounds: [121.46, 29.89, 121.76, 30.07], tileSize: 512 })
  })

  it('composes tile elements into one bitmap', async () => {
    const { load, drawImage } = setup([element('a'), element('b'), element('a')])
    const { data } = await load(TILE_URL)

    expect(data).toBe(composed)
    expect(drawImage).toHaveBeenCalledTimes(2)
  })

  it('ignores non-image elements and returns an empty tile when nothing is drawable', async () => {
    const { load, drawImage } = setup([{ ...element('v'), type: 'vector' }])
    const { data } = await load(TILE_URL)

    expect(drawImage).not.toHaveBeenCalled()
    expect((data as ArrayBuffer).byteLength).toBe(0)
  })

  it('downloads an element image once across tiles', async () => {
    const { load, fetchMock } = setup()
    await load(TILE_URL)
    await load(`zzts://${MEDIA_URL}#15/27451/13368`)

    const imageRequests = fetchMock.mock.calls.filter(([url]) => url.endsWith('.webp'))
    expect(imageRequests).toHaveLength(1)
  })

  it('fills ungenerated elements with the next coarser level drawn underneath', async () => {
    let fineScale = 0
    const { load, fetchMock, drawImage } = setup((scale) => {
      fineScale ||= scale
      return scale === fineScale
        ? [element('fine'), { ...element('pending'), png_status: 0 }]
        : [element('coarse')]
    })
    const { data } = await load(TILE_URL)

    const scales = fetchMock.mock.calls
      .filter(([url]) => url.includes('/elements?'))
      .map(([url]) => Number(new URL(url).searchParams.get('scale')))
    expect(scales).toEqual([fineScale, fineScale * 2])
    expect(fetchMock.mock.calls.some(([url]) => url.includes('pending'))).toBe(false)
    expect(data).toBe(composed)
    const drawn = drawImage.mock.calls.map(([image]) => image.id)
    expect(drawn).toEqual(['coarse', 'fine'])
  })

  it('treats failed image loads as holes', async () => {
    let fineScale = 0
    const { load, drawImage } = setup((scale) => {
      fineScale ||= scale
      return scale === fineScale ? [element('missing')] : [element('coarse')]
    })
    await load(TILE_URL)

    expect(drawImage.mock.calls.map(([image]) => image.id)).toEqual(['coarse'])
  })

  it('remembers missing images instead of requesting them again', async () => {
    const { load, fetchMock } = setup([element('missing')])
    await load(TILE_URL)
    await load(`zzts://${MEDIA_URL}#15/27451/13368`)

    expect(fetchMock.mock.calls.filter(([url]) => url.includes('missing'))).toHaveLength(1)
  })

  it('stops falling back after a few coarser levels', async () => {
    const { load, fetchMock } = setup([{ ...element('pending'), png_status: 0 }])
    const { data } = await load(TILE_URL)

    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/elements?'))).toHaveLength(4)
    expect((data as ArrayBuffer).byteLength).toBe(0)
  })

  it('rejects with the service message on error payloads', async () => {
    const { load } = setup({ code: 500, msg: 'bbox 经度跨度超过 20°' })
    await expect(load(TILE_URL)).rejects.toThrow('bbox 经度跨度超过 20°')
  })

  it('stops before composing when the tile request is aborted', async () => {
    const { load, drawImage } = setup()
    const controller = new AbortController()
    controller.abort()

    await expect(load(TILE_URL, controller)).rejects.toThrow()
    expect(drawImage).not.toHaveBeenCalled()
  })
})
