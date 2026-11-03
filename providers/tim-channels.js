const { mergeConfig } = require("../utils/helpers");
const { getTimChannelEpgId, getTimChannelLogo } = require("../utils/epg-tim");

// Helper to detect country and flag for 24/7 channels
function getChannelCountry(ch) {
  const name = (ch.name || "").trim();
  const flag = ch.flag ? ch.flag.toLowerCase() : "";

  if (flag === "gb") return { country: "United Kingdom", flag: "🇬🇧", order: 2 };

  if (/Francais/i.test(name)) return { country: "France", flag: "🇫🇷", order: 3 };
  if (/Germany|Bundesliga|SPORTDIGITAL/i.test(name)) return { country: "Germany", flag: "🇩🇪", order: 4 };
  if (/Spain|LaLiga|Movistar|DAZN F1/i.test(name)) return { country: "Spain", flag: "🇪🇸", order: 5 };
  if (/Italia|\bIT\b|Calcio|Sky Sport 24|Sky Sport Uno/i.test(name)) return { country: "Italy", flag: "🇮🇹", order: 6 };
  if (/Portugal|Sport TV\d/i.test(name)) return { country: "Portugal", flag: "🇵🇹", order: 7 };
  if (/PL\b|Polsat|Eleven Sports|CANAL\+ (?:Extra|Sport.*PL)/i.test(name)) return { country: "Poland", flag: "🇵🇱", order: 8 };
  if (/Fox Sports 50\d/i.test(name)) return { country: "Australia", flag: "🇦🇺", order: 9 };
  if (/\bNZ\b/i.test(name)) return { country: "New Zealand", flag: "🇳🇿", order: 10 };
  if (/TSN\d/i.test(name)) return { country: "Canada", flag: "🇨🇦", order: 11 };
  if (/\bIE\b|Premier Sports.*IE/i.test(name)) return { country: "Ireland", flag: "🇮🇪", order: 12 };
  if (/Singapore|Hub Sports/i.test(name)) return { country: "Singapore", flag: "🇸🇬", order: 13 };
  if (/Sony Sports|ZEE CAFÉ|Unite8/i.test(name)) return { country: "India", flag: "🇮🇳", order: 14 };
  if (/MENA/i.test(name)) return { country: "Arabic / MENA", flag: "🇶🇦", order: 15 };
  if (/TYC Sports|Premiere/i.test(name)) return { country: "Latin America", flag: "🌎", order: 16 };
  if (/Go3 Sport/i.test(name)) return { country: "Baltics", flag: "🇱🇻", order: 17 };
  if (/BiH|ARENA SPORT/i.test(name)) return { country: "Balkans", flag: "🇧🇦", order: 18 };

  if (/^BBC\b|CBeebies|Sky Sports|TNT Sports|^Sky (?:Arts|Atlantic|Comedy|Crime|Documentaries|Kids|Nature|News|One|Sci-Fi|Witness)/i.test(name)) {
    return { country: "United Kingdom", flag: "🇬🇧", order: 2 };
  }

  return { country: "United States", flag: "🇺🇸", order: 1 };
}

/**
 * Fetch 24/7 channels from tim-streams.com API
 */
async function fetchTimChannelsList(cfg) {
  try {
    console.log(`Fetching TimChannels from: ${cfg.timChannelsUrl}`);
    const response = await fetch(cfg.timChannelsUrl, {
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
      const streamUrl = ch.streams?.[0]?.url;
      if (!streamUrl) continue;
      validChannels.push(ch);
    }

    console.log(`Fetched ${validChannels.length} valid 24/7 channels from TimStreams.`);
    return validChannels;
  } catch (error) {
    console.error("Error fetching TimChannels:", error.message);
    throw new Error(`TimChannels fetch failed: ${error.message}`);
  }
}

/**
 * Generate M3U playlist for Tim 24/7 Channels
 */
async function generateTimChannelsPlaylist(customConfig = {}) {
  const cfg = mergeConfig(customConfig);
  console.log("Starting TimChannels playlist generation...");
  const channels = await fetchTimChannelsList(cfg);

  if (!channels.length) {
    console.log("No TimStreams channels found.");
    return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  }

  // Sắp xếp kênh theo Quốc gia ưu tiên -> Thể thao lên đầu -> Tên kênh A-Z
  channels.sort((a, b) => {
    const cA = getChannelCountry(a);
    const cB = getChannelCountry(b);
    if (cA.order !== cB.order) return cA.order - cB.order;
    const isSportsA = a.genre === 2 ? 0 : 1;
    const isSportsB = b.genre === 2 ? 0 : 1;
    if (isSportsA !== isSportsB) return isSportsA - isSportsB;
    return (a.name || "").localeCompare(b.name || "");
  });

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";
  const separator = cfg.scrapeServiceUrl.includes("?") ? "&" : "?";

  for (const ch of channels) {
    const streamUrl = ch.streams[0].url;
    const displayName = `${ch.name} 📺`;
    const tvgName = (ch.name || "").trim();
    const tvgId = getTimChannelEpgId(ch);
    const tvgIdAttr = tvgId ? `tvg-id="${tvgId}" ` : "";
    const c = getChannelCountry(ch);
    const groupTitle = `${c.flag} ${c.country}`;
    const logo = getTimChannelLogo(ch);
    const scrapeUrl = `${cfg.scrapeServiceUrl}${separator}url=${encodeURIComponent(streamUrl)}`;

    m3uContent += `#EXTINF:-1 ${tvgIdAttr}tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${displayName}\n`;
    m3uContent += `${scrapeUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = {
  getChannelCountry,
  fetchTimChannelsList,
  generateTimChannelsPlaylist,
};
