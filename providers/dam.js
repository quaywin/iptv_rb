const {
  formatTime,
  getSportIcon,
  capitalize,
  getLeagueLogo,
  mergeConfig,
  fetchWithFallback,
  buildCandidateUrls,
  PROVIDER_MIRRORS,
} = require("../utils/helpers");

/**
 * Fetch streams from ondemand.st (DAMITV) API with multi-mirror fallback
 */
async function fetchDamStreamList(cfg) {
  try {
    const url = cfg.damApiUrl || "https://ondemand.st/papi/api/streams";
    const urls = buildCandidateUrls(url, PROVIDER_MIRRORS.dam);
    console.log(`Fetching DAM streams (primary: ${url}, candidates: ${urls.length})`);

    const data = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
        "Referer": "https://ondemand.st/",
        "Origin": "https://ondemand.st",
      },
    });

    const categories = data.streams || [];
    const allStreams = [];

    for (const group of categories) {
      const catName = group.category || "sports";
      if (!Array.isArray(group.streams)) continue;
      for (const item of group.streams) {
        if (!item.embed && (!item.sources || !item.sources.length)) continue;
        allStreams.push({
          ...item,
          category: item.category_name || catName,
        });
      }
    }

    console.log(`Fetched ${allStreams.length} total DAM streams across ${categories.length} categories.`);
    return allStreams;
  } catch (error) {
    console.error("Error fetching DAM stream list:", error.message);
    throw new Error(`DAM fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for DAM (ondemand.st)
 */
async function generateDamPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting DAM playlist generation...");
  const streams = await fetchDamStreamList(cfg);

  if (!streams.length) {
    console.log("No DAM streams found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const activeStreams = streams.filter(s => {
    const is24_7 = s.always_live === 1 || !s.starts_at || s.starts_at === 0 || s.category === "24/7-streams";
    if (is24_7) return true;
    return s.starts_at >= now - hoursBack * 3600 && s.starts_at <= now + hoursAhead * 3600;
  });

  if (!activeStreams.length) {
    console.log(`0 active DAM streams out of ${streams.length} total. now=${now}`);
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  function is24_7Channel(s) {
    return s.always_live === 1 || !s.starts_at || s.starts_at === 0 || s.category === "24/7-streams";
  }

  function isLiveMatch(s) {
    if (is24_7Channel(s)) return false;
    if (s.status === "live") return true;
    const isUnderway = s.starts_at <= now && (s.ends_at ? s.ends_at >= now : now - s.starts_at <= 3.5 * 3600);
    const isStartingSoon = s.starts_at > now && s.starts_at <= now + 1800;
    return isUnderway || isStartingSoon;
  }

  activeStreams.sort((a, b) => {
    const a24_7 = is24_7Channel(a);
    const b24_7 = is24_7Channel(b);

    // Kênh 24/7 luôn chuyển xuống dưới cùng
    if (!a24_7 && b24_7) return -1;
    if (a24_7 && !b24_7) return 1;

    // Trong nhóm 24/7: sắp xếp theo tên
    if (a24_7 && b24_7) {
      return (a.name || "").localeCompare(b.name || "");
    }

    // Đối với các trận đấu: Trận live/sắp đá đưa lên đầu
    const aLive = isLiveMatch(a);
    const bLive = isLiveMatch(b);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;

    // Sắp xếp các trận theo thời gian bắt đầu (tăng dần)
    return (a.starts_at || 0) - (b.starts_at || 0);
  });

  console.log(`Filtered and sorted ${activeStreams.length} active DAM streams.`);

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  let scrapeBase = cfg.damScrapeServiceUrl || cfg.scrapeServiceUrl || "";
  if (scrapeBase && !scrapeBase.includes("proxy_segments=true")) {
    const sep = scrapeBase.includes("?") ? "&" : "?";
    scrapeBase = `${scrapeBase}${sep}proxy_segments=true`;
  }
  const separator = scrapeBase.includes("?") ? "&" : "?";

  for (const s of activeStreams) {
    const sportIcon = getSportIcon(s.category, "dam");
    const is24_7 = is24_7Channel(s);
    const isLive = isLiveMatch(s);

    const baseName = s.name || (s.teams?.home?.name && s.teams?.away?.name ? `${s.teams.home.name} vs ${s.teams.away.name}` : "Event");

    let channelName = is24_7
      ? `${baseName} ${sportIcon}`
      : `${baseName} | ${formatTime(s.starts_at, cfg.timezone)} ${sportIcon}`;

    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = s.league || capitalize((s.category || "sports").replace(/-/g, " "));
    const defaultLogo = s.teams?.home?.badge || s.poster || "";
    const logo = getLeagueLogo(s.league || s.category, defaultLogo);

    let embedUrl = s.embed;
    if (s.sources && s.sources.length) {
      const preferred = s.sources.find(src => src.hd === 1 && src.embed) || s.sources.find(src => src.embed);
      if (preferred && preferred.embed) {
        embedUrl = preferred.embed;
      }
    }

    const scrapeUrl = `${scrapeBase}${separator}url=${encodeURIComponent(embedUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchDamStreamList,
  generateDamPlaylist,
  generateOndemandPlaylist: generateDamPlaylist,
};
