import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import type { ChannelConfigEntry, ChannelOverride, ChannelsConfig } from './types.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseOverride(value: unknown, channelId: string): ChannelOverride {
  if (!isRecord(value)) {
    throw new Error(`config: channel ${channelId}: override must be an object`)
  }
  if (typeof value.url !== 'string' || value.url.trim() === '') {
    throw new Error(`config: channel ${channelId}: override.url is required`)
  }

  const override: ChannelOverride = { url: value.url.trim() }

  if (value.title !== undefined) {
    if (typeof value.title !== 'string') {
      throw new Error(`config: channel ${channelId}: override.title must be a string`)
    }
    override.title = value.title
  }
  if (value.referrer !== undefined) {
    if (typeof value.referrer !== 'string') {
      throw new Error(`config: channel ${channelId}: override.referrer must be a string`)
    }
    override.referrer = value.referrer
  }
  if (value.userAgent !== undefined) {
    if (typeof value.userAgent !== 'string') {
      throw new Error(`config: channel ${channelId}: override.userAgent must be a string`)
    }
    override.userAgent = value.userAgent
  }

  return override
}

function parseEntry(value: unknown, index: number): ChannelConfigEntry {
  if (!isRecord(value)) {
    throw new Error(`config: channels[${index}] must be an object`)
  }
  if (typeof value.id !== 'string' || value.id.trim() === '') {
    throw new Error(`config: channels[${index}].id is required`)
  }

  const id = value.id.trim()
  const entry: ChannelConfigEntry = { id }

  if (value.override !== undefined) {
    entry.override = parseOverride(value.override, id)
  }

  return entry
}

export function parseChannelsConfig(raw: unknown): ChannelsConfig {
  if (!isRecord(raw)) {
    throw new Error('config: root must be an object')
  }
  if (!Array.isArray(raw.channels)) {
    throw new Error('config: channels must be an array')
  }

  const channels = raw.channels.map((entry, index) => parseEntry(entry, index))
  const seen = new Set<string>()
  for (const channel of channels) {
    if (seen.has(channel.id)) {
      throw new Error(`config: duplicate channel id ${channel.id}`)
    }
    seen.add(channel.id)
  }

  return { channels }
}

export function loadChannelsConfig(path: string): ChannelsConfig {
  const text = readFileSync(path, 'utf8')
  const raw = parseYaml(text) as unknown
  return parseChannelsConfig(raw)
}
