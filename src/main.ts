import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadChannelsConfig } from './config.js'
import { buildChannelsXml, buildEmptyGuideXml, buildEpgMappings } from './epgConfig.js'
import { fetchApiSnapshot } from './fetch.js'
import { buildPlaylist } from './playlist.js'
import { resolveChannels } from './resolve.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function githubWarning(channelId: string, message: string): void {
  // Surfaces in GitHub Actions annotations; still readable locally.
  console.warn(`::warning title=${channelId}::${message}`)
}

export interface BuildOptions {
  configPath?: string
  publicDir?: string
  playlistOnly?: boolean
  fetchImpl?: typeof fetch
}

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const configPath = options.configPath ?? join(ROOT, 'config', 'channels.yaml')
  const publicDir = options.publicDir ?? join(ROOT, 'public')
  const playlistOnly = options.playlistOnly ?? false

  const config = loadChannelsConfig(configPath)
  console.log(`Loaded ${config.channels.length} channel(s) from ${configPath}`)

  const snapshot = await fetchApiSnapshot(options.fetchImpl)
  console.log(
    `Fetched API snapshot: ${snapshot.channels.length} channels, ${snapshot.streams.length} streams`,
  )

  const { resolved, warnings } = resolveChannels(config.channels, snapshot)

  for (const warning of warnings) {
    githubWarning(warning.channelId, warning.message)
  }

  console.log(`Resolved ${resolved.length} channel(s); ${warnings.length} warning(s)`)

  mkdirSync(publicDir, { recursive: true })

  const playlistPath = join(publicDir, 'playlist.m3u8')
  writeFileSync(playlistPath, buildPlaylist(resolved), 'utf8')
  console.log(`Wrote ${playlistPath}`)

  const { mappings, missing } = buildEpgMappings(resolved, snapshot.guides)
  for (const channelId of missing) {
    githubWarning(channelId, 'no EPG guide source found; channel will have no schedule in guide.xml')
  }

  const channelsXmlPath = join(publicDir, 'epg.channels.xml')
  writeFileSync(channelsXmlPath, buildChannelsXml(mappings), 'utf8')
  console.log(`Wrote ${channelsXmlPath} (${mappings.length} EPG mapping(s))`)

  // Placeholder until the workflow (or a local epg grab) overwrites with full schedules.
  if (!playlistOnly) {
    const guidePath = join(publicDir, 'guide.xml')
    writeFileSync(guidePath, buildEmptyGuideXml(resolved), 'utf8')
    console.log(`Wrote placeholder ${guidePath}`)
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectRun) {
  const playlistOnly = process.argv.includes('--playlist-only')
  runBuild({ playlistOnly }).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
