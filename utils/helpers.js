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
  fight: "🥊",
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
  "american-football": "🏈",
  "australian football": "🏉",
  "ice hockey": "🏒",
  "motorsports": "🏎️",
  "motor-sports": "🏎️",
  "golf": "⛳",
  "rugby": "🏉",
  "volleyball": "🏐",
  "badminton": "🏸",
  "snooker": "🎱",
  "table tennis": "🏓",
  "handball": "🤾",
  "24/7 streams": "📺",
  "24/7-streams": "📺",
  "live shows": "📺",
};

function getSportIcon(category, provider = "strm") {
  if (!category) return "🏆";
  const key = category.toLowerCase().trim();
  if ((provider === "ppv" || provider === "gk" || provider === "cine" || provider === "cinevid" || provider === "dam" || provider === "ondemand") && key === "football") {
    return "⚽"; // In PPV.st, GK/ReedStreams, Cinevid & DAM, "Football" is European Football (Soccer)
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

// Default mirror hosts for popular stream services
const PROVIDER_MIRRORS = {
  strm: ["https://strmfree.st", "https://strmfree.to", "https://strmfree.is", "https://strmfree.ws", "https://streamfree.to"],
  cine: ["https://cinevid.st", "https://cinevid.to", "https://cinevid.is", "https://cinevid.ws"],
  dam: ["https://ondemand.st", "https://ondemand.to", "https://ondemand.is", "https://damitv.st", "https://damitv.to"],
  tim: ["https://tim-streams.com", "https://tim-streams.to", "https://tim-streams.net", "https://tim-streams.is"],
  gk: ["https://api.reedstreams.link", "https://reedstreams.link", "https://api.reedstreams.to", "https://api.reedstreams.is"],
  pit: ["https://pitsport.st", "https://pitsport.to", "https://pitsport.is", "https://pitsport.ws"],
  sportsbite: ["https://sportsbite.org", "https://sportsbite.to", "https://sportsbite.st", "https://sportsbite.net"],
  vidcdn: ["https://vidcdn.vip", "https://vidcdn.st", "https://vidcdn.to", "https://vidcdn.is"],
  matchora: ["https://matchora.to", "https://matchora.pro", "https://es.matchora.pro", "https://matchora.net"],
};

/**
 * In-memory host health registry & circuit breaker
 * hostOrigin -> {
 *   failureCount: number,
 *   lastFailureTime: number,
 *   lastSuccessTime: number,
 *   latency: number, // ms
 *   cooldownUntil: number // timestamp
 * }
 */
const hostHealthRegistry = new Map();

function getHostOrigin(urlStr) {
  try {
    return new URL(urlStr).origin.toLowerCase();
  } catch (e) {
    return urlStr;
  }
}

function getHostStats(origin) {
  if (!hostHealthRegistry.has(origin)) {
    hostHealthRegistry.set(origin, {
      failureCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      latency: 0,
      cooldownUntil: 0,
    });
  }
  return hostHealthRegistry.get(origin);
}

function recordHostSuccess(urlStr, latencyMs) {
  const origin = getHostOrigin(urlStr);
  const stats = getHostStats(origin);
  stats.failureCount = 0;
  stats.lastSuccessTime = Date.now();
  stats.latency = latencyMs;
  stats.cooldownUntil = 0;
}

function recordHostFailure(urlStr, error) {
  const origin = getHostOrigin(urlStr);
  const stats = getHostStats(origin);
  const now = Date.now();
  stats.failureCount += 1;
  stats.lastFailureTime = now;

  // Progressive cooldown:
  // 1 failure: 2 minutes (120s)
  // 2 failures: 10 minutes (600s)
  // >= 3 failures: 30 minutes (1800s)
  let cooldownSec = 120;
  if (stats.failureCount === 2) cooldownSec = 600;
  else if (stats.failureCount >= 3) cooldownSec = 1800;

  stats.cooldownUntil = now + cooldownSec * 1000;
  console.warn(`[CircuitBreaker] Host ${origin} penalised (failures: ${stats.failureCount}). Cooldown: ${cooldownSec}s.`);
}

/**
 * Rank candidate URLs dynamically based on host health, failure history, and latency
 */
function rankCandidateUrls(urls) {
  const now = Date.now();

  return [...urls].sort((urlA, urlB) => {
    const originA = getHostOrigin(urlA);
    const originB = getHostOrigin(urlB);

    if (originA === originB) return 0;

    const statsA = getHostStats(originA);
    const statsB = getHostStats(originB);

    const isCooldownA = statsA.cooldownUntil > now;
    const isCooldownB = statsB.cooldownUntil > now;

    // 1. Host không trong cooldown luôn ưu tiên hơn host đang bị cooldown
    if (!isCooldownA && isCooldownB) return -1;
    if (isCooldownA && !isCooldownB) return 1;

    // Nếu cả 2 đều đang cooldown, host nào sắp hết hạn cooldown hơn thì thử trước
    if (isCooldownA && isCooldownB) {
      return statsA.cooldownUntil - statsB.cooldownUntil;
    }

    // 2. Cả 2 đều khỏe mạnh:
    // Host đã từng phản hồi thành công (lastSuccessTime > 0) ưu tiên hơn host chưa từng biết
    const hasSuccessA = statsA.lastSuccessTime > 0 && statsA.failureCount === 0;
    const hasSuccessB = statsB.lastSuccessTime > 0 && statsB.failureCount === 0;

    if (hasSuccessA && !hasSuccessB) return -1;
    if (!hasSuccessA && hasSuccessB) return 1;

    // 3. Nếu cả 2 đều đã thành công: ưu tiên host có độ trễ (latency) thấp hơn
    if (hasSuccessA && hasSuccessB && statsA.latency && statsB.latency) {
      return statsA.latency - statsB.latency;
    }

    // Giữ nguyên thứ tự ban đầu nếu ngang bằng
    return 0;
  });
}

/**
 * Generate candidate URLs by replacing the host of primaryUrl with fallback hosts
 */
function buildCandidateUrls(primaryUrl, alternateHosts = []) {
  if (!primaryUrl) return [];
  const candidates = [primaryUrl];
  try {
    const parsed = new URL(primaryUrl);
    const pathAndQuery = parsed.pathname + parsed.search;
    for (const host of alternateHosts) {
      try {
        const altUrl = new URL(pathAndQuery, host).toString();
        if (!candidates.includes(altUrl)) {
          candidates.push(altUrl);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return candidates;
}

/**
 * Robust fetch with adaptive ranking, circuit breaker and multi-mirror fallback
 */
async function fetchWithFallback(urls, options = {}) {
  const rawList = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
  if (!rawList.length) {
    throw new Error("fetchWithFallback: No valid URLs provided");
  }

  // Tự động sắp xếp candidate URLs theo độ khỏe, cooldown và phản hồi thực tế
  const urlList = rankCandidateUrls(rawList);

  const timeoutMs = options.timeoutMs || options.timeout || 6000;
  const responseType = options.responseType || "json";
  const fetchHeaders = options.headers || {};
  let lastError = null;

  for (const url of urlList) {
    let timer = null;
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);

      const res = await fetch(url, {
        method: options.method || "GET",
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: options.redirect || "follow",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = responseType === "json" ? await res.json() : await res.text();
      const latencyMs = Date.now() - startTime;
      recordHostSuccess(url, latencyMs);
      return data;
    } catch (err) {
      lastError = err;
      recordHostFailure(url, err);
      console.warn(`[fetchWithFallback] Failed for ${url}: ${err.message}. Trying next mirror...`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new Error(`All candidate URLs failed (${urlList.length} tried). Last error: ${lastError ? lastError.message : "Unknown error"}`);
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
  PROVIDER_MIRRORS,
  buildCandidateUrls,
  fetchWithFallback,
  rankCandidateUrls,
  getHostStats,
  hostHealthRegistry,
  mergeConfig,
};
