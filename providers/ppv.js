const {
  formatTime,
  getSportIcon,
  getLeagueLogo,
  mergeConfig,
  fetchWithFallback,
} = require("../utils/helpers");

/**
 * Fetch streams from PPV API with multi-proxy & direct fallback
 */
async function fetchPpvStreamList(cfg) {
  try {
    const candidates = [
      cfg.ppvApiUrl,
      "https://api.ppv.st/api/streams",
      "https://api.ppv.to/api/streams",
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api.ppv.st/api/streams"),
    ].filter(Boolean);

    console.log(`Fetching PPV streams (primary: ${cfg.ppvApiUrl}, candidates: ${candidates.length})`);

    const data = await fetchWithFallback(candidates, {
      timeoutMs: cfg.timeout || 7000,
      headers: {
        "User-Agent": cfg.userAgent,
        "Origin": "https://iptv-140.pages.dev",
        "Referer": "https://iptv-140.pages.dev/",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    const categories = data.streams || [];
    const allStreams = [];

    for (const group of categories) {
      const catName = group.category || "Sports";
      if (!Array.isArray(group.streams)) continue;
      for (const item of group.streams) {
        if (!item.iframe) continue;
        allStreams.push({
          ...item,
          category: item.category_name || catName,
        });
      }
    }

    console.log(`Fetched ${allStreams.length} total PPV streams across ${categories.length} categories.`);
    return allStreams;
  } catch (error) {
    console.error("Error fetching PPV stream list:", error.message);
    throw new Error(`PPV fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for PPV
 */
async function generatePpvPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting PPV playlist generation...");
  const streams = await fetchPpvStreamList(cfg);

  if (!streams.length) {
    console.log("No PPV streams parsed from categories.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const activeStreams = streams.filter(s => {
    const is24_7 = s.always_live === 1 || !s.starts_at || s.starts_at === 0 || s.tag === "24/7 channel";
    if (is24_7) return true;
    return s.starts_at >= now - hoursBack * 3600 && s.starts_at <= now + hoursAhead * 3600;
  });

  if (!activeStreams.length) {
    console.log(`0 active PPV streams out of ${streams.length} total. now=${now}`);
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  function is24_7Channel(s) {
    return s.always_live === 1 || !s.starts_at || s.starts_at === 0 || s.tag === "24/7 channel";
  }

  function isLiveMatch(s) {
    if (is24_7Channel(s)) return false;
    const isUnderway = s.starts_at <= now && (s.ends_at >= now || now - s.starts_at <= 3.5 * 3600);
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

  console.log(`Filtered and sorted ${activeStreams.length} active PPV streams.`);

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  const separator = cfg.scrapeServiceUrl.includes("?") ? "&" : "?";

  for (const s of activeStreams) {
    const sportIcon = getSportIcon(s.category, "ppv");
    const is24_7 = is24_7Channel(s);
    const isLive = isLiveMatch(s);

    let channelName = is24_7
      ? `${s.name} ${sportIcon}`
      : `${s.name} | ${formatTime(s.starts_at, cfg.timezone)} ${sportIcon}`;

    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = s.category || "Sports";
    const defaultLogo = s.poster || "";
    const logo = getLeagueLogo(s.tag || s.category, defaultLogo);
    const scrapeUrl = `${cfg.scrapeServiceUrl}${separator}url=${encodeURIComponent(s.iframe)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchPpvStreamList,
  generatePpvPlaylist,
};
