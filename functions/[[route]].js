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
      damApiUrl: env.DAM_API_URL,
      damScrapeServiceUrl: env.DAM_SCRAPE_SERVICE_URL,
      sports247Url: env.SPORTS247_URL,
      matchoraApiUrl: env.MATCHORA_API_URL,
      sports247ScrapeServiceUrl: env.SPORTS247_SCRAPE_SERVICE_URL,
      embedBaseUrl: env.EMBED_BASE_URL,
      timezone: env.TIMEZONE,
      hoursBack: env.HOURS_BACK ? parseInt(env.HOURS_BACK, 10) : undefined,
      hoursAhead: env.HOURS_AHEAD ? parseInt(env.HOURS_AHEAD, 10) : undefined,
      maxChannelsPerEvent: env.MAX_CHANNELS_PER_EVENT !== undefined ? parseInt(env.MAX_CHANNELS_PER_EVENT, 10) : undefined,
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
