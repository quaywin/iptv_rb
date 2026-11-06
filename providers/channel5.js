const {
  mergeConfig,
  fetchWithFallback,
  buildCandidateUrls,
  PROVIDER_MIRRORS,
} = require("../utils/helpers");

const COUNTRY_MAP = {
  US: { country: "United States", flag: "🇺🇸", order: 1, code: "US" },
  USA: { country: "United States", flag: "🇺🇸", order: 1, code: "US" },
  UK: { country: "United Kingdom", flag: "🇬🇧", order: 2, code: "GB" },
  GB: { country: "United Kingdom", flag: "🇬🇧", order: 2, code: "GB" },
  ES: { country: "Spain", flag: "🇪🇸", order: 3, code: "ES" },
  IT: { country: "Italy", flag: "🇮🇹", order: 4, code: "IT" },
  FR: { country: "France", flag: "🇫🇷", order: 5, code: "FR" },
  DE: { country: "Germany", flag: "🇩🇪", order: 6, code: "DE" },
  CA: { country: "Canada", flag: "🇨🇦", order: 7, code: "CA" },
  PT: { country: "Portugal", flag: "🇵🇹", order: 8, code: "PT" },
  NL: { country: "Netherlands", flag: "🇳🇱", order: 9, code: "NL" },
  BE: { country: "Belgium", flag: "🇧🇪", order: 10, code: "BE" },
  TR: { country: "Turkey", flag: "🇹🇷", order: 11, code: "TR" },
  PL: { country: "Poland", flag: "🇵🇱", order: 12, code: "PL" },
  BR: { country: "Brazil", flag: "🇧🇷", order: 13, code: "BR" },
  AR: { country: "Argentina", flag: "🇦🇷", order: 14, code: "AR" },
  ARG: { country: "Argentina", flag: "🇦🇷", order: 14, code: "AR" },
  AU: { country: "Australia", flag: "🇦🇺", order: 15, code: "AU" },
  NZ: { country: "New Zealand", flag: "🇳🇿", order: 16, code: "NZ" },
  GR: { country: "Greece", flag: "🇬🇷", order: 17, code: "GR" },
  RO: { country: "Romania", flag: "🇷🇴", order: 18, code: "RO" },
  BG: { country: "Bulgaria", flag: "🇧🇬", order: 19, code: "BG" },
  RU: { country: "Russia", flag: "🇷🇺", order: 20, code: "RU" },
  DK: { country: "Denmark", flag: "🇩🇰", order: 21, code: "DK" },
  SE: { country: "Sweden", flag: "🇸🇪", order: 22, code: "SE" },
  FI: { country: "Finland", flag: "🇫🇮", order: 23, code: "FI" },
  NO: { country: "Norway", flag: "🇳🇴", order: 24, code: "NO" },
  AT: { country: "Austria", flag: "🇦🇹", order: 25, code: "AT" },
  CH: { country: "Switzerland", flag: "🇨🇭", order: 26, code: "CH" },
  IL: { country: "Israel", flag: "🇮🇱", order: 27, code: "IL" },
  CY: { country: "Cyprus", flag: "🇨🇾", order: 28, code: "CY" },
  MX: { country: "Mexico", flag: "🇲🇽", order: 29, code: "MX" },
  UY: { country: "Uruguay", flag: "🇺🇾", order: 30, code: "UY" },
  CL: { country: "Chile", flag: "🇨🇱", order: 31, code: "CL" },
  CO: { country: "Colombia", flag: "🇨🇴", order: 32, code: "CO" },
  QA: { country: "Qatar / beIN", flag: "🇶🇦", order: 33, code: "QA" },
  AE: { country: "United Arab Emirates", flag: "🇦🇪", order: 34, code: "AE" },
  SA: { country: "Saudi Arabia", flag: "🇸🇦", order: 35, code: "SA" },
  MENA: { country: "Arabic / MENA", flag: "🌍", order: 36, code: "" },
  MY: { country: "Malaysia", flag: "🇲🇾", order: 37, code: "MY" },
  IN: { country: "India", flag: "🇮🇳", order: 38, code: "IN" },
  PK: { country: "Pakistan", flag: "🇵🇰", order: 39, code: "PK" },
  ZA: { country: "South Africa", flag: "🇿🇦", order: 40, code: "ZA" },
  OTHER: { country: "International", flag: "🌐", order: 99, code: "" },
};

/**
 * Detect country for a CDN Live TV channel
 */
function getCdnChannelCountry(ch) {
  if (ch.code) {
    const c = ch.code.toUpperCase().trim();
    if (COUNTRY_MAP[c]) return COUNTRY_MAP[c];
  }

  const rawName = (ch.name || "").trim();
  // Strip trailing bracket tags like [Multi-Audio] before matching suffixes
  const name = rawName.replace(/\[.*?\]/g, "").trim();

  // 1. Suffix matching (e.g. "Canal 9 HD DK" -> "DK", "ESPN FHD ARG" -> "ARG")
  const suffixMatch = name.match(/\b([A-Za-z]{2,3})\s*$/);
  if (suffixMatch) {
    const code = suffixMatch[1].toUpperCase();
    if (COUNTRY_MAP[code]) return COUNTRY_MAP[code];
  }

  // 2. Keyword / heuristics matching
  if (/^MLB\b/i.test(name)) return COUNTRY_MAP.US;
  if (/\bAU\b|Stan Sport/i.test(name)) return COUNTRY_MAP.AU;
  if (/\bARG\b|Argentina/i.test(name)) return COUNTRY_MAP.ARG;
  if (/beIN SPORTS|VIP beIN/i.test(name)) return COUNTRY_MAP.QA;
  if (/Starz Play/i.test(name)) return COUNTRY_MAP.MENA;
  if (/Abu Dhabi/i.test(name)) return COUNTRY_MAP.AE;
  if (/Movistar|Teledeporte|DAZN La Liga|DAZN F1/i.test(name)) return COUNTRY_MAP.ES;
  if (/ASTRO/i.test(name)) return COUNTRY_MAP.MY;
  if (/Sky Sports|TNT Sports|BBC/i.test(name)) return COUNTRY_MAP.UK;

  return COUNTRY_MAP.OTHER;
}

/**
 * Fetch 24/7 channels from CDN Live TV API (https://cdnlivetv.tv/)
 */
async function fetchCdnChannelsList(cfg) {
  try {
    const apiUrl = cfg.cdnChannelsUrl || "https://api.cdnlivetv.tv/api/v1/channels/?user=cdnlivetv&plan=free";
    const mirrors = PROVIDER_MIRRORS.cdnlivetv || ["https://api.cdnlivetv.tv", "https://cdnlivetv.tv"];
    const urls = buildCandidateUrls(apiUrl, mirrors);
    console.log(`Fetching CDN Live TV channels (primary: ${apiUrl}, candidates: ${urls.length})`);

    const data = await fetchWithFallback(urls, {
      timeoutMs: cfg.timeout || 6000,
      headers: {
        "User-Agent": cfg.userAgent,
        "Accept": "application/json",
      },
    });

    const channels = Array.isArray(data) ? data : (data.channels || []);
    const validChannels = [];

    for (const ch of channels) {
      if (!ch || !ch.name) continue;
      // Filter offline channels unless explicitly configured
      if (!cfg.cdnIncludeOffline && ch.status && ch.status.toLowerCase() === "offline") {
        continue;
      }
      validChannels.push(ch);
    }

    console.log(`Fetched ${validChannels.length} valid 24/7 channels from CDN Live TV (out of ${channels.length}).`);
    return validChannels;
  } catch (error) {
    console.error("Error fetching CDN Live TV channels:", error.message);
    throw new Error(`CDN Live TV channels fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for /channel5 & /cdn (CDN Live TV 24/7 TV channels)
 */
async function generateCdnPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting CDN Live TV /channel5 (/cdn) playlist generation...");
  const channels = await fetchCdnChannelsList(cfg);

  if (!channels.length) {
    console.log("No CDN Live TV channels found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  // Sắp xếp kênh theo Quốc gia -> Thể thao lên đầu -> Tên kênh A-Z
  channels.sort((a, b) => {
    const cA = getCdnChannelCountry(a);
    const cB = getCdnChannelCountry(b);
    if (cA.order !== cB.order) return cA.order - cB.order;

    const isSportsA = /^MLB\b|Sport|ESPN|DAZN|Liga|Football|Racing|Golf|Tennis|Basketball|WWE|Combat|Fight|Canal|Arena|TSN|Sky/i.test(a.name || "") ? 0 : 1;
    const isSportsB = /^MLB\b|Sport|ESPN|DAZN|Liga|Football|Racing|Golf|Tennis|Basketball|WWE|Combat|Fight|Canal|Arena|TSN|Sky/i.test(b.name || "") ? 0 : 1;
    if (isSportsA !== isSportsB) return isSportsA - isSportsB;

    return (a.name || "").localeCompare(b.name || "");
  });

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  let scrapeBase = cfg.cdnScrapeServiceUrl || cfg.sports247ScrapeServiceUrl || cfg.damScrapeServiceUrl || cfg.scrapeServiceUrl;
  if (!scrapeBase.includes("proxy_segments=true")) {
    const join = scrapeBase.includes("?") ? "&" : "?";
    scrapeBase = `${scrapeBase}${join}proxy_segments=true`;
  }
  const separator = scrapeBase.includes("?") ? "&" : "?";

  for (const ch of channels) {
    const embedUrl = ch.url || `https://cdnlivetv.tv/api/v1/channels/player/?name=${encodeURIComponent(ch.name)}&code=${encodeURIComponent(ch.code || "")}&user=cdnlivetv&plan=free`;
    const displayName = `${ch.name} 📺`;
    const tvgName = (ch.name || "").trim();
    const slug = ch.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const tvgId = `cdn-${slug}`;
    const c = getCdnChannelCountry(ch);
    const groupTitle = `${c.flag} ${c.country}`;
    const logo = ch.image || (c.code ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${c.code}.svg` : "");
    const scrapeUrl = `${scrapeBase}${separator}url=${encodeURIComponent(embedUrl)}`;

    m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${displayName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  console.log(`Generated CDN Live TV playlist with ${channels.length} channels.`);
  return m3uContent;
}

module.exports = {
  COUNTRY_MAP,
  getCdnChannelCountry,
  fetchCdnChannelsList,
  fetchChannel5List: fetchCdnChannelsList,
  generateCdnPlaylist,
  generateChannel5Playlist: generateCdnPlaylist,
};
