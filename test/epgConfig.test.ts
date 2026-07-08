import { describe, expect, it } from 'vitest'
import {
  buildChannelsXml,
  buildEmptyGuideXml,
  buildEpgMappings,
  pickGuide,
} from '../src/epgConfig.js'
import { guides } from './fixtures/api.js'
import type { ResolvedChannel } from '../src/types.js'

const channels: ResolvedChannel[] = [
  {
    id: 'FoxNewsChannel.us',
    name: 'Fox News Channel',
    url: 'http://example.com/fox.m3u8',
    logoUrl: null,
    groupTitle: 'News',
    referrer: null,
    userAgent: null,
    quality: '480p',
    fromOverride: false,
  },
  {
    id: 'WHECTV101.us',
    name: 'WHEC-TV 10.1',
    url: 'https://example.com/whec.m3u8',
    logoUrl: null,
    groupTitle: 'Uncategorized',
    referrer: null,
    userAgent: null,
    quality: null,
    fromOverride: false,
  },
]

describe('pickGuide', () => {
  it('prefers english tvpassport.com over other sites', () => {
    const guide = pickGuide(guides, 'FoxNewsChannel.us')
    expect(guide?.site).toBe('tvpassport.com')
    expect(guide?.lang).toBe('en')
  })
})

describe('buildEpgMappings', () => {
  it('maps channels with guides and reports missing ones', () => {
    const { mappings, missing } = buildEpgMappings(channels, guides)
    expect(mappings).toHaveLength(1)
    expect(mappings[0]).toMatchObject({
      site: 'tvpassport.com',
      xmltvId: 'FoxNewsChannel.us',
      siteId: 'fox-news',
    })
    expect(missing).toEqual(['WHECTV101.us'])
  })
})

describe('xml builders', () => {
  it('builds channels.xml for epg grabber', () => {
    const { mappings } = buildEpgMappings(channels, guides)
    const xml = buildChannelsXml(mappings)
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain(
      '<channel site="tvpassport.com" lang="en" xmltv_id="FoxNewsChannel.us" site_id="fox-news">Fox News</channel>',
    )
  })

  it('builds a placeholder guide.xml', () => {
    const xml = buildEmptyGuideXml(channels)
    expect(xml).toContain('<channel id="FoxNewsChannel.us">')
    expect(xml).toContain('<display-name>Fox News Channel</display-name>')
  })
})
