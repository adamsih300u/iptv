import type {
  ApiCategory,
  ApiChannel,
  ApiLogo,
  ApiSnapshot,
  ApiStream,
  ChannelConfigEntry,
  ResolveResult,
  ResolveWarning,
  ResolvedChannel,
} from './types.js'

const QUALITY_RANK: Record<string, number> = {
  '2160p': 2160,
  '1080p': 1080,
  '720p': 720,
  '576p': 576,
  '540p': 540,
  '480p': 480,
  '404p': 404,
  '360p': 360,
  '288p': 288,
  '270p': 270,
  '240p': 240,
  '160p': 160,
  '144p': 144,
}

function qualityScore(quality: string | null): number {
  if (!quality) return 0
  const normalized = quality.toLowerCase()
  if (normalized in QUALITY_RANK) {
    return QUALITY_RANK[normalized]!
  }
  const match = normalized.match(/(\d{3,4})p/)
  return match ? Number(match[1]) : 0
}

function isGeoBlocked(stream: ApiStream): boolean {
  return (stream.label ?? '').toLowerCase().includes('geo-blocked')
}

/** Prefer non-geo-blocked streams, then higher quality. */
export function pickBestStream(streams: ApiStream[]): ApiStream | null {
  if (streams.length === 0) return null

  const ranked = [...streams].sort((a, b) => {
    const geoA = isGeoBlocked(a) ? 1 : 0
    const geoB = isGeoBlocked(b) ? 1 : 0
    if (geoA !== geoB) return geoA - geoB
    return qualityScore(b.quality) - qualityScore(a.quality)
  })

  return ranked[0] ?? null
}

function findLogo(logos: ApiLogo[], channelId: string): string | null {
  const forChannel = logos.filter((logo) => logo.channel === channelId)
  if (forChannel.length === 0) return null

  const inUse = forChannel.find((logo) => logo.in_use)
  const chosen = inUse ?? forChannel[0]
  return chosen?.url ?? null
}

function groupTitle(channel: ApiChannel | undefined, categories: Map<string, ApiCategory>): string {
  const firstCategory = channel?.categories[0]
  if (!firstCategory) return 'Uncategorized'
  return categories.get(firstCategory)?.name ?? firstCategory
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

export function resolveChannels(
  entries: ChannelConfigEntry[],
  snapshot: ApiSnapshot,
): ResolveResult {
  const channelById = indexById(snapshot.channels)
  const categoryById = indexById(snapshot.categories)
  const blocklistById = new Map(snapshot.blocklist.map((entry) => [entry.channel, entry]))

  const streamsByChannel = new Map<string, ApiStream[]>()
  for (const stream of snapshot.streams) {
    if (!stream.channel) continue
    const list = streamsByChannel.get(stream.channel) ?? []
    list.push(stream)
    streamsByChannel.set(stream.channel, list)
  }

  const resolved: ResolvedChannel[] = []
  const warnings: ResolveWarning[] = []

  for (const entry of entries) {
    const meta = channelById.get(entry.id)
    const blocked = blocklistById.get(entry.id)

    if (blocked && !entry.override) {
      warnings.push({
        channelId: entry.id,
        message: `blocklisted (${blocked.reason}): skipped unless you add an override.url — ${blocked.ref}`,
      })
      continue
    }

    if (blocked && entry.override) {
      warnings.push({
        channelId: entry.id,
        message: `blocklisted (${blocked.reason}) but using override.url — ${blocked.ref}`,
      })
    }

    if (entry.override) {
      resolved.push({
        id: entry.id,
        name: entry.override.title ?? meta?.name ?? entry.id,
        url: entry.override.url,
        logoUrl: findLogo(snapshot.logos, entry.id),
        groupTitle: groupTitle(meta, categoryById),
        referrer: entry.override.referrer ?? null,
        userAgent: entry.override.userAgent ?? null,
        quality: null,
        fromOverride: true,
      })
      continue
    }

    if (!meta) {
      warnings.push({
        channelId: entry.id,
        message: 'not found in channels.json; skipped',
      })
      continue
    }

    if (meta.closed) {
      warnings.push({
        channelId: entry.id,
        message: `channel closed on ${meta.closed}; skipped`,
      })
      continue
    }

    if (meta.is_nsfw) {
      warnings.push({
        channelId: entry.id,
        message: 'is_nsfw=true; skipped',
      })
      continue
    }

    const streams = streamsByChannel.get(entry.id) ?? []
    const best = pickBestStream(streams)
    if (!best) {
      warnings.push({
        channelId: entry.id,
        message: 'no stream URL in database; skipped',
      })
      continue
    }

    resolved.push({
      id: entry.id,
      name: meta.name,
      url: best.url,
      logoUrl: findLogo(snapshot.logos, entry.id),
      groupTitle: groupTitle(meta, categoryById),
      referrer: best.referrer,
      userAgent: best.user_agent,
      quality: best.quality,
      fromOverride: false,
    })
  }

  return { resolved, warnings }
}
