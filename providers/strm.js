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
 * Fetch streams from strmfree API with multi-mirror fallback
 */
async function fetchStrmStreamList(cfg) {
  try {
    const urls = buildCandidateUrls(cfg.streamApiUrl, PROVIDER_MIRRORS.strm);
    console.log(`Fetching STRM streams (primary: ${cfg.streamApiUrl}, candidates: ${urls.length})`);

    const data = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
        "Referer": cfg.referer,
        "Origin": cfg.origin,
      },
    });
    const categories = data.streams || {};

    const allStreams = [];
    for (const [category, items] of Object.entries(categories)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item.stream_key) continue;
        allStreams.push({
          ...item,
          category: item.category || category
        });
      }
    }

    console.log(`Fetched ${allStreams.length} total STRM streams across ${Object.keys(categories).length} categories.`);
    return allStreams;
  } catch (error) {
    console.error("Error fetching STRM stream list:", error.message);
    return [];
  }
}

/**
 * Generate M3U playlist for STRM
 */
async function generateStrmPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting STRM playlist generation...");
  const streams = await fetchStrmStreamList(cfg);

  if (!streams.length) {
    console.log("No STRM streams found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const activeStreams = streams.filter(stream => {
    const ts = stream.match_timestamp;
    if (!ts) return true;

    const isPastEvent = now - ts > 24 * 3600;
    if (isPastEvent) {
      const isKnown24_7 =
        (stream.viewers > 0) ||
        ["F1", "SKY", "WILLOW", "NFL"].includes(stream.league) ||
        stream.name.toLowerCase().includes("sky") ||
        stream.name.toLowerCase().includes("redzone");
      return isKnown24_7;
    }

    return ts >= now - hoursBack * 3600 && ts <= now + hoursAhead * 3600;
  });

  function is24_7Stream(stream) {
    const ts = stream.match_timestamp;
    if (!ts) return true;
    return now - ts > 24 * 3600;
  }

  function isLiveMatch(stream) {
    const ts = stream.match_timestamp;
    if (!ts || is24_7Stream(stream)) return false;
    const isUnderway = ts <= now && now - ts <= 3.5 * 3600;
    const isStartingSoon = ts > now && ts <= now + 1800;
    return isUnderway || isStartingSoon;
  }

  activeStreams.sort((a, b) => {
    const a24_7 = is24_7Stream(a);
    const b24_7 = is24_7Stream(b);

    // Kênh 24/7 luôn chuyển xuống dưới cùng
    if (!a24_7 && b24_7) return -1;
    if (a24_7 && !b24_7) return 1;

    // Trong nhóm 24/7: sắp xếp theo tên
    if (a24_7 && b24_7) {
      const nameA = a.name || a.stream_key || "";
      const nameB = b.name || b.stream_key || "";
      return nameA.localeCompare(nameB);
    }

    // Đối với các trận đấu: Trận live/sắp đá đưa lên đầu
    const aLive = isLiveMatch(a);
    const bLive = isLiveMatch(b);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;

    // Sắp xếp các trận theo thời gian thi đấu tăng dần
    return (a.match_timestamp || 0) - (b.match_timestamp || 0);
  });

  console.log(`Filtered and sorted ${activeStreams.length} active STRM streams.`);

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  for (const stream of activeStreams) {
    const category = stream.category || "sports";
    const sportIcon = getSportIcon(category);
    const ts = stream.match_timestamp;

    const is24_7 = is24_7Stream(stream);
    const isLive = isLiveMatch(stream);

    let baseName = "";
    if (stream.team1?.name && stream.team2?.name) {
      baseName = `${stream.team1.name} vs ${stream.team2.name}`;
    } else {
      baseName = stream.name || stream.stream_key;
    }

    let channelName = is24_7
      ? `${baseName} ${sportIcon}`
      : `${baseName} | ${formatTime(ts, cfg.timezone)} ${sportIcon}`;

    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = capitalize(category);

    let defaultLogo = stream.team1?.logo || "";
    if (!defaultLogo && stream.thumbnail_url) {
      defaultLogo = stream.thumbnail_url.startsWith("http")
        ? stream.thumbnail_url
        : `https://strmfree.st${stream.thumbnail_url}`;
    }
    const logo = getLeagueLogo(stream.league, defaultLogo);

    const embedUrl = `${cfg.embedBaseUrl}/${category}/${stream.stream_key}1080p`;
    const scrapeBase = cfg.strmScrapeServiceUrl || cfg.scrapeServiceUrl;
    const sep = scrapeBase.includes("?") ? "&" : "?";
    const scrapeUrl = `${scrapeBase}${sep}url=${encodeURIComponent(embedUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchStrmStreamList,
  generateStrmPlaylist,
};
