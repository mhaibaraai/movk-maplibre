import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerZztsProtocol } from '../src/runtime/utils/zzts'
import { deleteZztsClip, setZztsClip } from '../src/runtime/utils/zzts-clip'
import { tileBBox } from '../src/runtime/utils/zzts-tile'
import { logger } from '../src/runtime/utils/logger'

const { addProtocol } = vi.hoisted(() => ({ addProtocol: vi.fn() }))
vi.mock('maplibre-gl', () => ({ addProtocol }))

const SCHEMES = ['zzts', 'zzts-auth']

afterEach(() => {
  SCHEMES.forEach(scheme => Reflect.deleteProperty(globalThis, Symbol.for(`movk-maplibre:protocol:${scheme}`)))
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const MEDIA_URL = 'http://zzts.test/v1/zzts/layer/media?layerName=demo-01&dictCode=demo'
// 镇海范围内的 z15 瓦片及其同组右邻
const TILE = '15/27452/13520'
const NEIGHBOUR = '15/27453/13520'
const tileUrl = (tile: string, hash = '') => `zzts://${MEDIA_URL}#${hash}tile=${tile}`
const media = {
  name: 'demo-01',
  extent: { xmin: 121.46, ymin: 29.89, xmax: 121.76, ymax: 30.07 },
  minZoom: 6,
  maxZoom: 18,
  resolution: 0.7
}
// extent 按 id 微移，使不同元素不会被 extent 去重合并
const element = (id: string) => {
  const offset = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) * 1e-6
  return {
    id,
    type: 'image',
    url: `http://zzts.test/images/${id}.webp`,
    extent: { xmin: 121 - offset, ymin: 29, xmax: 122, ymax: 32 }
  }
}
const composed = { composed: true }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

type ElementsBody = unknown[] | Record<string, unknown>
type ElementsByQuery = (params: URLSearchParams) => ElementsBody

function setup(elements: ElementsBody | ElementsByQuery = [element('a')]) {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.includes('/elements?')) {
      const body = typeof elements === 'function' ? elements(new URL(input).searchParams) : elements
      return json(Array.isArray(body) ? { elements: body } : body)
    }
    if (input.includes('/media?')) return json(media)
    if (input.includes('missing')) return new Response(null, { status: 404 })
    return { ok: true, status: 200, blob: async () => Object.assign(new Blob(['webp']), { id: input.split('/').at(-1)!.replace('.webp', '') }) }
  })
  const context = { drawImage: vi.fn(), fill: vi.fn(), globalCompositeOperation: 'source-over' }
  const canvasSizes: number[][] = []
  vi.stubGlobal('createImageBitmap', vi.fn(async (blob: Blob) => ({ width: 512, height: 512, id: (blob as Blob & { id?: string }).id, close: vi.fn() })))
  vi.stubGlobal('OffscreenCanvas', vi.fn(function (width: number, height: number) {
    canvasSizes.push([width, height])
    return { getContext: () => context, transferToImageBitmap: () => composed }
  }))
  vi.stubGlobal('Path2D', vi.fn(function () {
    return { moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn() }
  }))
  registerZztsProtocol({ fetch: fetchMock as unknown as typeof fetch, retry: 0 })
  const handler = addProtocol.mock.calls[0]![1] as (params: { url: string }, controller: AbortController) => Promise<{ data: unknown }>
  const elementCalls = () => fetchMock.mock.calls.map(([url]) => url).filter(url => url.includes('/elements?'))
  return {
    fetchMock,
    context,
    canvasSizes,
    elementCalls,
    load: (url: string, controller = new AbortController()) => handler({ url }, controller)
  }
}

describe('registerZztsProtocol', () => {
  it('registers each scheme once', () => {
    registerZztsProtocol()
    registerZztsProtocol()
    registerZztsProtocol({ scheme: 'zzts-auth' })

    expect(addProtocol).toHaveBeenCalledTimes(2)
    expect(addProtocol.mock.calls.map(([scheme]) => scheme)).toEqual(['zzts', 'zzts-auth'])
  })

  it('warns when options are passed to an already registered scheme', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    registerZztsProtocol()
    registerZztsProtocol({ scheme: 'zzts' })
    expect(warn).not.toHaveBeenCalled()
    registerZztsProtocol({ cacheSize: 8 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('zzts'))
    warn.mockRestore()
  })
})

describe('zzts protocol', () => {
  it('answers the source url with TileJSON built from media metadata', async () => {
    const { load, fetchMock } = setup()
    const { data } = await load(`zzts://${MEDIA_URL}`)

    expect(fetchMock.mock.calls[0]![0]).toBe(MEDIA_URL)
    expect(data).toMatchObject({ tiles: [`zzts://${MEDIA_URL}#tile={z}/{x}/{y}`], bounds: [121.46, 29.89, 121.76, 30.07], tileSize: 512 })
  })

  it('composes tile elements into one bitmap', async () => {
    const { load, context } = setup([element('a'), element('b'), element('a')])
    const { data } = await load(tileUrl(TILE))

    expect(data).toBe(composed)
    expect(context.drawImage).toHaveBeenCalledTimes(2)
  })

  it('drops elements repeating an extent under another id', async () => {
    const { load, context } = setup([element('a'), { ...element('a'), id: 'a2' }])
    await load(tileUrl(TILE))

    expect(context.drawImage).toHaveBeenCalledTimes(1)
  })

  it('shares one elements request and one download across tiles of a group', async () => {
    const { load, elementCalls, fetchMock } = setup()
    await Promise.all([load(tileUrl(TILE)), load(tileUrl(NEIGHBOUR))])

    expect(elementCalls()).toHaveLength(1)
    expect(new URL(elementCalls()[0]!).searchParams.get('width')).toBe('1024')
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('.webp'))).toHaveLength(1)
  })

  it('falls back to a single-tile request when the merged request comes back empty', async () => {
    const { load, elementCalls, context } = setup(params => Number(params.get('width')) > 512 ? [] : [element('a')])
    await load(tileUrl(TILE))

    expect(elementCalls()).toHaveLength(2)
    expect(context.drawImage).toHaveBeenCalledTimes(1)
  })

  it('ignores non-image elements and returns an empty tile when nothing is drawable', async () => {
    const { load, context } = setup([{ ...element('v'), type: 'vector' }])
    const { data } = await load(tileUrl(TILE))

    expect(context.drawImage).not.toHaveBeenCalled()
    expect((data as ArrayBuffer).byteLength).toBe(0)
  })

  it('skips tiles outside the layer extent without requesting elements', async () => {
    const { load, elementCalls } = setup()
    const { data } = await load(tileUrl('15/0/0'))

    expect(elementCalls()).toHaveLength(0)
    expect((data as ArrayBuffer).byteLength).toBe(0)
  })

  it('fills missing images with the next coarser level drawn underneath', async () => {
    let fineScale = 0
    const { load, elementCalls, context } = setup((params) => {
      const scale = Number(params.get('scale'))
      fineScale ||= scale
      return scale === fineScale ? [element('fine'), element('missing')] : [element('coarse')]
    })
    const { data } = await load(tileUrl(TILE))

    expect(elementCalls().map(url => Number(new URL(url).searchParams.get('scale')))).toEqual([fineScale, fineScale * 2])
    expect(data).toBe(composed)
    expect(context.drawImage.mock.calls.map(([image]) => image.id)).toEqual(['coarse', 'fine'])
  })

  it('relies on request results rather than service status fields', async () => {
    const { load, context } = setup([{ ...element('a'), png_status: 0 }])
    await load(tileUrl(TILE))

    expect(context.drawImage.mock.calls.map(([image]) => image.id)).toEqual(['a'])
  })

  it('remembers missing images instead of requesting them again', async () => {
    const { load, fetchMock } = setup([element('missing')])
    await load(tileUrl(TILE))
    await load(tileUrl('15/27454/13520'))

    expect(fetchMock.mock.calls.filter(([url]) => url.includes('missing'))).toHaveLength(1)
  })

  it('stops falling back after a few coarser levels', async () => {
    const { load, elementCalls } = setup([element('missing')])
    const { data } = await load(tileUrl(TILE))

    expect(elementCalls()).toHaveLength(4)
    expect((data as ArrayBuffer).byteLength).toBe(0)
  })

  it('composes on a larger canvas and asks for finer grids at a higher pixel ratio', async () => {
    const { load, canvasSizes, elementCalls } = setup()
    await load(tileUrl(TILE, 'pixelRatio=2&'))

    expect(canvasSizes).toEqual([[1024, 1024]])
    expect(new URL(elementCalls()[0]!).searchParams.get('width')).toBe('2048')
  })

  it('clips composed tiles to the registered area', async () => {
    const [west, south, east, north] = tileBBox({ z: 15, x: 27452, y: 13520 })
    const mid = (west + east) / 2
    setZztsClip('half', { type: 'Polygon', coordinates: [[[west, south], [mid, south], [mid, north], [west, north], [west, south]]] })
    const { load, context } = setup()
    await load(tileUrl(TILE, 'clip=half&'))

    expect(context.globalCompositeOperation).toBe('destination-in')
    expect(context.fill).toHaveBeenCalledWith(expect.anything(), 'evenodd')
    deleteZztsClip('half')
  })

  it('skips tiles outside the clip area without requesting elements', async () => {
    setZztsClip('far', { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] })
    const { load, elementCalls } = setup()
    const { data } = await load(tileUrl(TILE, 'clip=far&'))

    expect(elementCalls()).toHaveLength(0)
    expect((data as ArrayBuffer).byteLength).toBe(0)
    deleteZztsClip('far')
  })

  it('treats an unknown clip key as an empty area', async () => {
    const { load, elementCalls } = setup()
    const { data } = await load(tileUrl(TILE, 'clip=gone&'))

    expect(elementCalls()).toHaveLength(0)
    expect((data as ArrayBuffer).byteLength).toBe(0)
  })

  it('rejects with the service message on error payloads', async () => {
    const { load } = setup({ code: 500, msg: 'bbox 经度跨度超过 20°' })
    await expect(load(tileUrl(TILE))).rejects.toThrow('bbox 经度跨度超过 20°')
  })

  it('stops before composing when the tile request is aborted', async () => {
    const { load, context } = setup()
    const controller = new AbortController()
    controller.abort()

    await expect(load(tileUrl(TILE), controller)).rejects.toThrow()
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})
