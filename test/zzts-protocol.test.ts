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
  vi.useRealTimers()
})

const MEDIA_URL = 'http://zzts.test/v1/zzts/layer/media?layerName=demo-01&dictCode=demo'
// 镇海范围内的 z15 瓦片及其同组右邻
const TILE = '15/27452/13520'
const NEIGHBOUR = '15/27453/13520'
const PARENT = '14/13726/6760'
const COMPLETE_MAX_AGE = 31_536_000
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
/** 服务端尚未生成的元素：png_status 为 0，地址带占位版本 */
const pending = (id: string) => ({ ...element(id), url: `http://zzts.test/images/${id}.webp?v=0-0`, png_status: 0 })
const composed = { composed: true }
const imageId = (url: string) => url.split('/').at(-1)!.replace(/\.webp.*$/, '')

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

type ElementsBody = unknown[] | Record<string, unknown>
type ElementsByQuery = (params: URLSearchParams) => ElementsBody

/** 挂起直到中止的请求，用于观察取消是否传到 fetch */
function hanging(signal?: AbortSignal | null): Promise<never> {
  return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }))
}

function setup(elements: ElementsBody | ElementsByQuery = [element('a')], hang?: (url: string) => boolean) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (hang?.(input)) return hanging(init?.signal)
    if (input.includes('/elements?')) {
      const body = typeof elements === 'function' ? elements(new URL(input).searchParams) : elements
      return json(Array.isArray(body) ? { elements: body } : body)
    }
    if (input.includes('/media?')) return json(media)
    if (input.includes('missing') || input.includes('v=0-0')) return new Response(null, { status: 404 })
    return { ok: true, status: 200, blob: async () => Object.assign(new Blob(['webp']), { id: imageId(input) }) }
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
  const handler = addProtocol.mock.calls[0]![1] as (params: { url: string }, controller: AbortController) => Promise<{ data: unknown, cacheControl?: string }>
  const elementCalls = () => fetchMock.mock.calls.map(([url]) => url).filter(url => url.includes('/elements?'))
  const imageCalls = () => fetchMock.mock.calls.map(([url]) => url).filter(url => url.includes('/images/')).map(imageId)
  const drawn = () => context.drawImage.mock.calls.map(([image]) => image.id)
  const signalOf = (part: string) => fetchMock.mock.calls.find(([url]) => url.includes(part))?.[1]?.signal
  return {
    fetchMock,
    context,
    canvasSizes,
    elementCalls,
    imageCalls,
    drawn,
    signalOf,
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

  it('fills missing images from the parent level drawn underneath', async () => {
    let fineScale = 0
    const { load, elementCalls, drawn } = setup((params) => {
      const scale = Number(params.get('scale'))
      fineScale ||= scale
      return scale === fineScale ? [element('fine'), element('missing')] : [element('coarse')]
    })
    const { data } = await load(tileUrl(TILE))

    const [, parentScale] = elementCalls().map(url => Number(new URL(url).searchParams.get('scale')))
    expect(elementCalls()).toHaveLength(2)
    expect(parentScale! / fineScale).toBeCloseTo(2, 2)
    expect(data).toBe(composed)
    expect(drawn()).toEqual(['coarse', 'fine'])
  })

  it('reuses the parent tile element list when filling holes', async () => {
    const { load, elementCalls, drawn } = setup(params => Number(params.get('scale')) < 10000 ? [element('fine'), pending('gap')] : [element('coarse')])
    await load(tileUrl(PARENT))
    await load(tileUrl(TILE))

    expect(elementCalls()).toHaveLength(2)
    expect(drawn()).toEqual(['coarse', 'coarse', 'fine'])
  })

  it('downloads only the coarser images covering the holes', async () => {
    const [west, south, east, north] = tileBBox({ z: 15, x: 27452, y: 13520 })
    const mid = (west + east) / 2
    const at = (id: string, xmin: number, xmax: number, margin = 0) => ({
      id,
      type: 'image',
      url: `http://zzts.test/images/${id}.webp`,
      extent: { xmin, ymin: south - margin, xmax, ymax: north + margin }
    })
    const { load, imageCalls } = setup(params => Number(params.get('scale')) < 10000
      ? [at('left', west, mid), { ...at('right', mid, east), png_status: 0 }]
      : [at('coarse-left', west, mid, 0.01), at('coarse-right', mid, east, 0.01)])
    await load(tileUrl(TILE))

    expect(imageCalls().sort()).toEqual(['coarse-right', 'left'])
  })

  it('skips images the service has not generated yet and asks for a refresh', async () => {
    let fineScale = 0
    const { load, imageCalls, drawn } = setup((params) => {
      const scale = Number(params.get('scale'))
      fineScale ||= scale
      return scale === fineScale ? [element('fine'), pending('later')] : [element('coarse')]
    })
    const { cacheControl } = await load(tileUrl(TILE))

    expect(imageCalls()).not.toContain('later')
    expect(drawn()).toEqual(['coarse', 'fine'])
    expect(cacheControl).toBe('max-age=30')
  })

  it('draws generated images once the element list refreshes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    let fineScale = 0
    let generated = false
    const { load, elementCalls, drawn } = setup((params) => {
      const scale = Number(params.get('scale'))
      fineScale ||= scale
      if (scale !== fineScale) return [element('coarse')]
      return [generated ? element('later') : pending('later')]
    })
    await load(tileUrl(TILE))
    expect(drawn()).toEqual(['coarse'])

    generated = true
    const early = await load(tileUrl(TILE))
    expect(elementCalls()).toHaveLength(2)
    expect(early.cacheControl).toMatch(/^max-age=\d+$/)

    vi.setSystemTime(Date.now() + 30_000)
    const refreshed = await load(tileUrl(TILE))
    expect(elementCalls()).toHaveLength(3)
    expect(drawn().at(-1)).toBe('later')
    expect(refreshed.cacheControl).toBe(`max-age=${COMPLETE_MAX_AGE}`)
  })

  it('keeps the previous element list when a refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    let fineScale = 0
    let fail = false
    const { load, drawn } = setup((params) => {
      const scale = Number(params.get('scale'))
      fineScale ||= scale
      if (scale !== fineScale) return [element('coarse')]
      return fail ? { code: 500, msg: 'down' } : [element('fine'), pending('later')]
    })
    await load(tileUrl(TILE))

    fail = true
    vi.setSystemTime(Date.now() + 30_000)
    const { cacheControl } = await load(tileUrl(TILE))
    expect(drawn()).toEqual(['coarse', 'fine', 'coarse', 'fine'])
    expect(cacheControl).toBe('max-age=60')
  })

  // MapLibre 只在响应带过期信息时更新瓦片过期时间，缺省会沿用已过期的旧值而立即重载，故完整瓦片也须给出长期有效期
  it('marks complete tiles as long-lived instead of omitting the expiry', async () => {
    const { load } = setup()
    const { cacheControl } = await load(tileUrl(TILE))

    expect(cacheControl).toBe(`max-age=${COMPLETE_MAX_AGE}`)
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

  it('composes on a larger canvas and asks single tiles for finer grids at a higher pixel ratio', async () => {
    const { load, canvasSizes, elementCalls } = setup()
    await load(tileUrl(TILE, 'pixelRatio=2&'))

    expect(canvasSizes).toEqual([[1024, 1024]])
    expect(elementCalls()).toHaveLength(1)
    expect(new URL(elementCalls()[0]!).searchParams.get('width')).toBe('1024')
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

  it('aborts the element request of a cancelled tile', async () => {
    const { load, signalOf } = setup([element('a')], url => url.includes('/elements?'))
    const controller = new AbortController()
    const tile = load(tileUrl(TILE), controller)
    await vi.waitFor(() => expect(signalOf('/elements?')).toBeDefined())
    controller.abort()

    await expect(tile).rejects.toThrow()
    expect(signalOf('/elements?')!.aborted).toBe(true)
  })

  it('aborts image downloads of a cancelled tile', async () => {
    const { load, signalOf } = setup([element('a')], url => url.endsWith('.webp'))
    const controller = new AbortController()
    const tile = load(tileUrl(TILE), controller)
    await vi.waitFor(() => expect(signalOf('.webp')).toBeDefined())
    controller.abort()

    await expect(tile).rejects.toThrow()
    expect(signalOf('.webp')!.aborted).toBe(true)
  })

  it('keeps a shared download alive while another tile still needs it', async () => {
    const { load, signalOf } = setup([element('a')], url => url.endsWith('.webp'))
    const first = new AbortController()
    const second = new AbortController()
    const tiles = [load(tileUrl(TILE), first), load(tileUrl(NEIGHBOUR), second)]
    await vi.waitFor(() => expect(signalOf('.webp')).toBeDefined())
    first.abort()
    await expect(tiles[0]).rejects.toThrow()
    expect(signalOf('.webp')!.aborted).toBe(false)

    second.abort()
    await expect(tiles[1]).rejects.toThrow()
    expect(signalOf('.webp')!.aborted).toBe(true)
  })

  it('stops before composing when the tile request is aborted', async () => {
    const { load, context } = setup()
    const controller = new AbortController()
    controller.abort()

    await expect(load(tileUrl(TILE), controller)).rejects.toThrow()
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})
