const fs = require("fs");
const path = require("path");
const config = require("./config");
const { getRouteHandler } = require("./routes");
const { handleXtreamRequest } = require("./xtream");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const memoryCache = new Map(); // filename -> { content, timestamp }
const inFlightRequests = new Map(); // filename -> Promise<string>
const CACHE_TTL_MS = (config.cacheTtl || 60) * 1000;

/**
 * Get cached playlist or generate on-demand with thundering-herd protection
 */
async function getOrGeneratePlaylist(filename, generator, pathname = filename) {
  const now = Date.now();
  const cached = memoryCache.get(filename);

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.content;
  }

  const cachePath = path.join(DATA_DIR, filename);

  // Check disk cache freshness on cold start or after restart
  if (!cached && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      if (now - stat.mtimeMs < CACHE_TTL_MS) {
        const diskContent = await Bun.file(cachePath).text();
        memoryCache.set(filename, { content: diskContent, timestamp: stat.mtimeMs });
        return diskContent;
      }
    } catch (e) {}
  }

  // Avoid multiple simultaneous fetches for the same playlist (thundering herd protection)
  let fetchPromise = inFlightRequests.get(filename);
  if (!fetchPromise) {
    fetchPromise = (async () => {
      console.log(`[${new Date().toISOString()}] Generating playlist for ${pathname}...`);
      // Provide customConfig with cache accessor so composite generators like /all can reuse warm caches
      const generated = await generator({
        getCachedPlaylist: (subFilename, subGen) => getOrGeneratePlaylist(subFilename, subGen, subFilename),
      });

      if (generated?.trim()) {
        memoryCache.set(filename, { content: generated, timestamp: Date.now() });
        Bun.write(cachePath, generated).catch(() => {});
        return generated;
      }
      // If generation failed/empty, fallback to stale cache if present
      if (cached?.content) {
        console.warn(`[${new Date().toISOString()}] Generation empty for ${pathname}, using stale cache.`);
        return cached.content;
      }
      return "";
    })().finally(() => {
      inFlightRequests.delete(filename);
    });
    inFlightRequests.set(filename, fetchPromise);
  }

  return await fetchPromise;
}

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    const ua = req.headers.get("user-agent") || "none";
    const timeStr = new Date().toISOString().substring(11, 19);
    console.log(`[HTTP ${timeStr}] ${req.method} ${url.pathname}${url.search} | UA: ${ua}`);

    // 1. Handle Xtream Codes API and streams
    try {
      const xtreamRes = await handleXtreamRequest({
        req,
        url,
        config,
        getOrGeneratePlaylist,
      });
      if (xtreamRes) {
        return xtreamRes;
      }
    } catch (xtreamErr) {
      console.error("Xtream API error:", xtreamErr);
      return new Response("Xtream Internal Error", { status: 500 });
    }

    // 2. Handle standard M3U playlist routes
    const route = getRouteHandler(url.pathname);

    if (!route) {
      console.warn(`[HTTP:404 ${timeStr}] ⚠️ Unsupported / Unhandled route: ${req.method} ${url.pathname}${url.search} | UA: "${ua}"`);
      return new Response("Not Found", { status: 404 });
    }

    try {
      const content = await getOrGeneratePlaylist(route.filename, route.generator, url.pathname);

      if (!content?.trim()) {
        return new Response("No playlist available", { status: 404 });
      }

      return new Response(content, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Content-Disposition": `attachment; filename="${route.filename}"`,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": `public, max-age=${config.cacheTtl || 60}`,
          "Cloudflare-CDN-Cache-Control": `max-age=${config.cacheTtl || 60}`
        }
      });
    } catch (error) {
      console.error("Playlist error:", error);
      return new Response("Error generating playlist", { status: 500 });
    }
  },
  idleTimeout: 30,
});

console.log(`IPTV Server is running at http://localhost:${server.port}`);
console.log(`--- M3U Playlists ---`);
console.log(`- STRM:     http://localhost:${server.port}/strm`);
console.log(`- PPV:      http://localhost:${server.port}/ppv`);
console.log(`- GK:       http://localhost:${server.port}/gk`);
console.log(`- TIM:      http://localhost:${server.port}/tim`);
console.log(`- CHANNEL:  http://localhost:${server.port}/channel`);
console.log(`- CHANNEL2: http://localhost:${server.port}/channel2`);
console.log(`- CHANNEL3: http://localhost:${server.port}/channel3`);
console.log(`- CHANNEL4: http://localhost:${server.port}/channel4`);
console.log(`- CHANNEL5: http://localhost:${server.port}/channel5`);
console.log(`- CDN:      http://localhost:${server.port}/cdn`);
console.log(`- 247:      http://localhost:${server.port}/247`);
console.log(`- DAM:      http://localhost:${server.port}/dam`);
console.log(`- PIT:      http://localhost:${server.port}/pit`);
console.log(`- CINE:     http://localhost:${server.port}/cine`);
console.log(`- ALL:      http://localhost:${server.port}/all`);
console.log(`--- Xtream Codes API ---`);
console.log(`- API URL:  http://localhost:${server.port}/player_api.php`);
console.log(`- Users:    Use provider name as username (e.g. "channel5", "cdn", "channel4", "strm", "247", "dam", "all")`);
console.log(`- Password: "${config.xtreamPassword || "(any)"}" (configurable via XTREAM_PASSWORD)`);
