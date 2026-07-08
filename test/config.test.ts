import { describe, expect, it } from 'vitest'
import { loadChannelsConfig, parseChannelsConfig } from '../src/config.js'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('parseChannelsConfig', () => {
  it('parses a valid allow-list', () => {
    const config = parseChannelsConfig({
      channels: [
        { id: 'FoxNewsChannel.us' },
        {
          id: 'CNN.us',
          override: {
            url: 'https://example.com/cnn.m3u8',
            title: 'CNN',
            referrer: 'https://example.com/',
            userAgent: 'Mozilla/5.0',
          },
        },
      ],
    })

    expect(config.channels).toHaveLength(2)
    expect(config.channels[0]?.id).toBe('FoxNewsChannel.us')
    expect(config.channels[1]?.override?.url).toBe('https://example.com/cnn.m3u8')
  })

  it('rejects duplicate ids', () => {
    expect(() =>
      parseChannelsConfig({
        channels: [{ id: 'A.us' }, { id: 'A.us' }],
      }),
    ).toThrow(/duplicate channel id/)
  })

  it('rejects override without url', () => {
    expect(() =>
      parseChannelsConfig({
        channels: [{ id: 'A.us', override: { title: 'A' } }],
      }),
    ).toThrow(/override.url is required/)
  })

  it('loads the project channels.yaml', () => {
    const config = loadChannelsConfig(join(ROOT, 'config', 'channels.yaml'))
    expect(config.channels.length).toBeGreaterThanOrEqual(17)
    expect(config.channels.map((c) => c.id)).toContain('FoxNewsChannel.us')
    expect(config.channels.map((c) => c.id)).toContain('CNN.us')
  })
})
