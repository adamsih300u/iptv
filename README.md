# IPTV → Emby playlist bot

GitHub Actions bot that pulls a curated allow-list of channels from
[iptv-org/database](https://github.com/iptv-org/database) (via the
[iptv-org/api](https://github.com/iptv-org/api) JSON snapshots), builds an M3U8
playlist plus XMLTV guide, and commits the results to `public/` for Emby.

## Outputs

| File | Purpose |
| --- | --- |
| [`public/playlist.m3u8`](public/playlist.m3u8) | Emby Live TV → M3U Tuner URL |
| [`public/guide.xml`](public/guide.xml) | Emby Live TV → XMLTV guide URL |
| [`public/epg.channels.xml`](public/epg.channels.xml) | Intermediate mapping used by iptv-org/epg |

Point Emby at the raw GitHub URLs for this repo, for example:

```text
https://raw.githubusercontent.com/<you>/<repo>/main/public/playlist.m3u8
https://raw.githubusercontent.com/<you>/<repo>/main/public/guide.xml
```

## Curating channels

Edit [`config/channels.yaml`](config/channels.yaml). Each entry is a channel `id`
from iptv-org (`CNN.us`, `FoxNewsChannel.us`, …).

Channels with no public stream in the database are **skipped with a build
warning** and will start appearing automatically once a stream is contributed
upstream.

To force a stream (including for blocklisted IDs such as `CNN.us`), add an
override — you are responsible for sourcing a legal URL:

```yaml
channels:
  - id: CNN.us
    override:
      url: https://example.com/your-legal-stream.m3u8
      title: CNN
      referrer: https://example.com/
      userAgent: Mozilla/5.0
```

## Local development (Windows without a global Node install)

This repo includes a portable Node bootstrap so you do **not** need admin rights
or a system-wide Node install.

1. One-time: download portable Node into `.tools/` (gitignored) using Cursor’s
   bundled `node.exe`, or any other Node binary:

```powershell
& "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe" .\scripts\bootstrap-node.cjs
```

2. Put that Node on PATH for the current PowerShell session, then install and run:

```powershell
.\scripts\use-tools.ps1
npm ci
npm test
npm run build:playlist
```

`npm run build` writes `public/playlist.m3u8`, `public/epg.channels.xml`, and a
placeholder `public/guide.xml`. The full schedule download runs in CI by cloning
[iptv-org/epg](https://github.com/iptv-org/epg) and running its grabber against
`public/epg.channels.xml`.

If you already have Node 20+ installed globally, skip the bootstrap and just use
`npm ci` as usual.

## Stream selection & liveness

When iptv-org lists multiple URLs for one channel, the bot:

1. Probes each unique candidate URL (HEAD, then short GET) with the stream’s
   referrer/user-agent when present
2. Drops dead/unreachable candidates
3. Picks the best remaining stream (non-geo-blocked, then highest quality,
   then stable URL order)

Use `--no-probe` (or `npm run build:fast`) to skip probes during local iteration.

## Automation

- `.github/workflows/build.yml` — daily cron + manual dispatch; rebuilds and
  commits `public/` when contents change.
- `.github/workflows/ci.yml` — lint, typecheck, and unit tests on push/PR.

## License

Source code in this repository is provided as-is. Stream URLs come from
iptv-org community data; channel metadata is CC0. Respect copyright and local law
when adding overrides.
