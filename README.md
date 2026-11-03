# IPTV RB - Playlist Generator & Stream Proxy

A Bun-based high-performance IPTV solution that automatically generates playlists from `strmfree.st` sports match schedules and 24/7 channels, resolves M3U8 feeds via an external scraper microservice, and proxies streams to bypass anti-hotlink restrictions.

## Architecture & Data Flow

1. **Stream List Ingestion**: Fetches active streams and schedules from `https://strmfree.st/streams` (covering Soccer, Basketball, Football, Hockey, Combat, Baseball, Racing, Tennis, Cricket).
2. **Embed & Scrape Resolution**:
   - Embed URL format: `https://strmfree.st/embed/{category}/{stream_key}` (e.g. `1080p` or standard).
   - Scrape Microservice: `https://proxy.quaywin.com/scrape-stream?proxy=true&url={embed_url}` returns HTTP 302 or 200 with proxied `.m3u8` manifest.
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
   - `SCRAPE_SERVICE_URL`: `https://proxy.quaywin.com/scrape-stream?proxy=true`
   - `STRM_SCRAPE_SERVICE_URL`: `https://proxy.quaywin.com/scrape-stream?proxy=true&proxy_segments=true`
   - `CINE_SCRAPE_SERVICE_URL`: `https://proxy.quaywin.com/scrape-stream?proxy=true&proxy_segments=true`
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

- **Combined Playlist** (All providers):
  ```text
  https://iptv-140.pages.dev/all
  ```

## License
MIT
