const { getRouteHandler } = require("../routes.js");

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const route = getRouteHandler(url.pathname);

  if (!route) {
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
    const playlist = await route.generator({
      scrapeServiceUrl: env.SCRAPE_SERVICE_URL,
      strmScrapeServiceUrl: env.STRM_SCRAPE_SERVICE_URL,
      cineScrapeServiceUrl: env.CINE_SCRAPE_SERVICE_URL,
      streamApiUrl: env.STREAM_API_URL,
      ppvApiUrl: env.PPV_API_URL,
      gkApiUrl: env.GK_API_URL,
      timApiUrl: env.TIM_API_URL,
      timChannelsUrl: env.TIM_CHANNELS_URL,
      sportsbiteChannelsUrl: env.SPORTSBITE_CHANNELS_URL,
      pitApiUrl: env.PIT_API_URL,
      cineApiUrl: env.CINE_API_URL,
      vidcdnChannelsUrl: env.VIDCDN_CHANNELS_URL,
      cineEmbedChannelBaseUrl: env.CINE_EMBED_CHANNEL_BASE_URL,
      timWatchBaseUrl: env.TIM_WATCH_BASE_URL,
      embedBaseUrl: env.EMBED_BASE_URL,
      timezone: env.TIMEZONE,
      hoursBack: env.HOURS_BACK ? parseInt(env.HOURS_BACK, 10) : undefined,
      hoursAhead: env.HOURS_AHEAD ? parseInt(env.HOURS_AHEAD, 10) : undefined,
    });

    if (!playlist) {
      return new Response("No playlist available", { status: 404 });
    }

    const cacheTtl = env.CACHE_TTL ? parseInt(env.CACHE_TTL, 10) : 60;

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
    }

    return response;
  } catch (error) {
    return new Response("Error generating playlist: " + error.message, { status: 500 });
  }
}
