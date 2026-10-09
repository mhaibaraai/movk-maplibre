import { afterEach, describe, expect, it, vi } from 'vitest'
import { createImageStore, createLru, fetchWithRetry } from '../src/runtime/utils/zzts-cache'

const status = (code: number) => new Response(code === 200 ? 'img' : null, { status: code })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createLru', () => {
  it('evicts the least recently used entry', () => {
    const lru = createLru<string, number>(2)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.get('a')
    lru.set('c', 3)

    expect(lru.get('a')).toBe(1)
    expect(lru.get('b')).toBeUndefined()
    expect(lru.get('c')).toBe(3)
  })
})

describe('fetchWithRetry', () => {
  it('retries server errors with backoff and returns the last response', async () => {
    vi.useFakeTimers()
    const request = vi.fn(async () => status(503))
    const pending = fetchWithRetry(request, 'u', 2)
    await vi.advanceTimersByTimeAsync(1500)

    expect((await pending).status).toBe(503)
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('does not retry client errors', async () => {
    const request = vi.fn(async () => status(404))
    expect((await fetchWithRetry(request, 'u', 2)).status).toBe(404)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('retries network failures and recovers', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(status(200))
    const pending = fetchWithRetry(request, 'u', 2)
    await vi.advanceTimersByTimeAsync(500)

    expect((await pending).status).toBe(200)
  })

  it('stops waiting when aborted', async () => {
    const controller = new AbortController()
    const request = vi.fn(async () => status(500))
    const pending = fetchWithRetry(request, 'u', 2, controller.signal)
    controller.abort()

    await expect(pending).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('createImageStore', () => {
  function setup(responses: Record<string, number> = {}, size = 8) {
    const close = vi.fn()
    const decode = vi.fn(async () => ({ width: 512, height: 512, close }))
    vi.stubGlobal('createImageBitmap', decode)
    const request = vi.fn(async (url: string) => status(responses[url] ?? 200))
    return { request, decode, close, store: createImageStore(request, { size, retry: 0 }) }
  }

  it('shares one decoded bitmap while tiles hold it and closes it after the last release', async () => {
    const { store, decode, close } = setup()
    const [a, b] = await Promise.all([store.acquire('x'), store.acquire('x')])

    expect(a).toBe(b)
    expect(decode).toHaveBeenCalledTimes(1)
    store.release('x')
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
    store.release('x')
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1))
  })

  it('keeps the compressed image and decodes again without downloading', async () => {
    const { store, request, decode } = setup()
    await store.acquire('x')
    store.release('x')
    await store.acquire('x')

    expect(request).toHaveBeenCalledTimes(1)
    expect(decode).toHaveBeenCalledTimes(2)
  })

  it('remembers missing images', async () => {
    const { store, request } = setup({ m: 404 })
    expect(await store.acquire('m')).toBeUndefined()
    store.release('m')
    expect(await store.acquire('m')).toBeUndefined()

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('requests failed images again', async () => {
    const { store, request } = setup({ f: 500 })
    expect(await store.acquire('f')).toBeUndefined()
    store.release('f')
    await store.acquire('f')

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('downloads again after eviction', async () => {
    const { store, request } = setup({}, 1)
    for (const url of ['a', 'b', 'a']) {
      await store.acquire(url)
      store.release(url)
    }
    expect(request).toHaveBeenCalledTimes(3)
  })
})
