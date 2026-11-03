const config = require("../config");

// Format time and date in configured timezone (default: Asia/Ho_Chi_Minh)
function formatTime(timestamp, timezone = config.timezone) {
  if (!timestamp) return "";
  const d = new Date(timestamp * 1000);
  const timeZone = timezone || "Asia/Ho_Chi_Minh";
  const timeStr = d.toLocaleTimeString("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const dateStr = d.toLocaleDateString("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit"
  });
  return `${timeStr} ${dateStr}`;
}

// Sport icon mapping
const SPORT_ICONS = {
  soccer: "⚽",
  football: "🏈",
  basketball: "🏀",
  hockey: "🏒",
  combat: "🥊",
  fighting: "🥊",
  baseball: "⚾",
  racing: "🏎️",
  motorsport: "🏎️",
  "formula one/two/three": "🏎️",
  f1: "🏎️",
  "formula-1": "🏎️",
  "formula 1": "🏎️",
  "formula-2": "🏎️",
  "formula 2": "🏎️",
  "formula-3": "🏎️",
  "formula 3": "🏎️",
  motogp: "🏎️",
  moto2: "🏎️",
  moto3: "🏎️",
  nascar: "🏎️",
  "nascar-cup-series": "🏎️",
  "nascar-oreilly-auto-parts-series": "🏎️",
  "nascar-craftsman-trucks-series": "🏎️",
  wrc: "🏎️",
  "world-rally-championship": "🏎️",
  mxgp: "🏍️",
  "fim-motocross-world-championship": "🏍️",
  "australian-supercars-championship": "🏎️",
  supercars: "🏎️",
  nba: "🏀",
  nfl: "🏈",
  nhl: "🏒",
  mlb: "⚾",
  ufc: "🥊",
  mma: "🥊",
  tennis: "🎾",
  cricket: "🏏",
  darts: "🎯",
  cycling: "🚴",
  wrestling: "🤼",
  "professional wrestling": "🤼",
  "american football": "🏈",
  "australian football": "🏉",
  "ice hockey": "🏒",
  "motorsports": "🏎️",
  "golf": "⛳",
  "rugby": "🏉",
  "volleyball": "🏐",
  "badminton": "🏸",
  "snooker": "🎱",
  "table tennis": "🏓",
  "handball": "🤾",
  "24/7 streams": "📺",
  "live shows": "📺",
};

function getSportIcon(category, provider = "strm") {
  if (!category) return "🏆";
  const key = category.toLowerCase().trim();
  if ((provider === "ppv" || provider === "gk" || provider === "cine" || provider === "cinevid") && key === "football") {
    return "⚽"; // In PPV.st, GK/ReedStreams & Cinevid, "Football" is European Football (Soccer)
  }
  return SPORT_ICONS[key] || "🏆";
}

// Parse TimStreams timestamp (America/New_York) to Unix timestamp (seconds)
function parseTimTime(timeStr) {
  if (!timeStr) return null;
  if (typeof timeStr === "number") return timeStr;

  const m = String(timeStr).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
  }

  const [, year, month, day, hour, min, sec] = m;
  const dummyUtc = new Date(Date.UTC(+year, +month - 1, +day, +hour, +min, +(sec || 0)));

  const nyFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = nyFormatter.formatToParts(dummyUtc).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  const h = parts.hour === "24" ? 0 : +parts.hour;
  const nyAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, +parts.minute, +parts.second);
  const offset = nyAsUtc - dummyUtc.getTime();

  const realUtcMs = dummyUtc.getTime() - offset;
  return Math.floor(realUtcMs / 1000);
}

// Parse Cinevid date & time (UTC) to Unix timestamp (seconds)
function parseCineTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const timeFormatted = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const isoStr = `${dateStr}T${timeFormatted}Z`;
  const ms = Date.parse(isoStr);
  return isNaN(ms) ? null : Math.floor(ms / 1000);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ESPN official league logos mapping (500x500 PNG)
const LEAGUE_LOGOS = {
  // Football / Soccer
  "premier league": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
  "english premier league": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
  "epl": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
  "championship": "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png",
  "english league championship": "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png",
  "english championship": "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png",
  "league one": "https://a.espncdn.com/i/leaguelogos/soccer/500/25.png",
  "english league one": "https://a.espncdn.com/i/leaguelogos/soccer/500/25.png",
  "league two": "https://a.espncdn.com/i/leaguelogos/soccer/500/26.png",
  "english league two": "https://a.espncdn.com/i/leaguelogos/soccer/500/26.png",
  "champions league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  "uefa champions league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  "ucl": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  "europa league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png",
  "uefa europa league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png",
  "uel": "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png",
  "conference league": "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png",
  "uefa conference league": "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png",
  "uefa nations league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2395.png",
  "nations league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2395.png",
  "uefa european championship": "https://a.espncdn.com/i/leaguelogos/soccer/500/74.png",
  "euro": "https://a.espncdn.com/i/leaguelogos/soccer/500/74.png",
  "la liga": "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
  "laliga": "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
  "spanish laliga": "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
  "serie a": "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
  "italian serie a": "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
  "bundesliga": "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
  "german bundesliga": "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
  "ligue 1": "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
  "french ligue 1": "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
  "eredivisie": "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png",
  "dutch eredivisie": "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png",
  "portuguese primeira liga": "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png",
  "primeira liga": "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png",
  "liga portugal": "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png",
  "scottish premiership": "https://a.espncdn.com/i/leaguelogos/soccer/500/45.png",
  "turkish super lig": "https://a.espncdn.com/i/leaguelogos/soccer/500/18.png",
  "super lig": "https://a.espncdn.com/i/leaguelogos/soccer/500/18.png",
  "belgian pro league": "https://a.espncdn.com/i/leaguelogos/soccer/500/6.png",
  "pro league": "https://a.espncdn.com/i/leaguelogos/soccer/500/6.png",
  "allsvenskan": "https://a.espncdn.com/i/leaguelogos/soccer/500/16.png",
  "swedish allsvenskan": "https://a.espncdn.com/i/leaguelogos/soccer/500/16.png",
  "mls": "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png",
  "major league soccer": "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png",
  "liga mx": "https://a.espncdn.com/i/leaguelogos/soccer/500/22.png",
  "mexican liga bbva mx": "https://a.espncdn.com/i/leaguelogos/soccer/500/22.png",
  "brazilian serie a": "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png",
  "brasileirao": "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png",
  "argentine liga profesional": "https://a.espncdn.com/i/leaguelogos/soccer/500/1.png",
  "copa libertadores": "https://a.espncdn.com/i/leaguelogos/soccer/500/58.png",
  "conmebol libertadores": "https://a.espncdn.com/i/leaguelogos/soccer/500/58.png",
  "copa sudamericana": "https://a.espncdn.com/i/leaguelogos/soccer/500/1208.png",
  "conmebol sudamericana": "https://a.espncdn.com/i/leaguelogos/soccer/500/1208.png",
  "concacaf champions cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/2298.png",
  "afc champions league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2200.png",
  "j.league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2199.png",
  "j-league": "https://a.espncdn.com/i/leaguelogos/soccer/500/2199.png",
  "fa cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/40.png",
  "english fa cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/40.png",
  "carabao cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/41.png",
  "efl cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/41.png",
  "copa del rey": "https://a.espncdn.com/i/leaguelogos/soccer/500/80.png",
  "coppa italia": "https://a.espncdn.com/i/leaguelogos/soccer/500/2192.png",
  "fifa world cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
  "world cup": "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
  "soccer": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
  "football": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",

  // Basketball
  "nba": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  "wnba": "https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png",
  "college basketball": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_MensBasketball.png",
  "ncaa basketball": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_MensBasketball.png",
  "ncaa men's basketball": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_MensBasketball.png",
  "men's college basketball": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_MensBasketball.png",
  "women's college basketball": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_MensBasketball.png",
  "euroleague": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  "basketball": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",

  // American Football
  "nfl": "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
  "national football league": "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",
  "college football": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_Football.png",
  "ncaa football": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_Football.png",
  "ncaa college football": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_Football.png",
  "cfl": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_Football.png",
  "canadian football": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_Football.png",
  "canadian football league": "https://a.espncdn.com/redesign/assets/img/icons/NCAASports_Football.png",
  "american football": "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png",

  // Hockey
  "nhl": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
  "national hockey league": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
  "hockey": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
  "ice hockey": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",

  // Baseball
  "mlb": "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  "major league baseball": "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  "baseball": "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",

  // Racing / Motorsport
  "f1": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula 1": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula-1": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula one": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula 2": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula-2": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula 3": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "formula-3": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "nascar": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
  "nascar cup series": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
  "nascar-cup-series": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
  "nascar truck series": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
  "nascar-craftsman-trucks-series": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
  "nascar-oreilly-auto-parts-series": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
  "motogp": "https://pitsport.st/uploads/motogp-68f32a79.svg",
  "moto2": "https://pitsport.st/uploads/moto2-bab19042.svg",
  "moto3": "https://pitsport.st/uploads/moto3-d8f11e11.svg",
  "world rally championship": "https://pitsport.st/uploads/wrc-014feef7.svg",
  "wrc": "https://pitsport.st/uploads/wrc-014feef7.svg",
  "fim motocross world championship": "https://pitsport.st/uploads/mxgp-35223538.svg",
  "mxgp": "https://pitsport.st/uploads/mxgp-35223538.svg",
  "australian supercars championship": "https://pitsport.st/uploads/supercars-f7fee247.png",
  "racing": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "motorsport": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "motorsports": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",

  // Combat / Wrestling
  "ufc": "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png",
  "mma": "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png",
  "mixed martial arts": "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png",
  "combat": "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png",
  "fighting": "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png",
  "wwe": "https://a.espncdn.com/i/teamlogos/leagues/500/wwe.png",
  "wrestling": "https://a.espncdn.com/i/teamlogos/leagues/500/wwe.png",
  "aew": "https://a.espncdn.com/i/teamlogos/leagues/500/wwe.png",
  "all elite wrestling": "https://a.espncdn.com/i/teamlogos/leagues/500/wwe.png",

  // 24/7 Channels Channels / Brands
  "sky": "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png",
  "willow": "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-cricket.png",
  "cricket": "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-cricket.png",
  "tennis": "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png",
};

/**
 * Get official ESPN league logo by league name, tag or category
 */
function getLeagueLogo(leagueName, fallbackLogo = "") {
  if (!leagueName) return fallbackLogo;
  const key = String(leagueName).toLowerCase().trim();
  if (LEAGUE_LOGOS[key]) return LEAGUE_LOGOS[key];

  // Partial match heuristic
  for (const [leagueKey, logoUrl] of Object.entries(LEAGUE_LOGOS)) {
    if (key.includes(leagueKey) || leagueKey.includes(key)) {
      return logoUrl;
    }
  }

  return fallbackLogo;
}

function mergeConfig(customConfig = {}) {
  const cleanCustom = {};
  for (const [k, v] of Object.entries(customConfig)) {
    if (v !== undefined && v !== null && v !== "") {
      cleanCustom[k] = v;
    }
  }
  return { ...config, ...cleanCustom };
}

module.exports = {
  formatTime,
  SPORT_ICONS,
  getSportIcon,
  parseTimTime,
  parseCineTime,
  capitalize,
  LEAGUE_LOGOS,
  getLeagueLogo,
  mergeConfig,
};
