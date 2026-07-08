/** Shared IPTV API and project types */

export interface ChannelOverride {
  url: string
  title?: string
  referrer?: string
  userAgent?: string
}

export interface ChannelConfigEntry {
  id: string
  /** Optional manual stream when the database has none (or is blocklisted). */
  override?: ChannelOverride
}

export interface ChannelsConfig {
  channels: ChannelConfigEntry[]
}

export interface ApiChannel {
  id: string
  name: string
  alt_names: string[]
  network: string | null
  owners: string[]
  country: string
  categories: string[]
  is_nsfw: boolean
  launched: string | null
  closed: string | null
  replaced_by: string | null
  website: string | null
}

export interface ApiStream {
  channel: string | null
  feed: string | null
  title: string
  url: string
  referrer: string | null
  user_agent: string | null
  quality: string | null
  label: string | null
}

export interface ApiLogo {
  channel: string
  feed: string | null
  in_use: boolean
  tags: string[]
  width: number
  height: number
  format: string
  url: string
}

export interface ApiCategory {
  id: string
  name: string
  description?: string
}

export interface ApiGuide {
  channel: string | null
  feed: string | null
  site: string
  site_id: string
  site_name: string
  lang: string
}

export interface ApiBlocklistEntry {
  channel: string
  reason: string
  ref: string
}

export interface ApiSnapshot {
  channels: ApiChannel[]
  streams: ApiStream[]
  logos: ApiLogo[]
  categories: ApiCategory[]
  guides: ApiGuide[]
  blocklist: ApiBlocklistEntry[]
}

export interface ResolvedChannel {
  id: string
  name: string
  url: string
  logoUrl: string | null
  groupTitle: string
  referrer: string | null
  userAgent: string | null
  quality: string | null
  fromOverride: boolean
}

export interface ResolveWarning {
  channelId: string
  message: string
}

export interface ResolveResult {
  resolved: ResolvedChannel[]
  warnings: ResolveWarning[]
}

export interface EpgChannelMapping {
  site: string
  siteId: string
  xmltvId: string
  name: string
  lang: string
}
