const { formatTime, getSportIcon, parseTimTime, capitalize, getLeagueLogo, mergeConfig } = require("../utils/helpers");

/**
 * Fetch matches from reedstreams API (GK)
 */
async function fetchGkStreamList(cfg) {
  try {
    const gkUrl = cfg.gkApiUrl || "https://api.reedstreams.link/api/matches/all";
    console.log(`Fetching GK streams from: ${gkUrl}`);
    const response = await fetch(gkUrl, {
      headers: {
        "User-Agent": cfg.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const matches = await response.json();
    if (!Array.isArray(matches)) {
      console.log("GK response is not an array.");
      return [];
    }

    const validMatches = [];
    for (const m of matches) {
      if (!m.sources || !m.sources.length) continue;
      // Ưu tiên stream HD hoặc stream đầu tiên
      const hdSource = m.sources.find(s => s.name?.includes("HD") || s.streamNo === 1) || m.sources[0];
      if (!hdSource || !hdSource.embedUrl) continue;

      const starts_at = typeof m.date === "number" ? Math.floor(m.date / 1000) : parseTimTime(m.date);
      const ends_at = typeof m.ends_at === "number" ? Math.floor(m.ends_at / 1000) : (starts_at ? starts_at + 3 * 3600 : undefined);

      let poster = m.poster || "";
      if (poster && !poster.startsWith("http")) {
        poster = `https://api.reedstreams.link${poster}`;
      }

      validMatches.push({
        id: m.id,
        name: m.title || "Match",
        category: m.category || "sports",
        leagueName: m.league_name || m.league?.name || "",
        starts_at,
        ends_at,
        embedUrl: hdSource.embedUrl,
        poster,
      });
    }

    console.log(`Fetched ${validMatches.length} valid GK matches from ReedStreams.`);
    return validMatches;
  } catch (error) {
    console.error("Error fetching GK stream list:", error.message);
    throw new Error(`GK fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for GK (ReedStreams)
 */
async function generateGkPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting GK playlist generation...");
  const matches = await fetchGkStreamList(cfg);

  if (!matches.length) {
    console.log("No GK streams found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const activeMatches = matches.filter(m => {
    if (!m.starts_at) return true;
    return m.starts_at >= now - hoursBack * 3600 && m.starts_at <= now + hoursAhead * 3600;
  });

  if (!activeMatches.length) {
    console.log(`0 active GK streams out of ${matches.length} total. now=${now}`);
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  function isLiveMatch(m) {
    if (!m.starts_at) return false;
    const isUnderway = m.starts_at <= now && (m.ends_at ? m.ends_at >= now : now - m.starts_at <= 3.5 * 3600);
    const isStartingSoon = m.starts_at > now && m.starts_at <= now + 1800;
    return isUnderway || isStartingSoon;
  }

  activeMatches.sort((a, b) => {
    const aLive = isLiveMatch(a);
    const bLive = isLiveMatch(b);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return (a.starts_at || 0) - (b.starts_at || 0);
  });

  console.log(`Filtered and sorted ${activeMatches.length} active GK streams.`);

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  const separator = cfg.scrapeServiceUrl.includes("?") ? "&" : "?";

  for (const m of activeMatches) {
    const sportIcon = getSportIcon(m.category, "gk");
    const isLive = isLiveMatch(m);

    let channelName = m.starts_at
      ? `${m.name} | ${formatTime(m.starts_at, cfg.timezone)} ${sportIcon}`
      : `${m.name} ${sportIcon}`;

    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = m.leagueName || capitalize(m.category) || "Sports";
    const defaultLogo = m.poster || "";
    const logo = getLeagueLogo(m.leagueName || m.category, defaultLogo);
    const scrapeUrl = `${cfg.scrapeServiceUrl}${separator}url=${encodeURIComponent(m.embedUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchGkStreamList,
  generateGkPlaylist,
};
