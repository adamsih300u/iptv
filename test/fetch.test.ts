import { describe, expect, it, vi } from 'vitest'
import { API_BASE, fetchApiSnapshot } from '../src/fetch.js'
import { snapshot } from './fixtures/api.js'

describe('fetchApiSnapshot', () => {
  it('downloads all API endpoints in parallel', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const body =
        url.endsWith('channels.json')
          ? snapshot.channels
          : url.endsWith('streams.json')
            ? snapshot.streams
            : url.endsWith('logos.json')
              ? snapshot.logos
              : url.endsWith('categories.json')
                ? snapshot.categories
                : url.endsWith('guides.json')
                  ? snapshot.guides
                  : snapshot.blocklist

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => body,
      } as Response
    })

    const result = await fetchApiSnapshot(fetchImpl)

    expect(fetchImpl).toHaveBeenCalledTimes(6)
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        `${API_BASE}/channels.json`,
        `${API_BASE}/streams.json`,
        `${API_BASE}/logos.json`,
        `${API_BASE}/categories.json`,
        `${API_BASE}/guides.json`,
        `${API_BASE}/blocklist.json`,
      ]),
    )
    expect(result.channels).toHaveLength(snapshot.channels.length)
    expect(result.streams).toHaveLength(snapshot.streams.length)
  })

  it('throws on HTTP errors', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      } as Response
    })

    await expect(fetchApiSnapshot(fetchImpl)).rejects.toThrow(/HTTP 500/)
  })
})
