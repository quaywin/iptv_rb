const { formatTime, getLeagueLogo, mergeConfig } = require("../utils/helpers");

// In-memory cache for event detail pages when using fallback HTML scraping
const eventDetailCache = new Map();
const DETAIL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Hosts for Matchora API (with multi-domain redundancy)
const MATColorA_HOSTS = ["https://matchora.to", "https://matchora.pro", "https://es.matchora.pro"];

/**
 * Return precise sport emoji based on sportSlug and league name
 */
function getExactSportIcon(sportSlug, leagueName) {
  if (sportSlug) {
    const s = sportSlug.toLowerCase().trim().replace(/\s+/g, "-");
    if (s === "soccer" || s === "football") return "⚽";
    if (s === "basketball") return "🏀";
    if (s === "ice-hockey" || s === "hockey") return "🏒";
    if (s === "tennis") return "🎾";
    if (s === "american-football") return "🏈";
    if (s === "motorsport" || s === "racing") return "🏎️";
    if (s === "fighting" || s === "combat" || s === "boxing" || s === "mma") return "🥊";
    if (s === "rugby") return "🏉";
    if (s === "cricket") return "🏏";
    if (s === "baseball") return "⚾";
    if (s === "volleyball") return "🏐";
    if (s === "handball") return "🤾";
    if (s === "darts") return "🎯";
    if (s === "snooker" || s === "billiards") return "🎱";
    if (s === "table-tennis") return "🏓";
    if (s === "badminton") return "🏸";
    if (s === "cycling") return "🚴";
    if (s === "golf") return "⛳";
  }

  // Fallback: Infer from league name
  if (leagueName) {
    const l = leagueName.toLowerCase();
    if (l.includes("echl") || l.includes("nhl") || l.includes("ahl") || l.includes("hockey") || l.includes("khl")) return "🏒";
    if (l.includes("nba") || l.includes("basketball") || l.includes("eurocup") || l.includes("euroleague") || l.includes("cba") || l.includes("fiba")) return "🏀";
    if (l.includes("tennis") || l.includes("masters") || l.includes("atp") || l.includes("wta") || l.includes("wimbledon") || l.includes("open")) return "🎾";
    if (l.includes("nfl") || l.includes("american football")) return "🏈";
    if (l.includes("ufc") || l.includes("mma") || l.includes("boxing") || l.includes("fight") || l.includes("bellator")) return "🥊";
    if (l.includes("f1") || l.includes("formula") || l.includes("nascar") || l.includes("motogp") || l.includes("racing") || l.includes("motorsport")) return "🏎️";
    if (l.includes("rugby") || l.includes("afl") || l.includes("six nations")) return "🏉";
    if (l.includes("cricket") || l.includes("ipl") || l.includes("t20")) return "🏏";
    if (l.includes("mlb") || l.includes("baseball")) return "⚾";
    if (l.includes("volleyball")) return "🏐";
    if (l.includes("handball")) return "🤾";
    if (l.includes("champions league") || l.includes("uefa") || l.includes("afc") || l.includes("fifa") || l.includes("premier league") || l.includes("laliga") || l.includes("serie") || l.includes("bundesliga") || l.includes("ligue") || l.includes("copa") || l.includes("soccer") || l.includes("cup") || l.includes("caf") || l.includes("conmebol") || l.includes("allsvenskan") || l.includes("federacion")) return "⚽";
  }

  return "⚽"; // Default to soccer
}

/**
 * Fetch JSON with multi-host fallback (matchora.to -> matchora.pro -> es.matchora.pro)
 */
async function fetchMatchoraJson(endpoint, userAgent, timeoutMs = 6000) {
  let lastError = null;
  for (const host of MATColorA_HOSTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `${host}${endpoint}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`All Matchora hosts failed for ${endpoint}: ${lastError ? lastError.message : "HTTP error"}`);
}

/**
 * Fetch events from Matchora JSON API (v1 schedule)
 */
async function fetchMatchoraEvents(cfg) {
  console.log("Fetching sports events via Matchora API (/api/v1/schedule?watchable=1)...");
  const data = await fetchMatchoraJson("/api/v1/schedule?watchable=1", cfg.userAgent, cfg.timeout || 6000);
  const rawEvents = data.events || [];

  const now = Math.floor(Date.now() / 1000);
  const hoursBack = typeof cfg.hoursBack === "number" ? cfg.hoursBack : 4;
  const hoursAhead = typeof cfg.hoursAhead === "number" ? cfg.hoursAhead : 24;
  const minTime = now - (hoursBack * 3600);
  const maxTime = now + (hoursAhead * 3600);

  const events = [];
  for (const e of rawEvents) {
    if (!e || !e.channels || e.channels.length === 0) continue;

    // Filter dead channels and preserve metadata for ranking
    const activeChannels = e.channels
      .filter(c => !c.dead && (c.embed_url || c.id))
      .map((c, i) => ({
        embed: c.embed_url || `https://matchora.pro/embed/channel/${c.id}`,
        name: c.name || `Server ${i + 1}`,
        lang: c.lang || "",
        quality: c.quality || "",
        country: c.country || "",
        playing: !!c.playing,
        watching: typeof c.watching === "number" ? c.watching : (parseInt(c.watching, 10) || 0),
        dead: !!c.dead,
        logo: "",
      }));

    if (activeChannels.length === 0) continue;

    const isLive = !!e.live;
    const kickoff = e.kickoff || 0;

    // Time window filter: keep all live matches; for upcoming, enforce window
    if (!isLive) {
      if (e.finished) continue;
      if (kickoff && (kickoff < minTime || kickoff > maxTime)) continue;
    }

    const title = e.home && e.away ? `${e.home} vs ${e.away}` : (e.league || "Sports");
    const logo = e.home_badge || e.away_badge || e.league_badge || "";

    events.push({
      id: e.id,
      title,
      home: e.home || "",
      away: e.away || "",
      league: e.league || "Sports",
      leagueLogo: e.league_badge || "",
      logo,
      sport: e.sport || "",
      isLive,
      startsAt: kickoff,
      score: e.score || "",
      status: e.status || "",
      minute: e.minute || "",
      channels: activeChannels,
    });
  }

  console.log(`Parsed ${events.length} events from Matchora API (Live: ${events.filter(e => e.isLive).length}).`);
  return events;
}

/**
 * Fallback: Fetch detail page for a single event from sports247.ru HTML
 */
async function fetchEventDetails(eventUrl, userAgent, timeoutMs = 6000) {
  const now = Date.now();
  const cached = eventDetailCache.get(eventUrl);
  if (cached && now - cached.timestamp < DETAIL_CACHE_TTL) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(eventUrl, {
      headers: {
        "User-Agent": userAgent,
        "Referer": "https://en.sports247.ru/events",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { channels: [], startsAt: null, endsAt: null, sport: "" };
    }

    const html = await res.text();
    const channels = [];

    const sportMatch = html.match(/href="https?:\/\/en\.sports247\.ru\/sport\/([^"]+)"/i)
      || html.match(/\/sport\/([a-z-]+)/i);
    const sport = sportMatch ? sportMatch[1].trim() : "";

    let startsAt = null;
    let endsAt = null;
    const startMatch = html.match(/"startDate"\s*:\s*"([^"]+)"/);
    if (startMatch) {
      const parsedTime = new Date(startMatch[1]).getTime();
      if (!isNaN(parsedTime)) startsAt = Math.floor(parsedTime / 1000);
    }
    const endMatch = html.match(/"endDate"\s*:\s*"([^"]+)"/);
    if (endMatch) {
      const parsedEndTime = new Date(endMatch[1]).getTime();
      if (!isNaN(parsedEndTime)) endsAt = Math.floor(parsedEndTime / 1000);
    }

    const channelRegex = /<button[^>]*class="[^"]*event-channel-item[^"]*"[^>]*data-embed="([^"]+)"[^>]*data-name="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    let m;
    while ((m = channelRegex.exec(html)) !== null) {
      const embed = m[1].trim();
      const name = m[2].trim();
      const content = m[3];
      const langMatch = content.match(/class="event-channel-lang">\s*([^<]+)\s*<\/span>/);
      const lang = langMatch ? langMatch[1].trim() : "";
      const logoMatch = content.match(/class="event-channel-flag"[^>]*src="([^"]+)"/);
      const logo = logoMatch ? logoMatch[1] : "";
      channels.push({ embed, name, lang, logo });
    }

    if (channels.length === 0) {
      const iframeMatch = html.match(/<iframe[^>]*id="event-player-iframe"[^>]*src="([^"]+)"/i)
        || html.match(/<iframe[^>]*src="([^"]*matchora[^"]*)"/i);
      if (iframeMatch) {
        let embed = iframeMatch[1];
        const wrappedMatch = embed.match(/url=([^&]+)/);
        if (wrappedMatch) embed = decodeURIComponent(wrappedMatch[1]);
        channels.push({ embed, name: "Stream 1", lang: "", logo: "" });
      }
    }

    const result = { channels, startsAt, endsAt, sport, timestamp: now };
    eventDetailCache.set(eventUrl, result);
    return result;
  } catch (e) {
    if (cached) return cached;
    return { channels: [], startsAt: null, endsAt: null, sport: "" };
  }
}

/**
 * Concurrency helper for fallback scraping
 */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let currentIndex = 0;
  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        results[index] = null;
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fallback: Fetch sports events from sports247.ru HTML
 */
async function fetchSports247EventsFromHtml(cfg) {
  const baseUrl = cfg.sports247Url || "https://en.sports247.ru";
  const eventsUrl = `${baseUrl}/events`;
  console.log(`Fallback: Fetching Sports247 events from HTML: ${eventsUrl}`);

  const res = await fetch(eventsUrl, {
    headers: {
      "User-Agent": cfg.userAgent,
      "Referer": `${baseUrl}/`,
    },
  });

  if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);

  const html = await res.text();
  const contentIdx = html.indexOf('class="schedule-content"');
  const searchHtml = contentIdx !== -1 ? html.slice(contentIdx) : html;

  const dayTodayIdx = searchHtml.indexOf('data-day="today"');
  let todaySection = searchHtml;
  if (dayTodayIdx !== -1) {
    const dayTomorrowIdx = searchHtml.indexOf('data-day="tomorrow"', dayTodayIdx);
    todaySection = searchHtml.slice(dayTodayIdx, dayTomorrowIdx !== -1 ? dayTomorrowIdx : undefined);
  }

  const cardRegex = /<a\s+href="([^"]*\/event\/[^"]*)"\s+class="match-card\s*([^"]*)">([\s\S]*?)<\/a>/gi;
  const eventMap = new Map();

  function parseCard(m) {
    let url = m[1].trim();
    if (url.startsWith("/")) url = `${baseUrl}${url}`;
    const cardClass = m[2] || "";
    const isLive = cardClass.includes("live");
    const body = m[3];
    const leagueMatch = body.match(/class="match-card-league-name">\s*([^<]+)\s*<\/span>/);
    const league = leagueMatch ? leagueMatch[1].trim() : "Sports";
    const leagueLogoMatch = body.match(/class="match-card-league-badge"[^>]*src="([^"]+)"/);
    const leagueLogo = leagueLogoMatch ? leagueLogoMatch[1] : "";

    const homeTeamMatch = body.match(/class="match-team\s+match-team-home"[\s\S]*?class="match-team-name">\s*([^<]+)\s*<\/span>/);
    const awayTeamMatch = body.match(/class="match-team\s+match-team-away"[\s\S]*?class="match-team-name">\s*([^<]+)\s*<\/span>/);
    const home = homeTeamMatch ? homeTeamMatch[1].trim() : "";
    const away = awayTeamMatch ? awayTeamMatch[1].trim() : "";

    const homeLogoMatch = body.match(/class="match-team\s+match-team-home"[\s\S]*?src="([^"]+)"/);
    const awayLogoMatch = body.match(/class="match-team\s+match-team-away"[\s\S]*?src="([^"]+)"/);
    const logo = (homeLogoMatch ? homeLogoMatch[1] : "") || (awayLogoMatch ? awayLogoMatch[1] : "") || leagueLogo;
    const title = home && away ? `${home} vs ${away}` : league;

    return { url, isLive, league, leagueLogo, home, away, logo, title };
  }

  let match;
  while ((match = cardRegex.exec(todaySection)) !== null) {
    const item = parseCard(match);
    if (!eventMap.has(item.url)) eventMap.set(item.url, item);
  }

  const allCardRegex = /<a\s+href="([^"]*\/event\/[^"]*)"\s+class="match-card\s*([^"]*live[^"]*)">([\s\S]*?)<\/a>/gi;
  while ((match = allCardRegex.exec(searchHtml)) !== null) {
    const item = parseCard(match);
    if (!eventMap.has(item.url)) eventMap.set(item.url, item);
  }

  const rawEvents = Array.from(eventMap.values());
  const enriched = await mapConcurrent(rawEvents, 8, async (evt) => {
    const details = await fetchEventDetails(evt.url, cfg.userAgent, cfg.timeout || 6000);
    return {
      ...evt,
      channels: details.channels || [],
      startsAt: details.startsAt,
      sport: details.sport || "",
    };
  });

  return enriched;
}

/**
 * Smart Channel Ranking Score:
 * Evaluates live stream health, viewer popularity, video quality, language, and broadcaster reputation.
 */
function scoreChannel(ch, isLive = false) {
  if (ch.dead) return -9999;
  let score = 0;

  // 1. Live playback confirmation (+500 pts)
  if (ch.playing) score += 500;

  // 2. Viewer count / popularity (real active viewers, capped at 1000 pts)
  const watching = typeof ch.watching === "number" ? ch.watching : (parseInt(ch.watching, 10) || 0);
  score += Math.min(watching, 1000);

  // 3. Resolution / Quality weighting
  const quality = (ch.quality || "").toUpperCase();
  if (quality.includes("FHD") || quality.includes("1080")) score += 300;
  else if (quality.includes("HD") || quality.includes("720")) score += 200;
  else if (quality.includes("SD")) score += 50;

  // 4. Audio / Language prioritization
  const lang = (ch.lang || "").toLowerCase();
  if (lang.includes("en") || lang.includes("english")) {
    score += 400;
  } else if (["es", "spanish", "fr", "french", "pt", "portuguese", "de", "german", "it", "italian", "ar", "arabic"].some(l => lang.includes(l))) {
    score += 150;
  } else if (lang) {
    score += 50;
  }

  // 5. Popular Broadcasters bonus (+150 pts)
  const name = (ch.name || "").toLowerCase();
  const topBroadcasters = [
    "tnt", "sky", "espn", "tsn", "sportsnet", "canal", "bein", "dazn", "paramount", "stan", "nbc", "peacock", "supersport", "optus"
  ];
  if (topBroadcasters.some(b => name.includes(b))) {
    score += 150;
  }

  return score;
}

/**
 * Fetch events: First tries Matchora API, falls back to Sports247 HTML scraping
 */
async function fetchSports247Events(cfg) {
  try {
    return await fetchMatchoraEvents(cfg);
  } catch (err) {
    console.warn(`Matchora API failed (${err.message}). Falling back to HTML scraping...`);
    return await fetchSports247EventsFromHtml(cfg);
  }
}

/**
 * Generate M3U playlist for Sports247 / Matchora live & upcoming events
 */
async function generateSports247Playlist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting Sports247 / Matchora playlist generation...");

  const events = await fetchSports247Events(cfg);
  if (!events.length) {
    console.log("No events found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  // Sort: LIVE events first, then upcoming sorted chronologically
  events.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    return (a.startsAt || 0) - (b.startsAt || 0);
  });

  const scrapeBase = cfg.sports247ScrapeServiceUrl || cfg.damScrapeServiceUrl || cfg.scrapeServiceUrl;
  const separator = scrapeBase.includes("?") ? "&" : "?";
  const maxChannels = typeof cfg.maxChannelsPerEvent === "number" ? cfg.maxChannelsPerEvent : 4;

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  let streamCount = 0;

  for (const evt of events) {
    if (!evt || !evt.channels || evt.channels.length === 0) continue;

    const sportIcon = getExactSportIcon(evt.sport, evt.league);
    const groupTitle = evt.league ? `${sportIcon} ${evt.league}`.trim() : `${sportIcon} Sports`;
    const defaultLogo = evt.logo || evt.leagueLogo || "";
    const logo = getLeagueLogo(evt.league, defaultLogo);

    const formattedTime = evt.startsAt ? formatTime(evt.startsAt, cfg.timezone) : "";
    const timePart = formattedTime ? `| ${formattedTime}` : "";

    // Smart channel ranking: sort highest quality/health feeds first
    let channels = [...evt.channels];
    if (channels.length > 1) {
      channels.sort((a, b) => scoreChannel(b, evt.isLive) - scoreChannel(a, evt.isLive));
      if (maxChannels > 0) {
        channels = channels.slice(0, maxChannels);
      }
    }

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      if (!ch.embed) continue;

      const channelLabel = ch.name || (channels.length > 1 ? `Server ${i + 1}` : "");
      const qualityLabel = ch.quality && !channelLabel.toUpperCase().includes(ch.quality.toUpperCase()) ? `[${ch.quality}]` : "";
      const langLabel = ch.lang ? `[${ch.lang}]` : "";
      const extraInfo = [channelLabel, qualityLabel, langLabel].filter(Boolean).join(" ");

      let channelName = extraInfo
        ? `${evt.title} - ${extraInfo} ${timePart} ${sportIcon}`
        : `${evt.title} ${timePart} ${sportIcon}`;

      if (evt.isLive) {
        channelName = `🔴 ${channelName}`;
      }

      channelName = channelName.replace(/\s+/g, " ").trim();

      const itemLogo = ch.logo && ch.logo.startsWith("http") ? ch.logo : logo;
      const scrapeUrl = `${scrapeBase}${separator}url=${encodeURIComponent(ch.embed)}`;

      m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${itemLogo}" group-title="${groupTitle}",${channelName}\n`;
      m3uContent += `${scrapeUrl}\n\n`;
      streamCount++;
    }
  }

  console.log(`Generated Sports247 playlist with ${streamCount} streams across ${events.length} events (capped at max ${maxChannels} streams/event).`);
  return m3uContent;
}

module.exports = {
  fetchSports247Events,
  fetchMatchoraEvents,
  fetchEventDetails,
  generateSports247Playlist,
  getExactSportIcon,
  scoreChannel,
};
