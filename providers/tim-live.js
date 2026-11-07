const {
  formatTime,
  getSportIcon,
  parseTimTime,
  getLeagueLogo,
  mergeConfig,
  fetchWithFallback,
  buildCandidateUrls,
  PROVIDER_MIRRORS,
} = require("../utils/helpers");

const TIM_BROWSER_HEADERS = {
  "Origin": "https://iptv-140.pages.dev",
  "Referer": "https://iptv-140.pages.dev/",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
};

function buildTimWatchUrl(baseWatchUrl, eventSlug) {
  if (!baseWatchUrl || !eventSlug) return "";
  if (baseWatchUrl.includes("url=")) {
    const parts = baseWatchUrl.split("url=");
    const target = decodeURIComponent(parts[1]).replace(/\/+$/, "");
    return `${parts[0]}url=${encodeURIComponent(`${target}/${eventSlug}`)}`;
  }
  return `${baseWatchUrl.replace(/\/+$/, "")}/${eventSlug}`;
}

/**
 * Fetch live and upcoming events from tim-streams API with multi-mirror fallback
 */
async function fetchTimStreamList(cfg) {
  try {
    const directUrl = "https://tim-streams.com/api/live-upcoming";
    const candidates = [
      cfg.timApiUrl,
      directUrl,
    ];
    if (cfg.scrapeServiceUrl) {
      try {
        const proxyOrigin = new URL(cfg.scrapeServiceUrl).origin;
        candidates.push(`${proxyOrigin}/proxy-chunk?url=${encodeURIComponent(directUrl)}`);
      } catch (e) {}
    }
    const urls = Array.from(new Set(candidates.filter(Boolean)));
    console.log(`Fetching Tim Live events (primary: ${cfg.timApiUrl}, candidates: ${urls.length})`);

    const data = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
        ...TIM_BROWSER_HEADERS,
      },
    });

    const rawEvents = data.events || [];
    const genres = data.genres || [];
    const genreMap = {};
    for (const g of genres) {
      genreMap[g.id] = g.name;
    }

    return { events: rawEvents, genreMap };
  } catch (error) {
    console.error("Error fetching Tim Live streams:", error.message);
    throw new Error(`Tim Live fetch failed: ${error.message}`);
  }
}

/**
 * Resolve individual event stream URL
 */
async function resolveTimEventStream(event, cfg) {
  if (event.streams && event.streams.length > 0 && event.streams[0].url) {
    return event.streams[0].url;
  }
  if (!event.url) return null;

  try {
    const primaryWatch = buildTimWatchUrl(cfg.timWatchBaseUrl, event.url);
    const directWatch = `https://tim-streams.com/api/watch/${event.url}`;
    const candidates = [primaryWatch, directWatch];
    if (cfg.scrapeServiceUrl) {
      try {
        const proxyOrigin = new URL(cfg.scrapeServiceUrl).origin;
        candidates.push(`${proxyOrigin}/proxy-chunk?url=${encodeURIComponent(directWatch)}`);
      } catch (e) {}
    }
    const watchUrls = Array.from(new Set(candidates.filter(Boolean)));

    const json = await fetchWithFallback(watchUrls, {
      timeoutMs: 4000,
      headers: {
        "User-Agent": cfg.userAgent,
        ...TIM_BROWSER_HEADERS,
      },
    });
    return json.item?.streams?.[0]?.url || null;
  } catch (e) {
    console.warn(`Could not resolve stream for Tim event ${event.url}:`, e.message);
  }
  return null;
}

/**
 * Generate M3U playlist for Tim Live
 */
async function generateTimLivePlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting Tim Live playlist generation...");
  const { events, genreMap } = await fetchTimStreamList(cfg);

  if (!events || !events.length) {
    console.log("Tim Live events is currently empty.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const validEvents = [];
  for (const item of events) {
    const starts_at = parseTimTime(item.time);
    if (!starts_at) continue;

    // Filter within window
    if (starts_at >= now - hoursBack * 3600 && starts_at <= now + hoursAhead * 3600) {
      validEvents.push({
        ...item,
        starts_at,
        category: genreMap[item.genre] || "Sports",
      });
    }
  }

  function isLiveStream(s) {
    const isUnderway = s.starts_at <= now && now - s.starts_at <= 3.5 * 3600;
    const isStartingSoon = s.starts_at > now && s.starts_at <= now + 1800;
    return isUnderway || isStartingSoon;
  }

  validEvents.sort((a, b) => {
    const aLive = isLiveStream(a);
    const bLive = isLiveStream(b);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return a.starts_at - b.starts_at;
  });

  // Resolve streams in parallel (batches of 10)
  const resolvedEvents = [];
  const batchSize = 10;
  for (let i = 0; i < validEvents.length; i += batchSize) {
    const batch = validEvents.slice(i, i + batchSize);
    const resolvedUrls = await Promise.all(
      batch.map(ev => resolveTimEventStream(ev, cfg))
    );
    for (let j = 0; j < batch.length; j++) {
      if (resolvedUrls[j]) {
        resolvedEvents.push({
          ...batch[j],
          streamUrl: resolvedUrls[j],
        });
      }
    }
  }

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  const separator = cfg.scrapeServiceUrl.includes("?") ? "&" : "?";

  for (const s of resolvedEvents) {
    const sportIcon = getSportIcon(s.category, "tim");
    const isLive = isLiveStream(s);
    let channelName = `${s.name} | ${formatTime(s.starts_at, cfg.timezone)} ${sportIcon}`;
    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = s.category || "Sports";
    const defaultLogo = s.logo || "";
    const logo = getLeagueLogo(s.category, defaultLogo);
    const scrapeUrl = `${cfg.scrapeServiceUrl}${separator}url=${encodeURIComponent(s.streamUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchTimStreamList,
  resolveTimEventStream,
  generateTimLivePlaylist,
};
