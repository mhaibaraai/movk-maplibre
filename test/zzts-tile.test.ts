import { describe, expect, it } from 'vitest'
import type { ZztsExtent, ZztsMedia } from '../src/runtime/utils/zzts-tile'
import {
  coarserSource,
  elementsUrl,
  intersectBBox,
  metatileRange,
  parseZztsUrl,
  planDraws,
  planQueries,
  projectRings,
  tileBBox,
  tileRange,
  tileScale,
  zztsSourceUrl,
  zztsTileJson
} from '../src/runtime/utils/zzts-tile'

const MEDIA_URL = 'http://zzts.test/v1/zzts/layer/media?layerName=demo-01&dictCode=demo'

const media: ZztsMedia = {
  name: 'demo-01',
  extent: { xmin: 121.46, ymin: 29.89, xmax: 121.76, ymax: 30.07 },
  minZoom: 6,
  maxZoom: 18,
  resolution: 0.7
}
const mediaBBox = [121.46, 29.89, 121.76, 30.07] as const

describe('parseZztsUrl', () => {
  it('strips the protocol prefix for TileJSON requests', () => {
    expect(parseZztsUrl(`zzts://${MEDIA_URL}`)).toEqual({ mediaUrl: MEDIA_URL, pixelRatio: 1 })
  })

  it('accepts any registered scheme', () => {
    expect(parseZztsUrl(`zzts-auth://${MEDIA_URL}`).mediaUrl).toBe(MEDIA_URL)
  })

  it('extracts tile coordinates and layer options from the hash', () => {
    expect(parseZztsUrl(`zzts://${MEDIA_URL}#pixelRatio=2&clip=c1&tile=15/27450/13368`)).toEqual({
      mediaUrl: MEDIA_URL,
      pixelRatio: 2,
      clip: 'c1',
      tile: { z: 15, x: 27450, y: 13368 }
    })
  })

  it('clamps the pixel ratio into the supported range', () => {
    expect(parseZztsUrl(`zzts://${MEDIA_URL}#pixelRatio=0.5`).pixelRatio).toBe(1)
    expect(parseZztsUrl(`zzts://${MEDIA_URL}#pixelRatio=9`).pixelRatio).toBe(4)
  })
})

describe('zztsSourceUrl', () => {
  it('omits default options', () => {
    expect(zztsSourceUrl('zzts', MEDIA_URL)).toBe(`zzts://${MEDIA_URL}`)
  })

  it('round-trips layer options through the hash', () => {
    const url = zztsSourceUrl('zzts', MEDIA_URL, { pixelRatio: 2, clip: 'c1' })
    expect(parseZztsUrl(url)).toEqual({ mediaUrl: MEDIA_URL, pixelRatio: 2, clip: 'c1' })
  })
})

describe('tileBBox', () => {
  it('covers the whole world at zoom 0', () => {
    const [west, south, east, north] = tileBBox({ z: 0, x: 0, y: 0 })
    expect([west, east]).toEqual([-180, 180])
    expect(north).toBeCloseTo(85.0511, 4)
    expect(south).toBeCloseTo(-85.0511, 4)
  })

  it('returns the north-east quadrant at zoom 1', () => {
    const [west, south, east, north] = tileBBox({ z: 1, x: 1, y: 0 })
    expect([west, south, east]).toEqual([0, 0, 180])
    expect(north).toBeCloseTo(85.0511, 4)
  })
})

describe('tileScale', () => {
  it('uses the 96dpi scale denominator of a 512px tile', () => {
    // 服务端在该比例尺选取 GeoSOT 17 级
    expect(tileScale(15, 29.98)).toBeCloseTo(7820, -1)
    expect(tileScale(16, 29.98)).toBeCloseTo(tileScale(15, 29.98) / 2)
  })
})

describe('intersectBBox', () => {
  it('returns the overlap or undefined', () => {
    expect(intersectBBox([0, 0, 10, 10], [5, 5, 20, 20])).toEqual([5, 5, 10, 10])
    expect(intersectBBox([0, 0, 10, 10], [10, 0, 20, 10])).toBeUndefined()
  })
})

describe('metatileRange', () => {
  it('groups neighbouring tiles into one range', () => {
    expect(metatileRange({ z: 15, x: 27451, y: 13369 }, 2)).toEqual({ z: 15, x0: 27450, y0: 13368, x1: 27452, y1: 13370 })
  })

  it('keeps the group within the 20° longitude span', () => {
    // z5 单瓦片跨 11.25°，两块即超过 20°
    expect(metatileRange({ z: 5, x: 26, y: 13 }, 2)).toEqual(tileRange({ z: 5, x: 26, y: 13 }))
    // z6 单瓦片跨 5.625°，4 块超限，降为 2 的幂 2 块
    expect(metatileRange({ z: 6, x: 53, y: 26 }, 4)).toEqual({ z: 6, x0: 52, y0: 26, x1: 54, y1: 28 })
  })

  it('keeps the merged canvas within the size the service answers', () => {
    const tile = { z: 15, x: 27451, y: 13369 }
    expect(metatileRange(tile, 2, 1.5)).toEqual(metatileRange(tile, 2))
    expect(metatileRange(tile, 2, 2)).toEqual(tileRange(tile))
    expect(metatileRange(tile, 4, 1)).toEqual(metatileRange(tile, 2))
  })
})

describe('coarserSource', () => {
  it('requests the ancestor tile so its element list is shared', () => {
    expect(coarserSource({ z: 15, x: 27451, y: 13369 }, 0)).toEqual({ tile: { z: 15, x: 27451, y: 13369 }, coarser: 0 })
    expect(coarserSource({ z: 15, x: 27451, y: 13369 }, 2)).toEqual({ tile: { z: 13, x: 6862, y: 3342 }, coarser: 0 })
  })

  it('coarsens the scale instead below the coarsest request zoom', () => {
    expect(coarserSource({ z: 6, x: 53, y: 26 }, 2)).toEqual({ tile: { z: 5, x: 26, y: 13 }, coarser: 1 })
    expect(coarserSource({ z: 3, x: 6, y: 3 }, 1)).toEqual({ tile: { z: 3, x: 6, y: 3 }, coarser: 1 })
  })
})

describe('planQueries', () => {
  it('clips the request bbox to the layer extent and shrinks the canvas accordingly', () => {
    const [query, ...rest] = planQueries(tileRange({ z: 8, x: 214, y: 105 }), mediaBBox, 1)
    expect(rest).toHaveLength(0)
    expect(query!.bbox).toEqual([...mediaBBox])
    expect(query!.width).toBeLessThan(512)
    expect(query!.height).toBeLessThan(512)
  })

  it('returns nothing outside the extent', () => {
    expect(planQueries(tileRange({ z: 8, x: 0, y: 0 }), mediaBBox, 1)).toEqual([])
  })

  it('requests coarse tiles at the coarsest validated scale', () => {
    const [query] = planQueries(tileRange({ z: 0, x: 0, y: 0 }), mediaBBox, 1)
    expect(query!.scale).toBeCloseTo(tileScale(5, (29.89 + 30.07) / 2), 3)
  })

  it('splits wide extents into spans the service accepts', () => {
    const queries = planQueries(tileRange({ z: 1, x: 1, y: 0 }), [70, 10, 135, 55], 1)
    expect(queries).toHaveLength(4)
    queries.forEach(({ bbox: [west, , east] }) => expect(east - west).toBeLessThanOrEqual(20))
    expect(queries[0]!.bbox[0]).toBe(70)
    expect(queries.at(-1)!.bbox[2]).toBe(135)
  })

  it('scales the canvas and the scale with pixel ratio and coarser levels', () => {
    const range = tileRange({ z: 15, x: 27450, y: 13368 })
    const extent = [121, 31, 122, 32] as const
    const [base] = planQueries(range, extent, 1)
    const [hidpi] = planQueries(range, extent, 2)
    const [coarse] = planQueries(range, extent, 1, 1)

    expect(base).toMatchObject({ width: 512, height: 512 })
    expect(hidpi).toMatchObject({ width: 1024, height: 1024 })
    expect(hidpi!.scale).toBeCloseTo(base!.scale / 2)
    expect(coarse!.scale).toBeCloseTo(base!.scale * 2)
  })
})

describe('zztsTileJson', () => {
  it('derives bounds and zoom range from the media metadata', () => {
    const tileJson = zztsTileJson(`zzts://${MEDIA_URL}`, media)

    expect(tileJson).toEqual({
      tiles: [`zzts://${MEDIA_URL}#tile={z}/{x}/{y}`],
      bounds: [...mediaBBox],
      minzoom: 0,
      maxzoom: 17,
      tileSize: 512,
      name: 'demo-01'
    })
  })

  it('keeps layer options in the tile template', () => {
    const { tiles } = zztsTileJson(`zzts://${MEDIA_URL}#pixelRatio=2`, media)
    expect(tiles).toEqual([`zzts://${MEDIA_URL}#pixelRatio=2&tile={z}/{x}/{y}`])
  })

  it('reaches native resolution one zoom earlier at pixel ratio 2', () => {
    expect(zztsTileJson(`zzts://${MEDIA_URL}#pixelRatio=2`, media).maxzoom).toBe(16)
  })

  it('narrows bounds to the clip area', () => {
    const { bounds } = zztsTileJson(`zzts://${MEDIA_URL}`, media, [121.5, 29.5, 122, 30])
    expect(bounds).toEqual([121.5, 29.89, 121.76, 30])
  })
})

describe('elementsUrl', () => {
  it('keeps the service query and appends the request parameters', () => {
    const url = new URL(elementsUrl(MEDIA_URL, { bbox: [121.5, 29.9, 121.6, 30], width: 300, height: 360, scale: 7820 }))

    expect(url.pathname).toBe('/v1/zzts/layer/media/elements')
    expect(url.searchParams.get('layerName')).toBe('demo-01')
    expect(url.searchParams.get('dictCode')).toBe('demo')
    expect(url.searchParams.get('width')).toBe('300')
    expect(url.searchParams.get('height')).toBe('360')
    expect(url.searchParams.get('scale')).toBe('7820')
    expect(url.searchParams.get('bbox')).toBe('121.5,29.9,121.6,30')
  })
})

describe('planDraws', () => {
  const tile = { z: 15, x: 27450, y: 13368 }
  const [west, south, east, north] = tileBBox(tile)

  it('maps an element covering the tile onto the full canvas', () => {
    const extent: ZztsExtent = { xmin: west - 1, ymin: south - 1, xmax: east + 1, ymax: north + 1 }
    const draws = planDraws(extent, tile)

    expect(draws).toHaveLength(1)
    const { target, source } = draws[0]!
    target.forEach((value, i) => expect(value).toBeCloseTo([0, 0, 512, 512][i]!, 6))
    expect(source[0]).toBeCloseTo((west - extent.xmin) / (extent.xmax - extent.xmin), 9)
    expect(source[1]).toBeCloseTo((extent.ymax - north) / (extent.ymax - extent.ymin), 9)
  })

  it('scales targets to the canvas size', () => {
    const extent: ZztsExtent = { xmin: west - 1, ymin: south - 1, xmax: east + 1, ymax: north + 1 }
    expect(planDraws(extent, tile, 1024)[0]!.target).toEqual([0, 0, 1024, 1024])
  })

  it('places a partial element inside the tile', () => {
    const midLon = (west + east) / 2
    const extent: ZztsExtent = { xmin: midLon, ymin: south - 1, xmax: east + 1, ymax: north + 1 }
    const [draw] = planDraws(extent, tile)

    expect(draw!.target[0]).toBeCloseTo(256, 6)
    expect(draw!.target[2]).toBeCloseTo(256, 6)
    expect(draw!.source[0]).toBe(0)
  })

  it('snaps targets outward to whole pixels', () => {
    const lonAt = (px: number) => west + (east - west) * px / 512
    const extent: ZztsExtent = { xmin: lonAt(100.3), ymin: south - 1, xmax: lonAt(200.6), ymax: north + 1 }
    const [draw] = planDraws(extent, tile)

    expect(draw!.target[0]).toBe(100)
    expect(draw!.target[0] + draw!.target[2]).toBe(201)
    draw!.target.forEach(value => expect(Number.isInteger(value)).toBe(true))
  })

  it('skips elements outside the tile', () => {
    expect(planDraws({ xmin: east + 1, ymin: south, xmax: east + 2, ymax: north }, tile)).toEqual([])
  })

  it('splits low zoom tiles into contiguous strips along latitude', () => {
    const lowTile = { z: 5, x: 26, y: 13 }
    const [w, s, e, n] = tileBBox(lowTile)
    const extent: ZztsExtent = { xmin: w, ymin: s, xmax: e, ymax: n }
    const draws = planDraws(extent, lowTile)

    expect(draws.length).toBeGreaterThan(1)
    draws.slice(1).forEach((draw, i) => {
      const prev = draws[i]!
      // 整像素取整后相邻条带重叠不超过 1px，且不留缝
      expect(prev.target[1] + prev.target[3] - draw.target[1]).toBeGreaterThanOrEqual(0)
      expect(prev.target[1] + prev.target[3] - draw.target[1]).toBeLessThanOrEqual(1)
      expect(draw.source[1]).toBeCloseTo(prev.source[1] + prev.source[3], 9)
    })
    const sourceHeight = draws.reduce((sum, draw) => sum + draw.source[3], 0)
    expect(sourceHeight).toBeCloseTo(1, 9)
    // 墨卡托下高纬条带被拉伸：同等目标高度对应更少的源纬度
    expect(draws[0]!.source[3]).toBeLessThan(draws.at(-1)!.source[3])
  })
})

describe('projectRings', () => {
  it('projects lng/lat rings onto tile pixels', () => {
    const tile = { z: 1, x: 1, y: 0 }
    const [ring] = projectRings([[[0, 0], [180, 0], [90, 85.0511]]], tile, 512)

    expect(ring![0]).toEqual([0, 512])
    expect(ring![1]).toEqual([512, 512])
    expect(ring![2]![0]).toBe(256)
    expect(ring![2]![1]).toBeCloseTo(0, 1)
  })

  it('clamps polar latitudes to the mercator limit', () => {
    const [ring] = projectRings([[[0, 90], [0, -90]]], { z: 0, x: 0, y: 0 }, 512)
    ring!.forEach(([, y]) => expect(Number.isFinite(y)).toBe(true))
  })
})
