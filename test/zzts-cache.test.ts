import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_REFRESHES, abortable, createImageStore, createLru, createSharedRequests, fetchWithRetry, refreshDelay } from '../src/runtime/utils/zzts-cache'

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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('refreshDelay', () => {
  it('doubles from 30s and caps at two minutes', () => {
    expect([0, 1, 2, 3, 9].map(refreshDelay)).toEqual([30_000, 60_000, 120_000, 120_000, 120_000])
  })
})

describe('abortable', () => {
  it('rejects as soon as the signal aborts', async () => {
    const controller = new AbortController()
    const pending = abortable(new Promise(() => {}), controller.signal)
    controller.abort()

    await expect(pending).rejects.toThrow()
  })

  it('passes the result through otherwise', async () => {
    expect(await abortable(Promise.resolve(1), new AbortController().signal)).toBe(1)
  })
})

describe('createSharedRequests', () => {
  function setup(isFresh?: (value: number) => boolean) {
    const loads: { signal: AbortSignal, previous?: number, result: ReturnType<typeof deferred<number>> }[] = []
    const shared = createSharedRequests<number>({ size: 8, isFresh })
    const get = (signal = new AbortController().signal, key = 'k') => shared(key, signal, (loadSignal, previous) => {
      const result = deferred<number>()
      loads.push({ signal: loadSignal, previous, result })
      return result.promise
    })
    return { loads, get }
  }

  it('merges concurrent calls into one load and caches the result', async () => {
    const { loads, get } = setup()
    const pending = Promise.all([get(), get()])
    loads[0]!.result.resolve(7)

    expect(await pending).toEqual([7, 7])
    expect(await get()).toBe(7)
    expect(loads).toHaveLength(1)
  })

  it('aborts the load once every caller has aborted and loads again later', async () => {
    const { loads, get } = setup()
    const a = new AbortController()
    const b = new AbortController()
    const pendingA = get(a.signal)
    const pendingB = get(b.signal)
    a.abort()
    await expect(pendingA).rejects.toThrow()
    expect(loads[0]!.signal.aborted).toBe(false)
    b.abort()
    await expect(pendingB).rejects.toThrow()
    expect(loads[0]!.signal.aborted).toBe(true)

    const again = get()
    loads[1]!.result.resolve(3)
    expect(await again).toBe(3)
  })

  it('keeps loading for the remaining caller', async () => {
    const { loads, get } = setup()
    const a = new AbortController()
    const pendingA = get(a.signal)
    const pendingB = get()
    a.abort()
    loads[0]!.result.resolve(5)

    await expect(pendingA).rejects.toThrow()
    expect(await pendingB).toBe(5)
  })

  it('does not cache failures', async () => {
    const { loads, get } = setup()
    const failed = get()
    loads[0]!.result.reject(new Error('boom'))
    await expect(failed).rejects.toThrow('boom')

    const again = get()
    loads[1]!.result.resolve(1)
    expect(await again).toBe(1)
  })

  it('reloads stale values and hands the previous value to the loader', async () => {
    const { loads, get } = setup(value => value > 1)
    const first = get()
    loads[0]!.result.resolve(1)
    await first

    const second = get()
    expect(loads[1]!.previous).toBe(1)
    loads[1]!.result.resolve(2)
    expect(await second).toBe(2)
  })

  it('rejects at once without loading when the signal is already aborted', async () => {
    const { loads, get } = setup()
    const controller = new AbortController()
    controller.abort()

    await expect(get(controller.signal)).rejects.toThrow()
    expect(loads).toHaveLength(0)
  })
})

describe('createImageStore', () => {
  function setup(responses: Record<string, number> = {}, size = 8) {
    const close = vi.fn()
    const decode = vi.fn(async () => ({ width: 512, height: 512, close }))
    vi.stubGlobal('createImageBitmap', decode)
    const request = vi.fn(async (url: string, _init?: RequestInit) => status(responses[url] ?? 200))
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

  it('aborts the download when the last holder releases it first', async () => {
    const { store, request } = setup()
    const response = deferred<Response>()
    let signal: AbortSignal | undefined
    request.mockImplementationOnce((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return response.promise
    })
    const image = store.acquire('x')
    store.release('x')

    expect(signal?.aborted).toBe(true)
    response.reject(new DOMException('aborted', 'AbortError'))
    expect(await image).toBeUndefined()
  })

  it('retries missing images with backoff and reports when to retry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { store, request } = setup({ m: 404 })
    await store.acquire('m')
    store.release('m')
    expect(store.retryAt('m')).toBe(Date.now() + refreshDelay(0))

    await store.acquire('m')
    store.release('m')
    expect(request).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + refreshDelay(0))
    await store.acquire('m')
    store.release('m')
    expect(request).toHaveBeenCalledTimes(2)
    expect(store.retryAt('m')).toBe(Date.now() + refreshDelay(1))
  })

  it('does not report a retry time that has already passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { store, request } = setup({ m: 404 })
    await store.acquire('m')
    store.release('m')
    request.mockImplementation(async () => status(503))
    vi.setSystemTime(Date.now() + refreshDelay(0))
    await store.acquire('m')
    store.release('m')

    expect(store.retryAt('m')).toBeUndefined()
  })

  it('stops reporting retries after too many attempts', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { store } = setup({ m: 404 })
    for (let attempt = 0; attempt < MAX_REFRESHES; attempt++) {
      await store.acquire('m')
      store.release('m')
      vi.setSystemTime(Date.now() + refreshDelay(attempt))
    }

    expect(store.retryAt('m')).toBeUndefined()
  })

  it('remembers missing images after the compressed cache evicts them', async () => {
    const { store, request } = setup({ m: 404 }, 1)
    for (const url of ['m', 'a', 'b', 'm']) {
      await store.acquire(url)
      store.release(url)
    }

    expect(request.mock.calls.filter(([url]) => url === 'm')).toHaveLength(1)
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
