import type {
  ApiBlocklistEntry,
  ApiCategory,
  ApiChannel,
  ApiGuide,
  ApiLogo,
  ApiSnapshot,
  ApiStream,
} from './types.js'

export const API_BASE = 'https://iptv-org.github.io/api'

const ENDPOINTS = {
  channels: 'channels.json',
  streams: 'streams.json',
  logos: 'logos.json',
  categories: 'categories.json',
  guides: 'guides.json',
  blocklist: 'blocklist.json',
} as const

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

async function fetchJson<T>(path: string, fetchImpl: FetchFn): Promise<T> {
  const url = `${API_BASE}/${path}`
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

export async function fetchApiSnapshot(fetchImpl: FetchFn = fetch): Promise<ApiSnapshot> {
  const [channels, streams, logos, categories, guides, blocklist] = await Promise.all([
    fetchJson<ApiChannel[]>(ENDPOINTS.channels, fetchImpl),
    fetchJson<ApiStream[]>(ENDPOINTS.streams, fetchImpl),
    fetchJson<ApiLogo[]>(ENDPOINTS.logos, fetchImpl),
    fetchJson<ApiCategory[]>(ENDPOINTS.categories, fetchImpl),
    fetchJson<ApiGuide[]>(ENDPOINTS.guides, fetchImpl),
    fetchJson<ApiBlocklistEntry[]>(ENDPOINTS.blocklist, fetchImpl),
  ])

  return { channels, streams, logos, categories, guides, blocklist }
}
