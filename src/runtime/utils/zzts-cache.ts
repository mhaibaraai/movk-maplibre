// ZZTS 协议的请求与缓存：失败重试、元素图片的压缩数据缓存与解码共享。

type Request = typeof globalThis.fetch

/** 首次重试的等待时长，之后逐次翻倍 */
const RETRY_DELAY = 500

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

export interface ZztsImageStore {
  /** 取元素图片位图；缺图或加载失败时为 undefined。每次调用都须配对一次 release */
  acquire: (url: string) => Promise<ImageBitmap | undefined>
  release: (url: string) => void
}

/**
 * 元素图片仓库：压缩数据（Blob）按 url 做 LRU 缓存，404 结果同样缓存以免重复请求，其余失败不缓存；
 * 解码后的位图按引用计数在并发拼合的瓦片间共享，最后一次释放时 close，避免位图常驻内存。
 */
export function createImageStore(request: Request, { size, retry }: { size: number, retry: number }): ZztsImageStore {
  const blobs = createLru<string, Promise<Blob | undefined>>(size)
  const decoded = new Map<string, { image: Promise<ImageBitmap | undefined>, refs: number }>()

  function loadBlob(url: string): Promise<Blob | undefined> {
    const hit = blobs.get(url)
    if (hit) return hit
    // 不绑定单个瓦片的 signal：图片由多个瓦片共享，某个瓦片取消不应中断其他瓦片
    const pending = fetchWithRetry(request, url, retry).then(async (res) => {
      if (res.status === 404) return undefined
      if (!res.ok) throw new Error(`ZZTS 图片加载失败：HTTP ${res.status}`)
      return await res.blob()
    })
    pending.catch(() => blobs.delete(url))
    blobs.set(url, pending)
    return pending
  }

  return {
    acquire(url) {
      const entry = decoded.get(url)
      if (entry) {
        entry.refs++
        return entry.image
      }
      const image = loadBlob(url)
        .then(blob => blob && createImageBitmap(blob))
        .catch(() => undefined)
      decoded.set(url, { image, refs: 1 })
      return image
    },
    release(url) {
      const entry = decoded.get(url)
      if (!entry || --entry.refs > 0) return
      decoded.delete(url)
      void entry.image.then(image => image?.close())
    }
  }
}
