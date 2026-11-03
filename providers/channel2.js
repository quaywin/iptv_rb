const { mergeConfig } = require("../utils/helpers");
const { getSportsbiteChannelEpgId, getSportsbiteChannelLogo } = require("../utils/epg-channel2");

const COUNTRY_MAP = {
  usa: { country: "United States", flag: "🇺🇸", order: 1 },
  us: { country: "United States", flag: "🇺🇸", order: 1 },
  "united kingdom": { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  uk: { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  gb: { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  france: { country: "France", flag: "🇫🇷", order: 3 },
  germany: { country: "Germany", flag: "🇩🇪", order: 4 },
  spain: { country: "Spain", flag: "🇪🇸", order: 5 },
  italy: { country: "Italy", flag: "🇮🇹", order: 6 },
  portugal: { country: "Portugal", flag: "🇵🇹", order: 7 },
  netherlands: { country: "Netherlands", flag: "🇳🇱", order: 8 },
  greece: { country: "Greece", flag: "🇬🇷", order: 9 },
  turkey: { country: "Turkey", flag: "🇹🇷", order: 10 },
  poland: { country: "Poland", flag: "🇵🇱", order: 11 },
  canada: { country: "Canada", flag: "🇨🇦", order: 12 },
  australia: { country: "Australia", flag: "🇦🇺", order: 13 },
  "new zealand": { country: "New Zealand", flag: "🇳🇿", order: 14 },
  brazil: { country: "Brazil", flag: "🇧🇷", order: 15 },
  argentina: { country: "Argentina", flag: "🇦🇷", order: 16 },
  mexico: { country: "Mexico", flag: "🇲🇽", order: 17 },
  chile: { country: "Chile", flag: "🇨🇱", order: 18 },
  colombia: { country: "Colombia", flag: "🇨🇴", order: 19 },
  qatar: { country: "Qatar", flag: "🇶🇦", order: 20 },
  "united arab emirates": { country: "United Arab Emirates", flag: "🇦🇪", order: 21 },
  uae: { country: "United Arab Emirates", flag: "🇦🇪", order: 21 },
  "saudi arabia": { country: "Saudi Arabia", flag: "🇸🇦", order: 22 },
  mena: { country: "Arabic / MENA", flag: "🌍", order: 23 },
  austria: { country: "Austria", flag: "🇦🇹", order: 24 },
  bulgaria: { country: "Bulgaria", flag: "🇧🇬", order: 25 },
  romania: { country: "Romania", flag: "🇷🇴", order: 26 },
  serbia: { country: "Serbia", flag: "🇷🇸", order: 27 },
  croatia: { country: "Croatia", flag: "🇭🇷", order: 28 },
  "bosnia and herzegovina": { country: "Bosnia and Herzegovina", flag: "🇧🇦", order: 29 },
  albania: { country: "Albania", flag: "🇦🇱", order: 30 },
  kosovo: { country: "Kosovo", flag: "🇽🇰", order: 31 },
  "czech republic": { country: "Czech Republic", flag: "🇨🇿", order: 32 },
  slovakia: { country: "Slovakia", flag: "🇸🇰", order: 33 },
  hungary: { country: "Hungary", flag: "🇭🇺", order: 34 },
  sweden: { country: "Sweden", flag: "🇸🇪", order: 35 },
  norway: { country: "Norway", flag: "🇳🇴", order: 36 },
  denmark: { country: "Denmark", flag: "🇩🇰", order: 37 },
  russia: { country: "Russia", flag: "🇷🇺", order: 38 },
  ireland: { country: "Ireland", flag: "🇮🇪", order: 39 },
  cyprus: { country: "Cyprus", flag: "🇨🇾", order: 40 },
  "south korea": { country: "South Korea", flag: "🇰🇷", order: 41 },
  malaysia: { country: "Malaysia", flag: "🇲🇾", order: 42 },
  india: { country: "India", flag: "🇮🇳", order: 43 },
  pakistan: { country: "Pakistan", flag: "🇵🇰", order: 44 },
  israel: { country: "Israel", flag: "🇮🇱", order: 45 },
  "south africa": { country: "South Africa", flag: "🇿🇦", order: 46 },
  international: { country: "International", flag: "🌐", order: 47 },
};

function getSportsbiteChannelCountry(ch) {
  if (ch.country) {
    const key = ch.country.toLowerCase().trim();
    if (COUNTRY_MAP[key]) return COUNTRY_MAP[key];
  }

  const name = (ch.name || "").trim();
  if (/MENA/i.test(name)) return COUNTRY_MAP["mena"];
  if (/CANAL\+ Extra|Polsat|Eleven Sports/i.test(name)) return COUNTRY_MAP["poland"];
  if (/CANAL\+/i.test(name)) return COUNTRY_MAP["france"];
  if (/Sky Sports|TNT Sports|BBC/i.test(name)) return COUNTRY_MAP["united kingdom"];
  if (/SuperSport/i.test(name)) return COUNTRY_MAP["south africa"];
  if (/Optus Sport/i.test(name)) return COUNTRY_MAP["australia"];
  if (/TSN|Sportsnet/i.test(name)) return COUNTRY_MAP["canada"];
  if (/DAZN/i.test(name)) return COUNTRY_MAP["international"];

  return COUNTRY_MAP["international"];
}

/**
 * Fetch 24/7 channels from SportsBite API
 */
async function fetchSportsbiteChannels(cfg) {
  try {
    const apiUrl = cfg.sportsbiteChannelsUrl || "https://sportsbite.org/api/forestgump/channels";
    console.log(`Fetching SportsBite channels from: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": cfg.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const channels = data.channels || [];
    const validChannels = [];

    for (const ch of channels) {
      if (ch.status && ch.status === "offline") continue;
      const targetUrl = ch.embed_url || ch.manifest_url || ch.iframe_url;
      if (!targetUrl) continue;
      validChannels.push(ch);
    }

    console.log(`Fetched ${validChannels.length} valid 24/7 channels from SportsBite.`);
    return validChannels;
  } catch (error) {
    console.error("Error fetching SportsBite channels:", error.message);
    throw new Error(`SportsBite channels fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for /channel2 (SportsBite 24/7 channels)
 */
async function generateSportsbitePlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting SportsBite /channel2 playlist generation...");
  const channels = await fetchSportsbiteChannels(cfg);

  if (!channels.length) {
    console.log("No SportsBite channels found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  // Sắp xếp kênh theo Quốc gia -> Thể thao lên đầu -> Tên kênh A-Z
  channels.sort((a, b) => {
    const cA = getSportsbiteChannelCountry(a);
    const cB = getSportsbiteChannelCountry(b);
    if (cA.order !== cB.order) return cA.order - cB.order;
    const isSportsA = a.category === "Sports" ? 0 : 1;
    const isSportsB = b.category === "Sports" ? 0 : 1;
    if (isSportsA !== isSportsB) return isSportsA - isSportsB;
    return (a.name || "").localeCompare(b.name || "");
  });

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  const separator = cfg.scrapeServiceUrl.includes("?") ? "&" : "?";

  for (const ch of channels) {
    const embedUrl = ch.embed_url || ch.manifest_url || ch.iframe_url;
    const displayName = `${ch.name} 📺`;
    const tvgName = (ch.name || "").trim();
    const tvgId = getSportsbiteChannelEpgId(ch);
    const tvgIdAttr = tvgId ? `tvg-id="${tvgId}" ` : "";
    const c = getSportsbiteChannelCountry(ch);
    const groupTitle = `${c.flag} ${c.country}`;
    const logo = getSportsbiteChannelLogo(ch);
    const scrapeUrl = `${cfg.scrapeServiceUrl}${separator}url=${encodeURIComponent(embedUrl)}`;

    m3uContent += `#EXTINF:-1 ${tvgIdAttr}tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${displayName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  getSportsbiteChannelCountry,
  fetchSportsbiteChannels,
  generateSportsbitePlaylist,
  generateChannel2Playlist: generateSportsbitePlaylist,
};
