# IPTV RB - Playlist Generator & Stream Proxy

A Bun-based high-performance IPTV solution that automatically generates playlists from `strmfree.st` sports match schedules and 24/7 channels, resolves M3U8 feeds via an external scraper microservice, and proxies streams to bypass anti-hotlink restrictions.

## Architecture & Data Flow

1. **Stream List Ingestion**: Fetches active streams and schedules from `https://strmfree.st/streams` (covering Soccer, Basketball, Football, Hockey, Combat, Baseball, Racing, Tennis, Cricket).
2. **Embed & Scrape Resolution**:
   - Embed URL format: `https://strmfree.st/embed/{category}/{stream_key}` (e.g. `1080p` or standard).
   - Scrape Microservice: `https://your-proxy-domain.com/scrape-stream?proxy=true&url={embed_url}` returns HTTP 302 or 200 with proxied `.m3u8` manifest.
3. **High-Performance Bun Proxy (`/live`)**:
   - Follows upstream 302 redirects to find the active CDN manifest.
   - Dynamically parses and rewrites M3U8 chunk and sub-playlist URLs through the local proxy.
   - Injects required upstream anti-hotlink headers (`Referer: https://strmfree.st/`, `Origin: https://strmfree.st`).
   - Normalizes disguised chunk files (`.js`, `.ts`, `image/png`) to `Content-Type: video/mp2t` for full compatibility with strict IPTV players (TiviMate, OTT Navigator, VLC, Smart TVs).

## Features

- **Automated Multi-Sport Playlist**: Covers all 9 sports categories plus continuous 24/7 channels (Sky Sports F1, Willow, RedZone, etc.).
- **Live Status Detection**: Marks currently playing, ongoing, or starting-soon matches with 🔴.
- **High Quality 1080p Streams**: Generates clean 1080p stream entries directly mapped to each event.
- **Bun Native Streaming**: High-throughput, low-latency streaming pipeline using Bun's native HTTP server and `fetch`.
- **Environment-Based Config**: Fully customizable via `.env`.

## Project Structure

- `providers/`: Modular scrapers and playlist generators for each independent stream provider.
  - `strm.js`: Handler for `strmfree.st`.
  - `ppv.js`: Handler for `api.ppv.st`.
  - `tim-live.js`: Handler for `tim-streams.com` live match events.
  - `tim-channels.js`: Handler for `tim-streams.com` 219 24/7 channels grouped by country.
  - `channel2.js`: Handler for `sportsbite.org` 830+ 24/7 channels grouped by 47 countries.
  - `channel3.js`: Handler for `vidcdn.vip` 980+ 24/7 TV channels grouped by 48+ countries.
  - `gk.js`: Handler for `api.reedstreams.link` (ReedStreams / GK).
  - `pit.js`: Handler for `pitsport.st` (PitSport live & upcoming matches / racing).
  - `cine.js`: Handler for `cinevid.st` (Cinevid live sports events & schedule).
  - `dam.js`: Handler for `ondemand.st` (DAMITV live sports & 24/7 channels).
  - `sports247.js`: Handler for `en.sports247.ru` / Matchora API (Live sports events & multi-server matchora embeds).
  - `channel4.js`: Handler for `en.sports247.ru/channels` / Matchora API (2,700+ 24/7 TV channels across 63 countries).
  - `channel5.js`: Handler for `cdnlivetv.tv` / CDN Live TV 24/7 channels across 30+ countries.
  - `cdn.js`: Handler for `cdnlivetv.tv` / CDN Live TV live sports events & schedule.
- `utils/helpers.js`: Shared formatting, icon mappings, timezone conversions, and config merging.
- `generate.js`: Unified orchestrator combining all provider modules into single/combined playlists.
- `routes.js`: Centralized route-to-generator mappings used across Bun server and Cloudflare Pages.
- `server.js`: Native Bun HTTP server with in-memory TTL caching and on-demand playlist generation.
- `functions/[[route]].js`: Cloudflare Pages Edge functions with edge caching.
- `config.js`: Centralized configuration.
- `test.js`: End-to-end integration test suite.

## Setup & Configuration

1. **Install Bun** (if not installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Key variables in `.env`:
   - `PORT`: Server port (default: `3030`)
   - `STREAM_API_URL`: `https://strmfree.st/streams`
   - `SCRAPE_SERVICE_URL`: `https://your-proxy-domain.com/scrape-stream?proxy=true`
   - `STRM_SCRAPE_SERVICE_URL`: `https://your-proxy-domain.com/scrape-stream?proxy=true&proxy_segments=true`
   - `CINE_SCRAPE_SERVICE_URL`: `https://your-proxy-domain.com/scrape-stream?proxy=true&proxy_segments=true`
   - `DAM_SCRAPE_SERVICE_URL`: `https://your-proxy-domain.com/scrape-stream?proxy=true&proxy_segments=true`
   - `EMBED_BASE_URL`: `https://strmfree.st/embed`
   - `REFERER`: `https://strmfree.st/`
   - `ORIGIN`: `https://strmfree.st`
   - `CHECK_INTERVAL`: Update interval in ms (default: `300000` = 5 mins)

## Running the Application

### Test the Integration
```bash
bun test.js
```

### Run Locally with Bun
```bash
bun start # or bun server.js
```

### Docker (Recommended)
```bash
docker-compose up -d --build
docker-compose logs -f
```

## Client Playback & Endpoints

Add the playlist URL to your favorite IPTV player (TiviMate, VLC, OTT Navigator):

- **STRM Provider** (`strmfree.st`):
  ```text
  https://iptv-140.pages.dev/strm
  ```
  *(or `/stream`)*

- **PPV Provider** (`api.ppv.st`):
  ```text
  https://iptv-140.pages.dev/ppv
  ```

- **GK Provider** (`api.reedstreams.link`):
  ```text
  https://iptv-140.pages.dev/gk
  ```

- **TimStreams Live** (`tim-streams.com/api/live-upcoming`):
  ```text
  https://iptv-140.pages.dev/tim
  ```

- **TimStreams 24/7 Channels** (219 Channels, Sports, Entertainment, Movies, News):
  ```text
  https://iptv-140.pages.dev/channel
  ```
  *(or `/channels`)*

- **SportsBite 24/7 Channels** (830+ Channels, 47 Countries, Sports, Movies, News):
  ```text
  https://iptv-140.pages.dev/channel2
  ```

- **VidCDN 24/7 Channels** (980+ Channels, 48+ Countries, Sports, Movies, News):
  ```text
  https://iptv-140.pages.dev/channel3
  ```
  *(or `/vidcdn`)*

- **PitSport Provider** (`pitsport.st/api/v1/home`):
  ```text
  https://iptv-140.pages.dev/pit
  ```

- **Cinevid Provider** (`cinevid.st/api/public/events`):
  ```text
  https://iptv-140.pages.dev/cine
  ```
  *(or `/cinevid`)*

- **DAM Provider** (`ondemand.st/papi/api/streams`):
  ```text
  https://iptv-140.pages.dev/dam
  ```
  *(or `/dam.m3u`, `/ondemand`)*

- **Sports247 Live Events** (`en.sports247.ru/events`):
  ```text
  https://iptv-140.pages.dev/247
  ```
  *(or `/247.m3u`, `/sports247`)*

- **Sports247 24/7 Channels** (2,750+ Channels across 56 Countries):
  ```text
  https://iptv-140.pages.dev/channel4
  ```
  *(or `/channel4.m3u`, `/sports247-channels`)*

- **CDN Live TV 24/7 Channels** (`cdnlivetv.tv`):
  ```text
  https://iptv-140.pages.dev/channel5
  ```
  *(or `/channel5.m3u`)*

- **CDN Live Sports Events** (`cdnlivetv.tv/api/v1/events/sports`):
  ```text
  https://iptv-140.pages.dev/cdn
  ```
  *(or `/cdn.m3u`, `/cdnlivetv`)*

- **Combined Playlist** (All providers):
  ```text
  https://iptv-140.pages.dev/all
  ```

---

## 🚀 Xtream Codes API (Per-Provider & Isolated)

The server now natively implements the official **Xtream Codes API** standard (`player_api.php`, `/live/...`, `/xmltv.php`). Each provider can be accessed independently as its own isolated playlist using its **Username**, preventing client crashes and lag caused by thousands of channels.

### Setup on IPTV Apps (TiviMate, IPTV Smarters, OTT Navigator)

When adding a playlist via **Xtream Codes Parameters**:
- **Server URL**: `http://<your-server-or-domain>:3030` (or `https://iptv-140.pages.dev`)
- **Username**: Name of the desired provider (see table below)
- **Password**: `iptv` (default, or custom value set via `XTREAM_PASSWORD` in `.env`)

### Available Provider Accounts

| Provider / Content | Username | Content Overview |
| :--- | :--- | :--- |
| **STRM Sports** | `strm` *(or `stream`)* | Live sports events across 9 sports with 1080p mirrors |
| **Sports247 TV (24/7)** | `channel4` *(or `c4`)* | 2,750+ 24/7 channels grouped by 56+ countries |
| **CDN Live TV (24/7)** | `channel5` *(or `c5`)* | CDN Live TV 24/7 channels across 30+ countries |
| **CDN Live Events** | `cdn` *(or `cdnlivetv`)* | CDN Live TV sports events & schedules |
| **SportsBite Channels** | `channel2` *(or `sportsbite`)* | 830+ 24/7 channels grouped by 47 countries |
| **VidCDN Channels** | `channel3` *(or `vidcdn`)* | 980+ 24/7 TV channels grouped by 48+ countries |
| **Sports247 Events** | `247` *(or `sports247`)* | Live match events & multi-server matchora embeds |
| **DAMITV** | `dam` *(or `ondemand`)* | Live sports events & 24/7 channels |
| **Cinevid Sports** | `cine` *(or `cinevid`)* | Live sports events & schedule |
| **PPV Streams** | `ppv` | Live PPV combat & events |
| **TimChannels (24/7)** | `channel` *(or `channels`)* | 219 continuous channels grouped by country |
| **TimStreams Live** | `tim` *(or `tim-live`)* | Live upcoming sports matches |
| **PitSport** | `pit` | PitSport live matches & racing |
| **ReedStreams (GK)** | `gk` *(or `reed`)* | Live football & sports matches |
| **All Combined** | `all` | Full aggregated master list (if desired) |

### Advanced User & Password Configuration

In `.env`:
```env
# Default global password for provider logins
XTREAM_PASSWORD=iptv

# Optional: Map custom usernames to specific providers
# Format: username:password:provider,username2:password2:provider2
XTREAM_USERS=sports_fan:mysecret:strm,my_tv:pass123:channel4,vip_user:pass999:all
```

---

## 🎬 VOD (Movies) & TV Series (Shows)

The Xtream Codes API now includes full support for **Movies (VOD)** and **TV Series**:
- **Metadata Provider**: TMDb (The Movie Database) with Vietnamese localization (`vi-VN`), poster art, cast, overview, and seasons/episodes breakdown.
- **Video Resolver**: Configurable proxy stream templates with automatic redirection (`HTTP 302`):
  - **Movies**: `/movie/:username/:password/:streamId.mp4` -> resolves via `VOD_RESOLVER_URL`
  - **TV Series**: `/series/:username/:password/:episodeId.mp4` -> resolves via `SERIES_RESOLVER_URL`
  - **No `proxy=true`**: the resolver 302s straight to the resolved stream instead of relaying chunks through the proxy.
  - **Backup mirrors**: `scrape-video` supports a `fallback` param (retries a backup page when the primary yields no source), but VidSrc-style mirrors (e.g. `player.videasy.ws`) block datacenter IPs and issue IP-bound stream tokens, so they can't serve clients via direct 302 — no backup is configured by default.

### Resolver Configuration
In `.env`:
```env
TMDB_API_KEY=your_tmdb_api_key_here
VOD_RESOLVER_URL=https://your-proxy-domain.com/scrape-video?url=https%3A%2F%2Fvidnest.fun%2Fmovie%2F{tmdbId}
SERIES_RESOLVER_URL=https://your-proxy-domain.com/scrape-video?url=https%3A%2F%2Fvidnest.fun%2Ftv%2F{tmdbId}%2F{season}%2F{episode}
```

---

## License
MIT
