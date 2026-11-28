const {
  formatTime,
  mergeConfig,
  fetchWithFallback,
  buildCandidateUrls,
  PROVIDER_MIRRORS,
  sanitizeM3uAttr,
  normalizeChannelKey,
  scoreBroadcastChannel,
  normalizeSportGroup,
} = require("../utils/helpers");

const FINISHED_CDN_STATUSES = new Set(["FT", "ENDED", "FINISHED", "AET", "PEN", "CANC", "POSTP", "PST"]);
const ENGLISH_CHANNEL_CODES = new Set(["US", "USA", "GB", "UK", "AU", "CA", "NZ", "IE"]);

function inferCdnLang(code = "") {
  const c = String(code || "").toUpperCase().trim();
  if (!c) return "";
  if (ENGLISH_CHANNEL_CODES.has(c)) return "en";
  return c.toLowerCase();
}

/**
 * Return precise sport emoji based on sport name or tournament
 */
function getCdnSportIcon(sportName, tournament = "") {
  const s = (sportName || "").toLowerCase();
  const t = (tournament || "").toLowerCase();

  if (s.includes("soccer") || s.includes("futsal") || t.includes("premier league") || t.includes("serie") || t.includes("laliga")) return "⚽";
  if (s.includes("basketball") || s.includes("nba") || s.includes("ncaa") || t.includes("basketball")) return "🏀";
  if (s.includes("hockey") || s.includes("nhl") || t.includes("hockey")) return "🏒";
  if (s.includes("tennis") || t.includes("atp") || t.includes("wta")) return "🎾";
  if (s.includes("nfl") || s.includes("football") || s.includes("american")) return "🏈";
  if (s.includes("motorsport") || s.includes("racing") || s.includes("f1") || t.includes("grand prix")) return "🏎️";
  if (s.includes("ufc") || s.includes("mma") || s.includes("wwe") || s.includes("boxing")) return "🥊";
  if (s.includes("rugby")) return "🏉";
  if (s.includes("cricket")) return "🏏";
  if (s.includes("baseball") || s.includes("mlb")) return "⚾";
  if (s.includes("volleyball")) return "🏐";
  if (s.includes("handball")) return "🤾";
  if (s.includes("darts")) return "🎯";
  if (s.includes("golf")) return "⛳";
  if (s.includes("badminton")) return "🏸";
  if (s.includes("cycling")) return "🚴";
  if (s.includes("winter")) return "⛷️";
  if (s.includes("horse")) return "🏇";

  return "🏆";
}

/**
 * Parse date string "YYYY-MM-DD HH:mm" into unix timestamp (seconds) assuming UTC
 */
function parseCdnDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  const iso = trimmed.replace(" ", "T") + (trimmed.length === 16 ? ":00Z" : "Z");
  const parsed = Date.parse(iso);
  return isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

/**
 * Fetch live and upcoming sports events from CDN Live TV
 */
async function fetchCdnEventsList(cfg) {
  const candidateUrls = buildCandidateUrls(cfg.cdnEventsUrl, PROVIDER_MIRRORS.cdnlivetv);
  console.log(`Fetching CDN Live sports events (primary: ${cfg.cdnEventsUrl}, candidates: ${candidateUrls.length})`);

  const data = await fetchWithFallback(candidateUrls, {
    timeoutMs: cfg.timeout || 6000,
    headers: {
      "User-Agent": cfg.userAgent,
      "Accept": "application/json",
    },
  });

  const root = data && (data["cdn-live-tv"] || data);
  if (!root || typeof root !== "object") {
    console.warn("Unexpected CDN Live TV events response structure.");
    return [];
  }

  const events = [];

  for (const [sportKey, val] of Object.entries(root)) {
    if (!Array.isArray(val)) continue;

    for (const item of val) {
      if (!item) continue;
      const channels = Array.isArray(item.channels) ? item.channels.filter(c => c && (c.url || c.channel_name || c.id)) : [];
      if (channels.length === 0) continue; // Skip events with no available stream/channel

      const startsAt = parseCdnDate(item.start);
      const endsAt = parseCdnDate(item.end);

      const title = (item.event || `${item.homeTeam || ""} vs ${item.awayTeam || ""}`).trim() || "Sports Event";

      events.push({
        gameId: item.gameID,
        title,
        homeTeam: item.homeTeam || "",
        awayTeam: item.awayTeam || "",
        homeTeamLogo: item.homeTeamIMG || "",
        awayTeamLogo: item.awayTeamIMG || "",
        tournament: item.tournament || "",
        country: item.country || "",
        countryLogo: item.countryIMG || "",
        status: (item.status || "NS").toUpperCase(),
        startsAt,
        endsAt,
        sport: sportKey,
        channels,
      });
    }
  }

  return events;
}

/**
 * Determine if event is currently live or starting very soon (within 30 mins)
 */
function isCdnEventLive(event, now) {
  if (event.status === "LIVE" || event.status === "IN_PLAY") return true;
  if (!event.startsAt) return false;

  const isUnderway = event.startsAt <= now && (event.endsAt ? now <= event.endsAt : (now - event.startsAt <= 3.5 * 3600));
  const isStartingSoon = event.startsAt > now && (event.startsAt - now <= 1800);
  return isUnderway || isStartingSoon;
}

/**
 * Generate M3U playlist for CDN Live Events (/cdn)
 */
async function generateCdnPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting CDN Live Events playlist generation...");

  const events = await fetchCdnEventsList(cfg);
  if (!events.length) {
    console.log("No CDN Live sports events with streams found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  const now = Math.floor(Date.now() / 1000);
  const hoursBack = typeof cfg.cdnHoursBack === "number" ? cfg.cdnHoursBack : (typeof cfg.hoursBack === "number" ? cfg.hoursBack : 4);
  // Default to 72 hours (3 days) for CDN events so upcoming matches & weekend events are visible
  const hoursAhead = typeof cfg.cdnHoursAhead === "number" ? cfg.cdnHoursAhead : (cfg.hoursAhead && cfg.hoursAhead > 24 ? cfg.hoursAhead : 72);
  const minTime = now - (hoursBack * 3600);
  const maxTime = now + (hoursAhead * 3600);

  // Time window filter: exclude finished/cancelled events, keep all live matches, enforce window for upcoming
  const activeEvents = events.filter(e => {
    if (FINISHED_CDN_STATUSES.has(e.status)) return false;
    const live = isCdnEventLive(e, now);
    if (live) return true;
    if (!e.startsAt) return false;
    return e.startsAt >= minTime && e.startsAt <= maxTime;
  });

  // Sort: LIVE events first, then upcoming sorted chronologically
  activeEvents.sort((a, b) => {
    const aLive = isCdnEventLive(a, now);
    const bLive = isCdnEventLive(b, now);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return (a.startsAt || 0) - (b.startsAt || 0);
  });

  console.log(`Filtered and sorted ${activeEvents.length} active CDN Live events (out of ${events.length} total).`);

  const scrapeBase = cfg.cdnScrapeServiceUrl || cfg.sports247ScrapeServiceUrl || cfg.damScrapeServiceUrl || cfg.scrapeServiceUrl;
  let base = scrapeBase;
  if (base && !base.includes("proxy_segments=true")) {
    const join = base.includes("?") ? "&" : "?";
    base = `${base}${join}proxy_segments=true`;
  }
  const sep = base ? (base.includes("?") ? "&" : "?") : "?";
  const maxChannels = typeof cfg.maxChannelsPerEvent === "number" ? cfg.maxChannelsPerEvent : 4;

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  for (const evt of activeEvents) {
    const sportIcon = getCdnSportIcon(evt.sport, evt.tournament);
    const live = isCdnEventLive(evt, now);

    const formattedTime = evt.startsAt ? formatTime(evt.startsAt, cfg.timezone) : "";
    const timePart = formattedTime ? `| ${formattedTime}` : "";
    const leagueTag = evt.tournament ? `[${evt.tournament}]` : "";

    const groupTitle = normalizeSportGroup(evt.sport, evt.tournament);

    const defaultLogo = evt.countryLogo || evt.homeTeamLogo || "";

    // Filter out explicitly offline channels when online alternatives exist, then score & dedupe
    const onlineOnly = evt.channels.filter(
      ch => !ch.dead && String(ch.status || "").toLowerCase() !== "offline"
    );
    const candidatePool = (onlineOnly.length ? onlineOnly : evt.channels).map(ch => ({
      ...ch,
      _score: scoreBroadcastChannel(
        {
          name: ch.channel_name || "",
          status: ch.status,
          dead: ch.dead,
          lang: inferCdnLang(ch.channel_code),
          playing: String(ch.status || "").toLowerCase() === "online",
        },
        live
      ),
    }));
    candidatePool.sort((a, b) => b._score - a._score);

    const deduped = [];
    const seenKeys = new Set();
    for (const ch of candidatePool) {
      const key = normalizeChannelKey(ch.channel_name || "");
      const isGeneric = !key || key.startsWith("server") || key.startsWith("stream");
      if (!isGeneric) {
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }
      deduped.push(ch);
    }
    if (maxChannels > 0 && deduped.length < maxChannels) {
      for (const ch of candidatePool) {
        if (!deduped.includes(ch)) {
          deduped.push(ch);
          if (deduped.length >= maxChannels) break;
        }
      }
    }
    const selectedChannels = maxChannels > 0 ? deduped.slice(0, maxChannels) : deduped;

    selectedChannels.forEach((ch, idx) => {
      const serverLabel = ch.channel_name || (selectedChannels.length > 1 ? `Server ${idx + 1}` : "");
      const serverPart = serverLabel ? `| ${serverLabel}` : "";

      let channelName = `${evt.title} ${leagueTag} ${serverPart} ${timePart} ${sportIcon}`.replace(/\s+/g, " ").trim();
      if (live) {
        channelName = `🔴 ${channelName}`;
      }

      const safeChannelName = sanitizeM3uAttr(channelName);
      const safeGroupTitle = sanitizeM3uAttr(groupTitle);
      const logo = ch.image || defaultLogo;

      const embedUrl = ch.url || `https://cdnlivetv.tv/api/v1/channels/player/?name=${encodeURIComponent(ch.channel_name || "")}&code=${encodeURIComponent(ch.channel_code || "")}&user=cdnlivetv&plan=free`;
      const streamUrl = base ? `${base}${sep}url=${encodeURIComponent(embedUrl)}` : embedUrl;

      m3uContent += `#EXTINF:-1 tvg-id="${sanitizeM3uAttr(ch.id || evt.gameId || "")}" tvg-name="${safeChannelName}" tvg-logo="${logo}" group-title="${safeGroupTitle}",${safeChannelName}\n`;
      m3uContent += `${streamUrl}\n\n`;
    });
  }

  return m3uContent;
}

module.exports = {
  fetchCdnEventsList,
  generateCdnPlaylist,
  getCdnSportIcon,
  parseCdnDate,
};
