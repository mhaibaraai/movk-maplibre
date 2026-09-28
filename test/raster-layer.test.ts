import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import MaplibreRasterLayer from '../src/runtime/components/layers/RasterLayer.vue'
import { logger } from '../src/runtime/utils/logger'
import { mountInMap } from './fixtures/mount-map'
import type { FakeStyleMap } from './fixtures/fake-style-map'

const created = vi.hoisted(() => [] as FakeStyleMap[])

vi.mock('maplibre-gl', async () => {
  const { fakeStyleMap } = await import('./fixtures/fake-style-map')
  function FakeGlMap() {
    const map = fakeStyleMap()
    created.push(map)
    return map
  }
  return { Map: FakeGlMap, LngLat: { convert: (v: unknown) => v } }
})

describe('MaplibreRasterLayer', () => {
  it('passes a protocol url to the raster source', async () => {
    const { map } = await mountInMap(created, () => h(MaplibreRasterLayer, { layerId: 'cog', url: 'cog://https://example.com/a.tif' }))
    expect(map.sources.get('cog')).toEqual({ type: 'raster', url: 'cog://https://example.com/a.tif', tileSize: 256 })
    expect(map.getLayer('cog')?.type).toBe('raster')
  })

  it('warns when neither url nor tiles is provided', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    await mountInMap(created, () => h(MaplibreRasterLayer, { layerId: 'empty' }))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"url" or "tiles"'))
    warn.mockRestore()
  })
})
