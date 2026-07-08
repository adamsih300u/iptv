import type { ResolvedChannel } from './types.js'

function escapeAttr(value: string): string {
  return value.replace(/"/g, "'")
}

function buildExtinf(channel: ResolvedChannel): string {
  const attrs: string[] = [`tvg-id="${escapeAttr(channel.id)}"`]

  if (channel.logoUrl) {
    attrs.push(`tvg-logo="${escapeAttr(channel.logoUrl)}"`)
  }

  attrs.push(`group-title="${escapeAttr(channel.groupTitle)}"`)

  const displayName =
    channel.quality && !channel.fromOverride
      ? `${channel.name} (${channel.quality})`
      : channel.name

  return `#EXTINF:-1 ${attrs.join(' ')},${displayName}`
}

/** Render an M3U playlist Emby can load as a Live TV tuner. */
export function buildPlaylist(channels: ResolvedChannel[]): string {
  const lines: string[] = ['#EXTM3U']

  for (const channel of channels) {
    lines.push(buildExtinf(channel))

    if (channel.referrer) {
      lines.push(`#EXTVLCOPT:http-referrer=${channel.referrer}`)
    }
    if (channel.userAgent) {
      lines.push(`#EXTVLCOPT:http-user-agent=${channel.userAgent}`)
    }

    lines.push(channel.url)
  }

  return `${lines.join('\n')}\n`
}
