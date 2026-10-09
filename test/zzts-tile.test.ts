import { describe, expect, it } from 'vitest'
import type { ZztsExtent, ZztsMedia } from '../src/runtime/utils/zzts-tile'
import { elementsUrl, parseZztsUrl, planDraws, tileBBox, tileScale, zztsTileJson } from '../src/runtime/utils/zzts-tile'

const MEDIA_URL = 'http://zzts.test/v1/zzts/layer/media?layerName=demo-01&dictCode=demo'

const media: ZztsMedia = {
  name: 'demo-01',
  extent: { xmin: 121.46, ymin: 29.89, xmax: 121.76, ymax: 30.07 },
  minZoom: 6,
  maxZoom: 18,
  resolution: 0.7
}

describe('parseZztsUrl', () => {
  it('strips the protocol prefix for TileJSON requests', () => {
    expect(parseZztsUrl(`zzts://${MEDIA_URL}`)).toEqual({ mediaUrl: MEDIA_URL })
  })

  it('extracts tile coordinates from the hash', () => {
    expect(parseZztsUrl(`zzts://${MEDIA_URL}#15/27450/13368`)).toEqual({
      mediaUrl: MEDIA_URL,
      tile: { z: 15, x: 27450, y: 13368 }
    })
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

describe('zztsTileJson', () => {
  it('derives bounds and zoom range from the media metadata', () => {
    const tileJson = zztsTileJson(`zzts://${MEDIA_URL}`, media)

    expect(tileJson).toEqual({
      tiles: [`zzts://${MEDIA_URL}#{z}/{x}/{y}`],
      bounds: [121.46, 29.89, 121.76, 30.07],
      minzoom: 5,
      maxzoom: 17,
      tileSize: 512,
      name: 'demo-01'
    })
  })
})

describe('elementsUrl', () => {
  it('keeps the service query and appends viewport parameters', () => {
    const url = new URL(elementsUrl(MEDIA_URL, { z: 15, x: 27450, y: 13368 }))

    expect(url.pathname).toBe('/v1/zzts/layer/media/elements')
    expect(url.searchParams.get('layerName')).toBe('demo-01')
    expect(url.searchParams.get('dictCode')).toBe('demo')
    expect(url.searchParams.get('width')).toBe('512')
    expect(url.searchParams.get('height')).toBe('512')
    expect(Number(url.searchParams.get('scale'))).toBeGreaterThan(0)
    expect(url.searchParams.get('bbox')!.split(',')).toHaveLength(4)
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
