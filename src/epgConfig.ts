import type { ApiGuide, EpgChannelMapping, ResolvedChannel } from './types.js'

/** Preferred EPG sites for US English lineup (more reliable for Emby). */
const SITE_PREFERENCE = [
  'tvpassport.com',
  'tvtv.us',
  'tvguide.com',
  'ontvtonight.com',
  'i.mjh.nz',
  'plex.tv',
  'pluto.tv',
]

function siteScore(guide: ApiGuide): number {
  const siteIndex = SITE_PREFERENCE.indexOf(guide.site)
  const siteRank = siteIndex === -1 ? SITE_PREFERENCE.length : siteIndex
  const langRank = guide.lang === 'en' ? 0 : 1
  return siteRank * 10 + langRank
}

export function pickGuide(guides: ApiGuide[], channelId: string): ApiGuide | null {
  const matches = guides.filter((guide) => guide.channel === channelId)
  if (matches.length === 0) return null

  const ranked = [...matches].sort((a, b) => siteScore(a) - siteScore(b))
  return ranked[0] ?? null
}

export function buildEpgMappings(
  channels: ResolvedChannel[],
  guides: ApiGuide[],
): { mappings: EpgChannelMapping[]; missing: string[] } {
  const mappings: EpgChannelMapping[] = []
  const missing: string[] = []

  for (const channel of channels) {
    const guide = pickGuide(guides, channel.id)
    if (!guide) {
      missing.push(channel.id)
      continue
    }

    mappings.push({
      site: guide.site,
      siteId: guide.site_id,
      xmltvId: channel.id,
      name: guide.site_name || channel.name,
      lang: guide.lang || 'en',
    })
  }

  return { mappings, missing }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Channels XML consumed by iptv-org/epg `npm run grab -- --channels=...`. */
export function buildChannelsXml(mappings: EpgChannelMapping[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<channels>',
    ...mappings.map(
      (m) =>
        `  <channel site="${escapeXml(m.site)}" lang="${escapeXml(m.lang)}" xmltv_id="${escapeXml(m.xmltvId)}" site_id="${escapeXml(m.siteId)}">${escapeXml(m.name)}</channel>`,
    ),
    '</channels>',
    '',
  ]
  return lines.join('\n')
}

/** Minimal empty guide so Emby always has a file even if grab is skipped. */
export function buildEmptyGuideXml(channels: ResolvedChannel[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
    '<tv generator-info-name="iptv-emby-bot">',
    ...channels.map(
      (channel) =>
        `  <channel id="${escapeXml(channel.id)}">\n    <display-name>${escapeXml(channel.name)}</display-name>\n  </channel>`,
    ),
    '</tv>',
    '',
  ]
  return lines.join('\n')
}
