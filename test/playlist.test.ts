import { describe, expect, it } from 'vitest'
import { buildPlaylist } from '../src/playlist.js'
import type { ResolvedChannel } from '../src/types.js'

const sample: ResolvedChannel[] = [
  {
    id: 'FoxNewsChannel.us',
    name: 'Fox News Channel',
    url: 'http://example.com/fox.m3u8',
    logoUrl: 'https://example.com/fox.png',
    groupTitle: 'News',
    referrer: null,
    userAgent: null,
    quality: '480p',
    fromOverride: false,
  },
  {
    id: 'NewsmaxTV.us',
    name: 'Newsmax TV',
    url: 'https://example.com/newsmax.m3u8',
    logoUrl: null,
    groupTitle: 'News',
    referrer: 'https://example.com/',
    userAgent: 'Mozilla/5.0',
    quality: '720p',
    fromOverride: false,
  },
]

describe('buildPlaylist', () => {
  it('renders EXTINF attributes and optional headers', () => {
    const m3u = buildPlaylist(sample)

    expect(m3u.startsWith('#EXTM3U\n')).toBe(true)
    expect(m3u).toContain(
      '#EXTINF:-1 tvg-id="FoxNewsChannel.us" tvg-logo="https://example.com/fox.png" group-title="News",Fox News Channel (480p)',
    )
    expect(m3u).toContain('http://example.com/fox.m3u8')
    expect(m3u).toContain('#EXTVLCOPT:http-referrer=https://example.com/')
    expect(m3u).toContain('#EXTVLCOPT:http-user-agent=Mozilla/5.0')
    expect(m3u).toContain('https://example.com/newsmax.m3u8')
  })

  it('omits quality suffix for override channels', () => {
    const m3u = buildPlaylist([
      {
        ...sample[0]!,
        fromOverride: true,
        quality: '1080p',
      },
    ])
    expect(m3u).toContain(',Fox News Channel\n')
    expect(m3u).not.toContain('(1080p)')
  })
})
