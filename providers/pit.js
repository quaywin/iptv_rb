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
 * Fetch live and upcoming programs from PitSport home API with multi-mirror fallback
 */
async function fetchPitStreamList(cfg) {
  try {
    const pitUrl = cfg.pitApiUrl || "https://pitsport.st/api/v1/home";
    const urls = buildCandidateUrls(pitUrl, PROVIDER_MIRRORS.pit);
    console.log(`Fetching PitSport streams (primary: ${pitUrl}, candidates: ${urls.length})`);

    const json = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
      },
    });

    const data = json.data || {};
    const rawList = [...(data.live || []), ...(data.upcoming || [])];

    const seenIds = new Set();
    const validPrograms = [];

    for (const p of rawList) {
      if (!p || !p.programId || seenIds.has(p.programId)) continue;
      seenIds.add(p.programId);

      // Skip entries without playable video link or where hasVideo is explicitly false
      if (p.hasVideo === false || !p.playHref) continue;

      const playUrl = p.playHref.startsWith("http")
        ? p.playHref
        : `https://pitsport.st${p.playHref}`;

      const title = p.titleText || (p.title || []).map(t => t.text).filter(Boolean).join(" vs ") || "Event";
      const category = p.footer || p.competitionSlug || "Sports";
      const logo = (p.logo || p.background || "").replace(/^http:\/\/pitsport\.st/, "https://pitsport.st");

      validPrograms.push({
        id: p.programId,
        name: title,
        category,
        competitionSlug: p.competitionSlug || "",
        starts_at: p.sessionStart,
        liveState: p.liveState,
        playUrl,
        logo,
      });
    }

    console.log(`Fetched ${validPrograms.length} valid PitSport programs.`);
    return validPrograms;
  } catch (error) {
    console.error("Error fetching PitSport stream list:", error.message);
    throw new Error(`PitSport fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for PitSport
 */
async function generatePitPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting PitSport playlist generation...");
  const programs = await fetchPitStreamList(cfg);

  if (!programs.length) {
    console.log("No PitSport programs found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const { hoursBack, hoursAhead } = cfg;

  const activePrograms = programs.filter(p => {
    if (!p.starts_at) return true;
    return p.starts_at >= now - hoursBack * 3600 && p.starts_at <= now + hoursAhead * 3600;
  });

  if (!activePrograms.length) {
    console.log(`0 active PitSport programs out of ${programs.length} total. now=${now}`);
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  function isLiveStream(p) {
    if (p.liveState === "live") return true;
    if (!p.starts_at) return false;
    const isUnderway = p.starts_at <= now && now - p.starts_at <= 3.5 * 3600;
    const isStartingSoon = p.starts_at > now && p.starts_at <= now + 1800;
    return isUnderway || isStartingSoon;
  }

  activePrograms.sort((a, b) => {
    const aLive = isLiveStream(a);
    const bLive = isLiveStream(b);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return (a.starts_at || 0) - (b.starts_at || 0);
  });

  console.log(`Filtered and sorted ${activePrograms.length} active PitSport programs.`);

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  const separator = cfg.scrapeServiceUrl.includes("?") ? "&" : "?";

  for (const p of activePrograms) {
    const sportIcon = getSportIcon(p.competitionSlug || p.category, "pit");
    const isLive = isLiveStream(p);

    let channelName = p.starts_at
      ? `${p.name} | ${formatTime(p.starts_at, cfg.timezone)} ${sportIcon}`
      : `${p.name} ${sportIcon}`;

    if (isLive) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = p.category || "Sports";
    const defaultLogo = p.logo || "";
    const logo = getLeagueLogo(p.competitionSlug || p.category, defaultLogo);
    const scrapeUrl = `${cfg.scrapeServiceUrl}${separator}url=${encodeURIComponent(p.playUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  fetchPitStreamList,
  generatePitPlaylist,
};
