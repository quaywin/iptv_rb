const {
  formatTime,
  getSportIcon,
  capitalize,
  getLeagueLogo,
  mergeConfig,
  parseCineTime,
  fetchWithFallback,
  buildCandidateUrls,
  PROVIDER_MIRRORS,
} = require("../utils/helpers");

/**
 * Fetch live and upcoming events from Cinevid API with multi-mirror fallback
 */
async function fetchCineStreamList(cfg) {
  try {
    const cineUrl = cfg.cineApiUrl || "https://cinevid.st/api/public/events";
    const urls = buildCandidateUrls(cineUrl, PROVIDER_MIRRORS.cine);
    console.log(`Fetching Cinevid streams (primary: ${cineUrl}, candidates: ${urls.length})`);

    const json = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
      },
    });

    const rawEvents = Array.isArray(json) ? json : (json.events || []);

    const seenIds = new Set();
    const validEvents = [];

    for (const e of rawEvents) {
      if (!e || !e.id || seenIds.has(e.id)) continue;
      seenIds.add(e.id);

      // Skip ended events or events without playerUrl
      if (e.status === "Ended" || !e.playerUrl) continue;

      const starts_at = parseCineTime(e.date, e.time);
      const playUrl = e.playerUrl.startsWith("http")
        ? e.playerUrl
        : `https://cinevid.st${e.playerUrl}`;

      let defaultLogo = e.homeTeamImage || e.thumbnail || e.awayTeamImage || "";
      if (defaultLogo && defaultLogo.startsWith("/")) {
        defaultLogo = `https://cinevid.st${defaultLogo}`;
      }

      validEvents.push({
        id: e.id,
        title: e.title || "Event",
        sport: e.sport || "",
        league: e.league || "",
        status: e.status || "NS",
        starts_at,
        playUrl,
        logo: defaultLogo,
      });
    }

    console.log(`Fetched ${validEvents.length} valid Cinevid events.`);
    return validEvents;
  } catch (error) {
    console.error("Error fetching Cinevid stream list:", error.message);
    throw new Error(`Cinevid fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for Cinevid
 */
async function generateCinePlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting Cinevid playlist generation...");
  const events = await fetchCineStreamList(cfg);

  if (!events.length) {
    console.log("No Cinevid events found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const activeEvents = events.filter(e => {
    if (e.status === "Live") return true;
    if (!e.starts_at) return true;
    return e.starts_at >= now - hoursBack * 3600 && e.starts_at <= now + hoursAhead * 3600;
  });

  if (!activeEvents.length) {
    console.log(`0 active Cinevid events out of ${events.length} total. now=${now}`);
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  function isLiveStream(e) {
    if (e.status === "Live") return true;
    if (!e.starts_at) return false;
    const isUnderway = e.starts_at <= now && now - e.starts_at <= 3.5 * 3600;
    const isStartingSoon = e.starts_at > now && e.starts_at <= now + 1800;
    return isUnderway || isStartingSoon;
  }

  activeEvents.sort((a, b) => {
    const aLive = isLiveStream(a);
    const bLive = isLiveStream(b);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return (a.starts_at || 0) - (b.starts_at || 0);
  });

  console.log(`Filtered and sorted ${activeEvents.length} active Cinevid events.`);

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  let scrapeBase = cfg.cineScrapeServiceUrl || cfg.scrapeServiceUrl;
  if (!scrapeBase.includes("proxy_segments=true")) {
    const join = scrapeBase.includes("?") ? "&" : "?";
    scrapeBase = `${scrapeBase}${join}proxy_segments=true`;
  }
  const separator = scrapeBase.includes("?") ? "&" : "?";

  for (const e of activeEvents) {
    const sportIcon = getSportIcon(e.sport || e.league, "cine");
    const isLive = isLiveStream(e);

    let channelName = e.starts_at
      ? `${e.title} | ${formatTime(e.starts_at, cfg.timezone)} ${sportIcon}`
      : `${e.title} ${sportIcon}`;

    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = e.sport ? capitalize(e.sport) : (e.league ? capitalize(e.league) : "Sports");
    const logo = getLeagueLogo(e.league || e.sport, e.logo);
    const scrapeUrl = `${scrapeBase}${separator}url=${encodeURIComponent(e.playUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchCineStreamList,
  generateCinePlaylist,
};
