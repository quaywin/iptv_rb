const { mergeConfig } = require("../utils/helpers");

const COUNTRY_MAP = {
  US: { country: "United States", flag: "🇺🇸", order: 1 },
  USA: { country: "United States", flag: "🇺🇸", order: 1 },
  GB: { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  UK: { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  ES: { country: "Spain", flag: "🇪🇸", order: 3 },
  IT: { country: "Italy", flag: "🇮🇹", order: 4 },
  FR: { country: "France", flag: "🇫🇷", order: 5 },
  DE: { country: "Germany", flag: "🇩🇪", order: 6 },
  CA: { country: "Canada", flag: "🇨🇦", order: 7 },
  SA: { country: "Saudi Arabia", flag: "🇸🇦", order: 8 },
  AR: { country: "Arabic / MENA", flag: "🌍", order: 8 },
  BEE: { country: "beIN Sports", flag: "🇶🇦", order: 9 },
  PT: { country: "Portugal", flag: "🇵🇹", order: 10 },
  NL: { country: "Netherlands", flag: "🇳🇱", order: 11 },
  BE: { country: "Belgium", flag: "🇧🇪", order: 12 },
  TR: { country: "Turkey", flag: "🇹🇷", order: 13 },
  PL: { country: "Poland", flag: "🇵🇱", order: 14 },
  BR: { country: "Brazil", flag: "🇧🇷", order: 15 },
  AU: { country: "Australia", flag: "🇦🇺", order: 16 },
  NZ: { country: "New Zealand", flag: "🇳🇿", order: 17 },
  GR: { country: "Greece", flag: "🇬🇷", order: 18 },
  AL: { country: "Albania", flag: "🇦🇱", order: 19 },
  HR: { country: "Croatia", flag: "🇭🇷", order: 20 },
  CZ: { country: "Czech Republic", flag: "🇨🇿", order: 21 },
  SK: { country: "Slovakia", flag: "🇸🇰", order: 22 },
  AT: { country: "Austria", flag: "🇦🇹", order: 23 },
  CH: { country: "Switzerland", flag: "🇨🇭", order: 24 },
  SE: { country: "Sweden", flag: "🇸🇪", order: 25 },
  NO: { country: "Norway", flag: "🇳🇴", order: 26 },
  DK: { country: "Denmark", flag: "🇩🇰", order: 27 },
  FI: { country: "Finland", flag: "🇫🇮", order: 28 },
  IS: { country: "Iceland", flag: "🇮🇸", order: 29 },
  RO: { country: "Romania", flag: "🇷🇴", order: 30 },
  BG: { country: "Bulgaria", flag: "🇧🇬", order: 31 },
  HU: { country: "Hungary", flag: "🇭🇺", order: 32 },
  RU: { country: "Russia", flag: "🇷🇺", order: 33 },
  UA: { country: "Ukraine", flag: "🇺🇦", order: 34 },
  IE: { country: "Ireland", flag: "🇮🇪", order: 35 },
  CY: { country: "Cyprus", flag: "🇨🇾", order: 36 },
  SG: { country: "Singapore", flag: "🇸🇬", order: 37 },
  MY: { country: "Malaysia", flag: "🇲🇾", order: 38 },
  ID: { country: "Indonesia", flag: "🇮🇩", order: 39 },
  PH: { country: "Philippines", flag: "🇵🇭", order: 40 },
  JP: { country: "Japan", flag: "🇯🇵", order: 41 },
  KR: { country: "South Korea", flag: "🇰🇷", order: 42 },
  HK: { country: "Hong Kong", flag: "🇭🇰", order: 43 },
  IR: { country: "Iran", flag: "🇮🇷", order: 44 },
  KW: { country: "Kuwait", flag: "🇰🇼", order: 45 },
  KU: { country: "Kuwait", flag: "🇰🇼", order: 45 },
  BH: { country: "Bahrain", flag: "🇧🇭", order: 46 },
  QA: { country: "Qatar", flag: "🇶🇦", order: 47 },
  AE: { country: "United Arab Emirates", flag: "🇦🇪", order: 48 },
  LT: { country: "Lithuania", flag: "🇱🇹", order: 49 },
  EST: { country: "Estonia", flag: "🇪🇪", order: 50 },
  LAT: { country: "Latvia", flag: "🇱🇻", order: 51 },
  MK: { country: "North Macedonia", flag: "🇲🇰", order: 52 },
  EXYU: { country: "Ex-Yugoslavia / Balkan", flag: "🌍", order: 53 },
  BY: { country: "Belarus", flag: "🇧🇾", order: 54 },
  AZ: { country: "Azerbaijan", flag: "🇦🇿", order: 55 },
  KZ: { country: "Kazakhstan", flag: "🇰🇿", order: 56 },
  KA: { country: "Kazakhstan", flag: "🇰🇿", order: 56 },
  TJ: { country: "Tajikistan", flag: "🇹🇯", order: 57 },
  AM: { country: "Armenia", flag: "🇦🇲", order: 58 },
  MT: { country: "Malta", flag: "🇲🇹", order: 59 },
  LA: { country: "Laos", flag: "🇱🇦", order: 60 },
  CG: { country: "Congo", flag: "🇨🇬", order: 61 },
  AFG: { country: "Afghanistan", flag: "🇦🇫", order: 62 },
  AFR: { country: "Africa", flag: "🌍", order: 63 },
  ASIA: { country: "Asia", flag: "🌏", order: 64 },
  NA: { country: "North America", flag: "🌎", order: 65 },
  CRB: { country: "Caribbean", flag: "🏝️", order: 66 },
  WC: { country: "World", flag: "🌐", order: 67 },
  WORLD: { country: "World", flag: "🌐", order: 67 },
  OTHER: { country: "International", flag: "🌐", order: 99 },
};

function getSports247ChannelCountry(ch) {
  if (ch.country) {
    const code = ch.country.toUpperCase().trim();
    if (COUNTRY_MAP[code]) return COUNTRY_MAP[code];
    return { country: code, flag: "🌐", order: 90 };
  }
  return COUNTRY_MAP.OTHER;
}

// In-memory cache for all 24/7 channels
let cachedChannels = null;
let cacheTimestamp = 0;
let inFlightFetch = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Multi-domain redundancy for Matchora
const MATColorA_HOSTS = ["https://matchora.to", "https://matchora.pro", "https://es.matchora.pro"];

async function fetchMatchoraJson(endpoint, userAgent, timeoutMs = 8000) {
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

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch channels from Matchora JSON API (/api/v1/channels)
 */
async function fetchChannelsFromApi(cfg) {
  console.log("Fetching channels from Matchora API (/api/v1/channels)...");
  const data = await fetchMatchoraJson("/api/v1/channels", cfg.userAgent, cfg.timeout || 8000);
  const channelsList = data.channels || [];

  const feeds = [];
  for (const ch of channelsList) {
    const channelName = decodeHtmlEntities(ch.name || "");
    const baseCountry = (ch.countries && ch.countries[0]) ? ch.countries[0].toUpperCase().trim() : "";

    const chFeeds = ch.feeds || [];
    if (chFeeds.length === 0) continue;

    for (const f of chFeeds) {
      if (!f.embed_url) continue;

      const idMatch = f.embed_url.match(/\/(\d+)$/);
      const channelId = idMatch ? idMatch[1] : "";
      if (!channelId) continue;

      const feedCountry = (f.country || baseCountry || "").toUpperCase().trim();
      const flag = feedCountry ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${feedCountry}.svg` : "";
      const label = decodeHtmlEntities(f.label || channelName);
      const quality = f.quality || ch.quality || "";

      let displayName = label;
      if (quality && !displayName.toLowerCase().includes(quality.toLowerCase())) {
        displayName = `${displayName} [${quality}]`;
      }

      feeds.push({
        name: displayName,
        rawName: label,
        country: feedCountry,
        flag,
        quality,
        channelId,
        embed: f.embed_url,
      });
    }
  }

  // Deduplicate by channelId
  const feedMap = new Map();
  for (const f of feeds) {
    if (!feedMap.has(f.channelId)) {
      feedMap.set(f.channelId, f);
    }
  }

  const result = Array.from(feedMap.values());
  console.log(`Parsed ${result.length} unique feeds from Matchora API.`);
  return result;
}

/**
 * Fallback: Concurrency helper for HTML scraping
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
        results[index] = [];
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fallback: Parse channels from HTML page
 */
function parseChannelsFromHtml(html) {
  const cardRegex = /<article class="channel-card">[\s\S]*?<\/article>/gi;
  let m;
  const list = [];
  while ((m = cardRegex.exec(html)) !== null) {
    const card = m[0];
    const linkMatch = card.match(/href="([^"]*\/play\/([^"]+))"/);
    const countryMatch = card.match(/class="channel-card-country">\s*([^<]+)\s*<\/span>/);
    const flagMatch = card.match(/class="channel-card-flag"[^>]*src="([^"]+)"/);
    const nameMatch = card.match(/class="channel-card-name"[^>]*>\s*([^<]+)\s*<\/a>/);

    if (linkMatch) {
      const slug = linkMatch[2];
      const idMatch = slug.match(/-(\d+)$/);
      if (idMatch) {
        const country = countryMatch ? countryMatch[1].trim().toUpperCase() : "";
        const flag = flagMatch ? flagMatch[1] : (country ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg` : "");
        const rawName = nameMatch ? nameMatch[1].trim() : "";
        list.push({
          name: decodeHtmlEntities(rawName),
          country,
          flag,
          slug,
          channelId: idMatch[1],
          embed: `https://matchora.to/embed/channel/${idMatch[1]}`,
        });
      }
    }
  }
  return list;
}

/**
 * Fallback: Fetch all channels by scraping sports247.ru HTML
 */
async function fetchChannelsFromHtml(cfg) {
  const baseUrl = cfg.sports247Url || "https://en.sports247.ru";
  const userAgent = cfg.userAgent;

  console.log(`Fallback: Fetching Sports247 channels from HTML: ${baseUrl}/channels`);
  const firstRes = await fetch(`${baseUrl}/channels`, {
    headers: { "User-Agent": userAgent },
  });

  if (!firstRes.ok) throw new Error(`HTTP error ${firstRes.status}: ${firstRes.statusText}`);

  const firstHtml = await firstRes.text();
  const firstPageChannels = parseChannelsFromHtml(firstHtml);

  const pageLinks = Array.from(firstHtml.matchAll(/href="[^"]*channels\?page=(\d+)"/gi))
    .map(m => parseInt(m[1], 10))
    .filter(n => !isNaN(n));
  const maxPage = pageLinks.length ? Math.max(...pageLinks) : 46;

  const remainingPages = [];
  for (let p = 2; p <= maxPage; p++) remainingPages.push(p);

  const remainingResults = await mapConcurrent(remainingPages, 10, async (page) => {
    try {
      const res = await fetch(`${baseUrl}/channels?page=${page}`, { headers: { "User-Agent": userAgent } });
      if (!res.ok) return [];
      const html = await res.text();
      return parseChannelsFromHtml(html);
    } catch (e) {
      return [];
    }
  });

  const allChannels = [firstPageChannels, ...remainingResults].flat();
  const channelMap = new Map();
  for (const ch of allChannels) {
    if (!channelMap.has(ch.channelId)) channelMap.set(ch.channelId, ch);
  }
  return Array.from(channelMap.values());
}

/**
 * Fetch all 24/7 channels (API first, fallback to HTML scraping)
 */
async function fetchSports247Channels(cfg) {
  const now = Date.now();
  if (cachedChannels && now - cacheTimestamp < CACHE_TTL) {
    return cachedChannels;
  }

  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      let channels = [];
      try {
        channels = await fetchChannelsFromApi(cfg);
      } catch (apiErr) {
        console.warn(`Matchora channels API failed (${apiErr.message}). Falling back to HTML scraping...`);
        channels = await fetchChannelsFromHtml(cfg);
      }

      cachedChannels = channels;
      cacheTimestamp = Date.now();
      return channels;
    } catch (err) {
      console.error("Error fetching channels:", err.message);
      if (cachedChannels) return cachedChannels;
      return [];
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

/**
 * Generate M3U playlist for /channel4 (Sports247 / Matchora 24/7 TV channels)
 */
async function generateChannel4Playlist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting Sports247 / Matchora /channel4 playlist generation...");

  const channels = await fetchSports247Channels(cfg);
  if (!channels.length) {
    console.log("No channels found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  // Sort channels: Country order -> Channel name A-Z
  channels.sort((a, b) => {
    const cA = getSports247ChannelCountry(a);
    const cB = getSports247ChannelCountry(b);
    if (cA.order !== cB.order) return cA.order - cB.order;
    return (a.name || "").localeCompare(b.name || "");
  });

  let scrapeBase = cfg.sports247ScrapeServiceUrl || cfg.damScrapeServiceUrl || cfg.scrapeServiceUrl;
  if (!scrapeBase.includes("proxy_segments=true")) {
    const join = scrapeBase.includes("?") ? "&" : "?";
    scrapeBase = `${scrapeBase}${join}proxy_segments=true`;
  }
  const separator = scrapeBase.includes("?") ? "&" : "?";

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  for (const ch of channels) {
    const c = getSports247ChannelCountry(ch);
    const groupTitle = `${c.flag} ${c.country}`;
    const displayName = `${ch.name} 📺`;
    const tvgName = (ch.name || "").trim();
    const tvgId = `sports247-${ch.channelId}`;
    const logo = ch.flag || "";
    const scrapeUrl = `${scrapeBase}${separator}url=${encodeURIComponent(ch.embed)}`;

    m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${displayName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  console.log(`Generated Sports247 / Matchora /channel4 playlist with ${channels.length} channels.`);
  return m3uContent;
}

module.exports = {
  COUNTRY_MAP,
  getSports247ChannelCountry,
  fetchSports247Channels,
  generateChannel4Playlist,
};
