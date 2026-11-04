const {
  mergeConfig,
  fetchWithFallback,
  buildCandidateUrls,
  PROVIDER_MIRRORS,
} = require("../utils/helpers");

const COUNTRY_MAP = {
  usa: { country: "United States", flag: "🇺🇸", order: 1 },
  us: { country: "United States", flag: "🇺🇸", order: 1 },
  "united states": { country: "United States", flag: "🇺🇸", order: 1 },
  uk: { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  gb: { country: "United Kingdom", flag: "🇬🇧", order: 2 },
  "united kingdom": { country: "United Kingdom", flag: "🇬🇧", order: 2 },
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
  uruguay: { country: "Uruguay", flag: "🇺🇾", order: 20 },
  qatar: { country: "Qatar", flag: "🇶🇦", order: 21 },
  uae: { country: "United Arab Emirates", flag: "🇦🇪", order: 22 },
  "united arab emirates": { country: "United Arab Emirates", flag: "🇦🇪", order: 22 },
  "saudi arabia": { country: "Saudi Arabia", flag: "🇸🇦", order: 23 },
  mena: { country: "Arabic / MENA", flag: "🌍", order: 24 },
  austria: { country: "Austria", flag: "🇦🇹", order: 25 },
  belgium: { country: "Belgium", flag: "🇧🇪", order: 26 },
  bulgaria: { country: "Bulgaria", flag: "🇧🇬", order: 27 },
  romania: { country: "Romania", flag: "🇷🇴", order: 28 },
  serbia: { country: "Serbia", flag: "🇷🇸", order: 29 },
  croatia: { country: "Croatia", flag: "🇭🇷", order: 30 },
  "bosnia and herzegovina": { country: "Bosnia and Herzegovina", flag: "🇧🇦", order: 31 },
  "czech republic": { country: "Czech Republic", flag: "🇨🇿", order: 32 },
  slovakia: { country: "Slovakia", flag: "🇸🇰", order: 33 },
  hungary: { country: "Hungary", flag: "🇭🇺", order: 34 },
  sweden: { country: "Sweden", flag: "🇸🇪", order: 35 },
  denmark: { country: "Denmark", flag: "🇩🇰", order: 36 },
  finland: { country: "Finland", flag: "🇫🇮", order: 37 },
  russia: { country: "Russia", flag: "🇷🇺", order: 38 },
  ireland: { country: "Ireland", flag: "🇮🇪", order: 39 },
  cyprus: { country: "Cyprus", flag: "🇨🇾", order: 40 },
  india: { country: "India", flag: "🇮🇳", order: 41 },
  pakistan: { country: "Pakistan", flag: "🇵🇰", order: 42 },
  bangladesh: { country: "Bangladesh", flag: "🇧🇩", order: 43 },
  malaysia: { country: "Malaysia", flag: "🇲🇾", order: 44 },
  israel: { country: "Israel", flag: "🇮🇱", order: 45 },
  "south africa": { country: "South Africa", flag: "🇿🇦", order: 46 },
  africa: { country: "Africa", flag: "🌍", order: 47 },
  latin_america: { country: "Latin America", flag: "🌎", order: 48 },
  international: { country: "International", flag: "🌐", order: 49 },
  others: { country: "Others", flag: "📺", order: 50 },
};

function getVidcdnChannelCountry(ch) {
  if (ch.country && ch.country.toLowerCase() !== "unknown") {
    const key = ch.country.toLowerCase().trim();
    if (COUNTRY_MAP[key]) return COUNTRY_MAP[key];
  }

  const name = (ch.name || "").trim();
  if (/^MLB\b/i.test(name)) return COUNTRY_MAP.usa;
  if (/\bAU\b|Stan Sport/i.test(name)) return COUNTRY_MAP.australia;
  if (/\bFR\b|France/i.test(name)) return COUNTRY_MAP.france;
  if (/\bES\b|Movistar|LaLiga|La Liga/i.test(name)) return COUNTRY_MAP.spain;
  if (/\bPL\b|Polsat|Eleven/i.test(name)) return COUNTRY_MAP.poland;
  if (/\bARG\b|Argentina/i.test(name)) return COUNTRY_MAP.argentina;
  if (/Starz Play|VIP beIN|MENA/i.test(name)) return COUNTRY_MAP.mena;
  if (/LAM\b/i.test(name)) return COUNTRY_MAP.latin_america;
  if (/Sky Sports|TNT Sports|BBC/i.test(name)) return COUNTRY_MAP.uk;

  return COUNTRY_MAP.others;
}

/**
 * Fetch 24/7 channels from vidcdn.vip API with multi-mirror fallback
 */
async function fetchVidcdnChannelsList(cfg) {
  try {
    const apiUrl = cfg.vidcdnChannelsUrl || "https://vidcdn.vip/api/channels";
    const urls = buildCandidateUrls(apiUrl, PROVIDER_MIRRORS.vidcdn);
    console.log(`Fetching VidCDN channels (primary: ${apiUrl}, candidates: ${urls.length})`);

    const data = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
      },
    });

    const channels = Array.isArray(data) ? data : (data.channels || []);
    const validChannels = [];

    for (const ch of channels) {
      if (ch.status && ch.status === "offline") continue;
      if (!ch.id) continue;
      validChannels.push(ch);
    }

    console.log(`Fetched ${validChannels.length} valid 24/7 channels from VidCDN.`);
    return validChannels;
  } catch (error) {
    console.error("Error fetching VidCDN channels:", error.message);
    throw new Error(`VidCDN channels fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for /channel3 (VidCDN 24/7 TV channels)
 */
async function generateVidcdnPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting VidCDN /channel3 playlist generation...");
  const channels = await fetchVidcdnChannelsList(cfg);

  if (!channels.length) {
    console.log("No VidCDN channels found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  // Sắp xếp kênh theo Quốc gia -> Thể thao lên đầu -> Tên kênh A-Z
  channels.sort((a, b) => {
    const cA = getVidcdnChannelCountry(a);
    const cB = getVidcdnChannelCountry(b);
    if (cA.order !== cB.order) return cA.order - cB.order;

    const isSportsA = a.category === "Sports" || /^MLB\b|Sport|ESPN|DAZN|Liga|Football|Racing|Golf|Tennis|Basketball/i.test(a.name || "") ? 0 : 1;
    const isSportsB = b.category === "Sports" || /^MLB\b|Sport|ESPN|DAZN|Liga|Football|Racing|Golf|Tennis|Basketball/i.test(b.name || "") ? 0 : 1;
    if (isSportsA !== isSportsB) return isSportsA - isSportsB;

    return (a.name || "").localeCompare(b.name || "");
  });

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  let scrapeBase = cfg.cineScrapeServiceUrl || cfg.scrapeServiceUrl;
  if (!scrapeBase.includes("proxy_segments=true")) {
    const join = scrapeBase.includes("?") ? "&" : "?";
    scrapeBase = `${scrapeBase}${join}proxy_segments=true`;
  }
  const separator = scrapeBase.includes("?") ? "&" : "?";
  const embedBase = cfg.cineEmbedChannelBaseUrl || "https://cinevid.st/embed/channel";

  for (const ch of channels) {
    const embedUrl = `${embedBase}/${ch.id}`;
    const displayName = `${ch.name} 📺`;
    const tvgName = (ch.name || "").trim();
    const tvgId = ch.slug || ch.id;
    const c = getVidcdnChannelCountry(ch);
    const groupTitle = `${c.flag} ${c.country}`;
    const logo = ch.logo ? (ch.logo.startsWith("http") ? ch.logo : `https://vidcdn.vip${ch.logo}`) : "";
    const scrapeUrl = `${scrapeBase}${separator}url=${encodeURIComponent(embedUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${displayName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  COUNTRY_MAP,
  getVidcdnChannelCountry,
  fetchVidcdnChannelsList,
  fetchChannel3List: fetchVidcdnChannelsList,
  generateVidcdnPlaylist,
  generateChannel3Playlist: generateVidcdnPlaylist,
};
