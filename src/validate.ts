import type { ApiStream } from './types.js'

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export interface ProbeOptions {
  timeoutMs?: number
  fetchImpl?: FetchFn
  /** Max concurrent probes (default 8). */
  concurrency?: number
}

export interface ProbeResult {
  url: string
  alive: boolean
  status?: number
  method?: 'HEAD' | 'GET'
  error?: string
}

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_CONCURRENCY = 8
const ACCEPTABLE_STATUS = new Set([200, 206, 301, 302, 303, 307, 308])

function buildHeaders(referrer?: string | null, userAgent?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: '*/*',
  }
  if (userAgent) headers['User-Agent'] = userAgent
  if (referrer) headers.Referer = referrer
  return headers
}

function isAcceptableStatus(status: number): boolean {
  return ACCEPTABLE_STATUS.has(status) || (status >= 200 && status < 400)
}

async function requestWithTimeout(
  fetchImpl: FetchFn,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'follow' })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Probe a single stream URL: prefer HEAD, fall back to short GET.
 * Uses the same referrer/user-agent Emby will get via #EXTVLCOPT when present.
 */
export async function probeStream(
  url: string,
  options: ProbeOptions & { referrer?: string | null; userAgent?: string | null } = {},
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const headers = buildHeaders(options.referrer, options.userAgent)

  try {
    const head = await requestWithTimeout(
      fetchImpl,
      url,
      { method: 'HEAD', headers },
      timeoutMs,
    )

    // Some CDNs reject HEAD; fall through to GET on 405/501/403-ish probe failures.
    if (isAcceptableStatus(head.status) && head.status !== 405 && head.status !== 501) {
      return { url, alive: true, status: head.status, method: 'HEAD' }
    }

    if (head.status !== 405 && head.status !== 501 && head.status < 400) {
      return { url, alive: true, status: head.status, method: 'HEAD' }
    }
  } catch (error) {
    // Fall through to GET — many hosts simply don't answer HEAD.
    if (!(error instanceof Error) || error.name !== 'AbortError') {
      // continue to GET
    } else {
      return { url, alive: false, method: 'HEAD', error: 'timeout' }
    }
  }

  try {
    const get = await requestWithTimeout(
      fetchImpl,
      url,
      {
        method: 'GET',
        headers: {
          ...headers,
          Range: 'bytes=0-1023',
        },
      },
      timeoutMs,
    )

    if (isAcceptableStatus(get.status)) {
      // Drain a tiny bit so the connection can close cleanly, then abort reading.
      try {
        await get.arrayBuffer()
      } catch {
        /* ignore body read errors */
      }
      return { url, alive: true, status: get.status, method: 'GET' }
    }

    return {
      url,
      alive: false,
      status: get.status,
      method: 'GET',
      error: `HTTP ${get.status}`,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'timeout'
          : error.message
        : String(error)
    return { url, alive: false, method: 'GET', error: message }
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index]!)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(workers)
  return results
}

export interface StreamProbeInput {
  url: string
  referrer?: string | null
  userAgent?: string | null
}

/** Probe many URLs with bounded concurrency; returns only those that appear alive. */
export async function filterAliveStreams(
  streams: StreamProbeInput[],
  options: ProbeOptions = {},
): Promise<{ alive: StreamProbeInput[]; results: ProbeResult[] }> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY

  // Deduplicate by URL while keeping first headers seen.
  const byUrl = new Map<string, StreamProbeInput>()
  for (const stream of streams) {
    if (!byUrl.has(stream.url)) byUrl.set(stream.url, stream)
  }
  const unique = [...byUrl.values()]

  const results = await mapPool(unique, concurrency, (stream) => {
    const probeOpts: ProbeOptions & { referrer?: string | null; userAgent?: string | null } = {
      ...options,
    }
    if (stream.referrer !== undefined) probeOpts.referrer = stream.referrer
    if (stream.userAgent !== undefined) probeOpts.userAgent = stream.userAgent
    return probeStream(stream.url, probeOpts)
  })

  const aliveUrls = new Set(results.filter((r) => r.alive).map((r) => r.url))
  const alive = streams.filter((s) => aliveUrls.has(s.url))

  return { alive, results }
}

/** Convenience: probe ApiStream candidates and return those that are alive. */
export async function filterAliveApiStreams(
  streams: ApiStream[],
  options: ProbeOptions = {},
): Promise<{ alive: ApiStream[]; results: ProbeResult[] }> {
  const { alive: aliveInputs, results } = await filterAliveStreams(
    streams.map((s) => ({
      url: s.url,
      referrer: s.referrer,
      userAgent: s.user_agent,
    })),
    options,
  )

  const aliveUrls = new Set(aliveInputs.map((s) => s.url))
  return {
    alive: streams.filter((s) => aliveUrls.has(s.url)),
    results,
  }
}
