const { getRouteHandler } = require("../routes.js");
const { handleXtreamRequest } = require("../xtream.js");
const { indexCatalog } = require("../providers/tmdb.js");
const { hasM3uStreams } = require("../utils/helpers.js");

const edgeCatalogCache = new Map();

function createEdgeCatalogLoader(env, urlOrigin) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") return null;

  async function loadAssetCatalog(type) {
    if (edgeCatalogCache.has(type)) {
      return edgeCatalogCache.get(type);
    }
    try {
      const res = await env.ASSETS.fetch(new Request(`${urlOrigin}/catalog/${type}.json`, { method: "GET" }));
      if (!res.ok) return null;
      const parsed = await res.json();
      const indexed = indexCatalog(parsed);
      if (indexed) {
        edgeCatalogCache.set(type, indexed);
      }
      return indexed;
    } catch (err) {
      console.warn(`Failed to load edge catalog ${type}:`, err.message);
      return null;
    }
  }

  return {
    getVodCatalog: () => loadAssetCatalog("vod"),
    getSeriesCatalog: () => loadAssetCatalog("series"),
  };
}

function parseDisableBulkVod(value) {
  if (value === undefined || value === null || value === "") return "auto";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return "auto";
}

function buildRuntimeConfig(env) {
  return {
    scrapeServiceUrl: env.SCRAPE_SERVICE_URL,
    strmScrapeServiceUrl: env.STRM_SCRAPE_SERVICE_URL,
    cineScrapeServiceUrl: env.CINE_SCRAPE_SERVICE_URL,
    streamApiUrl: env.STREAM_API_URL,
    ppvApiUrl: env.PPV_API_URL,
    gkApiUrl: env.GK_API_URL,
    timApiUrl: env.TIM_API_URL,
    timChannelsUrl: env.TIM_CHANNELS_URL,
    epgUrl: env.EPG_URL,
    timEpgUrl: env.TIM_EPG_URL || env.EPG_URL,
    sportsbiteChannelsUrl: env.SPORTSBITE_CHANNELS_URL,
    pitApiUrl: env.PIT_API_URL,
    cineApiUrl: env.CINE_API_URL,
    vidcdnChannelsUrl: env.VIDCDN_CHANNELS_URL,
    cineEmbedChannelBaseUrl: env.CINE_EMBED_CHANNEL_BASE_URL,
    timWatchBaseUrl: env.TIM_WATCH_BASE_URL,
    damApiUrl: env.DAM_API_URL,
    damScrapeServiceUrl: env.DAM_SCRAPE_SERVICE_URL,
    sports247Url: env.SPORTS247_URL,
    matchoraApiUrl: env.MATCHORA_API_URL,
    sports247ScrapeServiceUrl: env.SPORTS247_SCRAPE_SERVICE_URL,
    cdnChannelsUrl: env.CDN_CHANNELS_URL,
    cdnEventsUrl: env.CDN_EVENTS_URL,
    cdnScrapeServiceUrl: env.CDN_SCRAPE_SERVICE_URL,
    embedBaseUrl: env.EMBED_BASE_URL,
    timezone: env.TIMEZONE,
    xtreamPassword: env.XTREAM_PASSWORD !== undefined ? env.XTREAM_PASSWORD : "iptv",
    xtreamUsers: env.XTREAM_USERS || "",
    tmdbApiKey: env.TMDB_API_KEY || "",
    vodResolverUrl: env.VOD_RESOLVER_URL || "",
    seriesResolverUrl: env.SERIES_RESOLVER_URL || "",
    cacheTtl: env.CACHE_TTL ? parseInt(env.CACHE_TTL, 10) : 180,
    hoursBack: env.HOURS_BACK ? parseInt(env.HOURS_BACK, 10) : undefined,
    hoursAhead: env.HOURS_AHEAD ? parseInt(env.HOURS_AHEAD, 10) : undefined,
    cdnHoursAhead: env.CDN_HOURS_AHEAD ? parseInt(env.CDN_HOURS_AHEAD, 10) : 72,
    cdnIncludeOffline: env.CDN_INCLUDE_OFFLINE !== undefined ? (env.CDN_INCLUDE_OFFLINE === "true" || env.CDN_INCLUDE_OFFLINE === "1") : true,
    disableBulkVod: parseDisableBulkVod(env.DISABLE_BULK_VOD),
    maxChannelsPerEvent: env.MAX_CHANNELS_PER_EVENT !== undefined ? parseInt(env.MAX_CHANNELS_PER_EVENT, 10) : undefined,
  };
}

async function getEdgeCachedPlaylist(filename, generator, runtimeConfig, urlOrigin, waitUntil) {
  const cache = (typeof caches !== "undefined" && caches.default) ? caches.default : null;
  const cacheTtl = runtimeConfig.cacheTtl || 180;
  const cacheKey = cache ? new Request(`${urlOrigin}/__cache/m3u/${filename}`, { method: "GET" }) : null;
  const staleKey = cache ? new Request(`${urlOrigin}/__cache/m3u/${filename}?__stale=true`, { method: "GET" }) : null;

  if (cache && cacheKey) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const text = await cached.text();
        if (hasM3uStreams(text)) return text;
      }
    } catch (_) {}
  }

  try {
    const content = await generator({
      ...runtimeConfig,
      getCachedPlaylist: (subFilename, subGen) =>
        getEdgeCachedPlaylist(subFilename, subGen, runtimeConfig, urlOrigin, waitUntil),
    });

    if (hasM3uStreams(content) && cache && cacheKey && staleKey) {
      const freshRes = new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`,
        },
      });
      const staleRes = new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
      if (waitUntil) {
        waitUntil(cache.put(cacheKey, freshRes));
        waitUntil(cache.put(staleKey, staleRes));
      } else {
        await cache.put(cacheKey, freshRes);
        await cache.put(staleKey, staleRes);
      }
    }

    if (hasM3uStreams(content)) {
      return content;
    }
  } catch (err) {
    console.warn(`Edge playlist generation failed for ${filename}:`, err.message);
  }

  // Fallback to 24h stale cache if upstream failed or returned 0 streams
  if (cache && staleKey) {
    try {
      const stale = await cache.match(staleKey);
      if (stale) {
        const text = await stale.text();
        if (hasM3uStreams(text)) return text;
      }
    } catch (_) {}
  }

  return "";
}

function createEdgeCacheAdapter(waitUntil) {
  const cache = (typeof caches !== "undefined" && caches.default) ? caches.default : null;
  if (!cache) return null;

  return {
    async match(key) {
      return cache.match(new Request(key, { method: "GET" }));
    },
    put(key, response) {
      const req = new Request(key, { method: "GET" });
      if (waitUntil) {
        waitUntil(cache.put(req, response));
      } else {
        cache.put(req, response).catch(() => {});
      }
    },
  };
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  if ((url.pathname.startsWith("/catalog/") || url.pathname === "/robots.txt") && typeof context.next === "function") {
    return context.next();
  }
  const ua = request.headers.get("user-agent") || "none";
  const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const timeStr = new Date().toISOString().substring(11, 19);
  console.log(`[HTTP ${timeStr}] ${request.method} ${url.pathname}${url.search} | UA: "${ua}"${clientIp ? " | IP: " + clientIp : ""}`);
  const runtimeConfig = buildRuntimeConfig(env);
  const edgeCache = createEdgeCacheAdapter(waitUntil);
  const catalogLoader = createEdgeCatalogLoader(env, url.origin);

  // 1. Handle Xtream Codes API and streams
  try {
    const xtreamRes = await handleXtreamRequest({
      req: request,
      url,
      config: runtimeConfig,
      getOrGeneratePlaylist: async (filename, generator) =>
        getEdgeCachedPlaylist(filename, generator, runtimeConfig, url.origin, waitUntil),
      edgeCache,
      catalogLoader,
    });

    if (xtreamRes) {
      return xtreamRes;
    }
  } catch (xtreamErr) {
    console.error("Xtream API error on edge:", xtreamErr.message);
    return new Response("Xtream Internal Error", { status: 500 });
  }

  // 2. Handle standard M3U playlist routes
  const route = getRouteHandler(url.pathname);

  if (!route) {
    console.warn(`[HTTP:404 ${timeStr}] ⚠️ Unsupported / Unhandled route: ${request.method} ${url.pathname}${url.search} | UA: "${ua}"${clientIp ? " | IP: " + clientIp : ""}`);
    return new Response("Not Found", { status: 404 });
  }

  // Edge cache (Cloudflare Cache API per path)
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });

  let response = await cache.match(cacheKey);
  if (response) {
    return response;
  }

  try {
    const playlist = await getEdgeCachedPlaylist(
      route.filename,
      route.generator,
      runtimeConfig,
      url.origin,
      waitUntil
    );

    if (!hasM3uStreams(playlist)) {
      throw new Error("Generated playlist has 0 streams");
    }

    const cacheTtl = env.CACHE_TTL ? parseInt(env.CACHE_TTL, 10) : 180;

    response = new Response(playlist, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Content-Disposition": `attachment; filename="${route.filename}"`,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`,
        "Cloudflare-CDN-Cache-Control": `max-age=${cacheTtl}`,
      },
    });

    // Cache kết quả tại Cloudflare Edge
    if (waitUntil) {
      waitUntil(cache.put(cacheKey, response.clone()));
      // Lưu thêm một bản stale backup có thời hạn 24 giờ để dùng khi các API nguồn bị lỗi
      const staleKey = new Request(`${url.origin}${url.pathname}?__stale=true`, { method: "GET" });
      const staleResponse = new Response(playlist, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Content-Disposition": `attachment; filename="${route.filename}"`,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400",
        },
      });
      waitUntil(cache.put(staleKey, staleResponse));
    }

    return response;
  } catch (error) {
    console.error(`Error generating playlist for ${url.pathname}:`, error.message);

    // Fallback: Kiểm tra stale cache nếu có để cứu nguy cho người dùng
    try {
      const staleKey = new Request(`${url.origin}${url.pathname}?__stale=true`, { method: "GET" });
      const staleResponse = await cache.match(staleKey);
      if (staleResponse) {
        console.warn(`Serving stale cache fallback for ${url.pathname}`);
        const headers = new Headers(staleResponse.headers);
        headers.set("Warning", '110 - "Response is Stale"');
        headers.set("X-IPTV-Fallback", "stale-cache");
        return new Response(staleResponse.body, {
          status: 200,
          headers,
        });
      }
    } catch (staleErr) {
      console.error("Stale cache lookup failed:", staleErr.message);
    }

    return new Response("Error generating playlist: " + error.message, { status: 500 });
  }
}
