# IPTV RB - Playlist Generator & Stream Proxy

A Node.js based IPTV solution that automatically generates playlists from sports match schedules and provides a high-performance streaming proxy to bypass referer/origin restrictions.

## Features

- **Automated Playlist Generation**: Fetches match schedules for Football, Volleyball, and Tennis.
- **Dynamic Content**: Automatically marks live matches and those starting soon with a 🔴 indicator.
- **Smart Stream Selection**: Automatically chooses between primary and backup stream sources.
- **High-Performance Proxy**: Uses `undici` for efficient streaming with Keep-Alive support and M3U8 rewrite capabilities.
- **Health Monitoring**: Background worker periodically refreshes the playlist and checks stream health.
- **Environment-Based Config**: Fully configurable via environment variables (no hardcoded URLs or IPs).

## Project Structure

- `server.js`: Main Express server handling the playlist delivery and stream proxying.
- `generate.js`: Core logic for fetching API data and building the M3U content.
- `worker.js`: Background task that runs periodically to keep the playlist updated.
- `config.js`: Centralized configuration management using `dotenv`.
- `api/playlist.js`: Vercel-ready serverless function for proxying the playlist.

## Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/iptv_rb.git
   cd iptv_rb
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file and fill in your details:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure:
   - `PORT`: Server port (default: 3030)
   - `VPS_URL`: URL to your playlist source
   - `API_BASE_URL`: The sports API base URL
   - `REFERER` / `ORIGIN`: Headers required by the stream provider

## Running the Project

### Development
```bash
npm start
```

### Docker (Recommended)
You can run the entire stack using Docker and Docker Compose:

1. **Build and start**:
   ```bash
   docker-compose up -d --build
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f
   ```

### Production (using PM2)
The project includes an `ecosystem.config.js` for PM2:
```bash
pm2 start ecosystem.config.js
```
This will launch both the `iptv_server` (in cluster mode) and the `iptv_worker`.

## Deployment

### Nginx Configuration
An example Nginx configuration with SSL and streaming optimizations is provided in `nginx.conf.example`. It includes:
- Automatic HTTP to HTTPS redirection.
- SSL optimization.
- Streaming-specific proxy settings (buffering off, long timeouts).

### Vercel
The project is structured to support Vercel deployment for the playlist proxy function located in the `api/` directory.

## License
MIT
