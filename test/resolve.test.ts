import { describe, expect, it } from 'vitest'
import { collectProbeTargets, pickBestStream, resolveChannels } from '../src/resolve.js'
import { snapshot, streams } from './fixtures/api.js'

describe('pickBestStream', () => {
  it('prefers non-geo-blocked streams even at lower quality', () => {
    const best = pickBestStream(streams.filter((s) => s.channel === 'FoxNewsChannel.us'))
    expect(best?.url).toBe('http://example.com/fox-480.m3u8')
  })

  it('returns null for an empty list', () => {
    expect(pickBestStream([])).toBeNull()
  })

  it('breaks quality ties with stable URL order', () => {
    const best = pickBestStream([
      {
        channel: 'X.us',
        feed: 'SD',
        title: 'X',
        url: 'http://z.example.com/a.m3u8',
        referrer: null,
        user_agent: null,
        quality: '720p',
        label: null,
      },
      {
        channel: 'X.us',
        feed: 'SD',
        title: 'X',
        url: 'http://a.example.com/a.m3u8',
        referrer: null,
        user_agent: null,
        quality: '720p',
        label: null,
      },
    ])
    expect(best?.url).toBe('http://a.example.com/a.m3u8')
  })
})

describe('resolveChannels', () => {
  it('resolves database streams with logos and groups', () => {
    const result = resolveChannels([{ id: 'FoxNewsChannel.us' }, { id: 'NewsmaxTV.us' }], snapshot)

    expect(result.resolved).toHaveLength(2)
    expect(result.resolved[0]).toMatchObject({
      id: 'FoxNewsChannel.us',
      url: 'http://example.com/fox-480.m3u8',
      logoUrl: 'https://example.com/fox.png',
      groupTitle: 'News',
      fromOverride: false,
    })
    expect(result.resolved[1]).toMatchObject({
      id: 'NewsmaxTV.us',
      logoUrl: 'https://example.com/newsmax.png',
      referrer: 'https://example.com/',
      userAgent: 'Mozilla/5.0',
    })
  })

  it('skips blocklisted channels without override', () => {
    const result = resolveChannels([{ id: 'CNN.us' }], snapshot)
    expect(result.resolved).toHaveLength(0)
    expect(result.warnings[0]?.message).toMatch(/blocklisted/)
  })

  it('allows blocklisted channels when override is present', () => {
    const result = resolveChannels(
      [
        {
          id: 'CNN.us',
          override: { url: 'https://example.com/cnn.m3u8', title: 'CNN' },
        },
      ],
      snapshot,
    )

    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0]).toMatchObject({
      id: 'CNN.us',
      name: 'CNN',
      url: 'https://example.com/cnn.m3u8',
      fromOverride: true,
    })
    expect(result.warnings.some((w) => w.message.includes('using override.url'))).toBe(true)
  })

  it('skips channels with no streams', () => {
    const result = resolveChannels([{ id: 'ClosedCh.us' }, { id: 'Missing.us' }], snapshot)
    expect(result.resolved).toHaveLength(0)
    expect(result.warnings.map((w) => w.message).join(' ')).toMatch(/closed/)
    expect(result.warnings.map((w) => w.message).join(' ')).toMatch(/not found/)
  })

  it('uses Uncategorized when categories are empty', () => {
    const result = resolveChannels([{ id: 'WHECTV101.us' }], snapshot)
    expect(result.resolved[0]?.groupTitle).toBe('Uncategorized')
  })

  it('only considers alive URLs when a probe set is provided', () => {
    const result = resolveChannels([{ id: 'FoxNewsChannel.us' }], snapshot, {
      aliveUrls: new Set(['http://example.com/fox-144.m3u8']),
      probed: true,
    })

    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0]?.url).toBe('http://example.com/fox-144.m3u8')
  })

  it('skips channels when every candidate failed the probe', () => {
    const result = resolveChannels([{ id: 'FoxNewsChannel.us' }], snapshot, {
      aliveUrls: new Set(),
      probed: true,
    })

    expect(result.resolved).toHaveLength(0)
    expect(result.warnings[0]?.message).toMatch(/failed liveness probe/)
  })

  it('skips override URLs that failed the probe', () => {
    const result = resolveChannels(
      [{ id: 'CNN.us', override: { url: 'https://example.com/cnn.m3u8' } }],
      snapshot,
      { aliveUrls: new Set(), probed: true },
    )
    expect(result.resolved).toHaveLength(0)
    expect(result.warnings.some((w) => w.message.includes('override.url failed'))).toBe(true)
  })
})

describe('collectProbeTargets', () => {
  it('includes database streams and overrides for configured channels only', () => {
    const targets = collectProbeTargets(
      [
        { id: 'FoxNewsChannel.us' },
        { id: 'CNN.us', override: { url: 'https://example.com/cnn.m3u8' } },
      ],
      snapshot,
    )

    const urls = targets.map((t) => t.url)
    expect(urls).toContain('http://example.com/fox-480.m3u8')
    expect(urls).toContain('https://example.com/cnn.m3u8')
    expect(urls).not.toContain('https://example.com/newsmax.m3u8')
  })
})
