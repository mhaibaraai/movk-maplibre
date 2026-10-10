// ZZTS 协议的请求与缓存：失败重试、可中止的共享请求、元素图片的压缩数据缓存与解码共享、缺图退避复查。

type Request = typeof globalThis.fetch

/** 首次重试的等待时长，之后逐次翻倍 */
const RETRY_DELAY = 500
/** 待生成内容的首次复查间隔，之后逐次翻倍；服务端按需生成通常需 1-4 分钟 */
const REFRESH_DELAY = 30_000
const MAX_REFRESH_DELAY = 120_000
/** 缺图记录的容量，与压缩数据缓存分开，避免被正常图片挤出后重复 404 */
const MISSING_CACHE_SIZE = 4096

/** 待生成内容的自动复查次数上限（合计约 13 分钟），超出后仅在再次访问时按间隔复查 */
export const MAX_REFRESHES = 8

/** 第 attempt 次复查前的等待时长：30s 起逐次翻倍，封顶 2 分钟 */
export function refreshDelay(attempt: number): number {
  return Math.min(REFRESH_DELAY * 2 ** attempt, MAX_REFRESH_DELAY)
}

export interface Lru<K, V> {
  get: (key: K) => V | undefined
  set: (key: K, value: V) => void
  delete: (key: K) => void
}

/** 基于 Map 插入顺序的 LRU：读取即刷新，超出容量时淘汰最久未用的条目 */
export function createLru<K, V>(size: number): Lru<K, V> {
  const map = new Map<K, V>()
  return {
    get(key) {
      if (!map.has(key)) return undefined
      const value = map.get(key)!
      map.delete(key)
      map.set(key, value)
      return value
    },
    set(key, value) {
      map.delete(key)
      map.set(key, value)
      if (map.size > size) map.delete(map.keys().next().value!)
    },
    delete(key) {
      map.delete(key)
    }
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
}

/** 网络错误与 5xx 视为临时故障，按指数退避重试；4xx（含 404 未生成）直接返回 */
export async function fetchWithRetry(request: Request, url: string, retry: number, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await request(url, signal ? { signal } : undefined)
      if (res.status < 500 || attempt >= retry) return res
    } catch (error) {
      if (signal?.aborted || attempt >= retry) throw error
    }
    await wait(RETRY_DELAY * 2 ** attempt, signal)
  }
}

/** 等待 promise，signal 中止时立即以中止原因 reject；不影响 promise 本身 */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export interface SharedRequestsOptions<T> {
  /** 已完成结果的缓存容量 */
  size: number
  /** 缓存值是否仍可用；返回 false 时重新加载，旧值交给加载函数 */
  isFresh?: (value: T) => boolean
}

/** 按键取值；未命中时以 load 加载，`previous` 为过期的旧值 */
export type SharedRequest<T> = (key: string, signal: AbortSignal, load: (signal: AbortSignal, previous?: T) => Promise<T>) => Promise<T>

interface PendingRequest<T> {
  promise: Promise<T>
  controller: AbortController
  refs: number
}

/**
 * 按键共享的可中止请求：同键并发调用共用一次加载，各调用方以自身 signal 订阅；
 * 全部调用方中止时中止加载并丢弃。成功结果进入 LRU，失败与中止不缓存。
 */
export function createSharedRequests<T>({ size, isFresh = () => true }: SharedRequestsOptions<T>): SharedRequest<T> {
  const done = createLru<string, T>(size)
  const pending = new Map<string, PendingRequest<T>>()

  function start(key: string, load: (signal: AbortSignal, previous?: T) => Promise<T>, previous?: T): PendingRequest<T> {
    const controller = new AbortController()
    const entry: PendingRequest<T> = { promise: load(controller.signal, previous), controller, refs: 0 }
    const settle = (value?: T) => {
      if (pending.get(key) !== entry) return
      pending.delete(key)
      if (value !== undefined) done.set(key, value)
    }
    entry.promise.then(settle, () => settle())
    pending.set(key, entry)
    return entry
  }

  return (key, signal, load) => {
    if (signal.aborted) return Promise.reject(signal.reason)
    const hit = done.get(key)
    if (hit !== undefined && isFresh(hit)) return Promise.resolve(hit)

    const entry = pending.get(key) ?? start(key, load, hit)
    entry.refs++
    const release = () => {
      if (--entry.refs > 0 || pending.get(key) !== entry) return
      pending.delete(key)
      entry.controller.abort()
    }
    const cleanup = () => signal.removeEventListener('abort', release)
    signal.addEventListener('abort', release, { once: true })
    entry.promise.then(cleanup, cleanup)
    return abortable(entry.promise, signal)
  }
}

export interface ZztsImageStore {
  /** 取元素图片位图；缺图或加载失败时为 undefined。每次调用都须配对一次 release */
  acquire: (url: string) => Promise<ImageBitmap | undefined>
  /** 最后一个持有方释放时 close 位图，并中止仍在进行的下载 */
  release: (url: string) => void
  /** 缺图（404）可再次请求的时间；非缺图、已超出自动复查次数或时间已过（复查遇到其他失败）时为 undefined */
  retryAt: (url: string) => number | undefined
}

interface MissingImage {
  attempts: number
  retryAt: number
}

interface DecodedImage {
  image: Promise<ImageBitmap | undefined>
  refs: number
  controller: AbortController
}

/**
 * 元素图片仓库：压缩数据（Blob）按 url 做 LRU 缓存；404 另行记录并按退避间隔复查，其余失败不缓存；
 * 解码后的位图按引用计数在并发拼合的瓦片间共享，最后一次释放时 close，避免位图常驻内存。
 */
export function createImageStore(request: Request, { size, retry }: { size: number, retry: number }): ZztsImageStore {
  const blobs = createLru<string, Blob>(size)
  const missing = createLru<string, MissingImage>(MISSING_CACHE_SIZE)
  const decoded = new Map<string, DecodedImage>()

  async function loadBlob(url: string, signal: AbortSignal): Promise<Blob | undefined> {
    const cached = blobs.get(url)
    if (cached) return cached
    const miss = missing.get(url)
    if (miss && Date.now() < miss.retryAt) return undefined

    const res = await fetchWithRetry(request, url, retry, signal)
    if (res.status === 404) {
      const attempts = (miss?.attempts ?? 0) + 1
      missing.set(url, { attempts, retryAt: Date.now() + refreshDelay(attempts - 1) })
      return undefined
    }
    if (!res.ok) throw new Error(`ZZTS 图片加载失败：HTTP ${res.status}`)
    const blob = await res.blob()
    missing.delete(url)
    blobs.set(url, blob)
    return blob
  }

  return {
    acquire(url) {
      const entry = decoded.get(url)
      if (entry) {
        entry.refs++
        return entry.image
      }
      // 下载归该条目所有，不绑定单个瓦片的 signal：最后一个持有方释放时才中止
      const controller = new AbortController()
      const image = loadBlob(url, controller.signal)
        .then(blob => blob && createImageBitmap(blob))
        .catch(() => undefined)
      decoded.set(url, { image, refs: 1, controller })
      return image
    },
    release(url) {
      const entry = decoded.get(url)
      if (!entry || --entry.refs > 0) return
      decoded.delete(url)
      entry.controller.abort()
      void entry.image.then(image => image?.close())
    },
    retryAt(url) {
      const miss = missing.get(url)
      return miss && miss.attempts < MAX_REFRESHES && miss.retryAt > Date.now() ? miss.retryAt : undefined
    }
  }
}
