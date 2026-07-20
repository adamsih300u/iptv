import { describe, expect, it, vi } from 'vitest'
import { filterAliveStreams, probeStream } from '../src/validate.js'

function mockResponse(status: number, ok = status >= 200 && status < 400): Response {
  return {
    ok,
    status,
    statusText: String(status),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response
}

describe('probeStream', () => {
  it('treats successful HEAD as alive', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(200))
    const result = await probeStream('https://example.com/live.m3u8', { fetchImpl, timeoutMs: 1000 })
    expect(result.alive).toBe(true)
    expect(result.method).toBe('HEAD')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to GET when HEAD fails', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') throw new Error('HEAD unsupported')
      return mockResponse(206)
    })

    const result = await probeStream('https://example.com/live.m3u8', { fetchImpl, timeoutMs: 1000 })
    expect(result.alive).toBe(true)
    expect(result.method).toBe('GET')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('marks 404 GET as dead', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return mockResponse(405)
      return mockResponse(404, false)
    })

    const result = await probeStream('https://example.com/missing.m3u8', {
      fetchImpl,
      timeoutMs: 1000,
    })
    expect(result.alive).toBe(false)
    expect(result.error).toMatch(/404/)
  })

  it('sends referrer and user-agent headers', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => mockResponse(200))
    await probeStream('https://example.com/live.m3u8', {
      fetchImpl,
      referrer: 'https://example.com/',
      userAgent: 'TestAgent/1.0',
      timeoutMs: 1000,
    })

    expect(fetchImpl).toHaveBeenCalled()
    const [, init] = fetchImpl.mock.calls[0]!
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers.Referer).toBe('https://example.com/')
    expect(headers['User-Agent']).toBe('TestAgent/1.0')
  })
})

describe('filterAliveStreams', () => {
  it('returns only alive URLs and dedupes probes', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('dead')) return mockResponse(404, false)
      return mockResponse(200)
    })

    const { alive, results } = await filterAliveStreams(
      [
        { url: 'https://example.com/a.m3u8' },
        { url: 'https://example.com/dead.m3u8' },
        { url: 'https://example.com/a.m3u8' },
      ],
      { fetchImpl, timeoutMs: 1000, concurrency: 2 },
    )

    expect(alive.map((s) => s.url)).toEqual([
      'https://example.com/a.m3u8',
      'https://example.com/a.m3u8',
    ])
    expect(results).toHaveLength(2)
    expect(results.filter((r) => r.alive)).toHaveLength(1)
  })
})
