function getInt(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const env = (typeof process !== "undefined" && process && process.env) ? process.env : {};

const config = {
  port: env.PORT || 3030,
  vpsUrl: env.VPS_URL || "",
  streamApiUrl: env.STREAM_API_URL || "https://strmfree.st/streams",
  ppvApiUrl: env.PPV_API_URL || "https://api.ppv.st/api/streams",
  timApiUrl: env.TIM_API_URL || "https://tim-streams.com/api/live-upcoming",
  timChannelsUrl: env.TIM_CHANNELS_URL || "https://tim-streams.com/api/channels",
  timWatchBaseUrl: env.TIM_WATCH_BASE_URL || "https://tim-streams.com/api/watch",
  gkApiUrl: env.GK_API_URL || "https://api.reedstreams.link/api/matches/all",
  sportsbiteChannelsUrl: env.SPORTSBITE_CHANNELS_URL || "https://sportsbite.org/api/forestgump/channels",
  pitApiUrl: env.PIT_API_URL || "https://pitsport.st/api/v1/home",
  cineApiUrl: env.CINE_API_URL || "https://cinevid.st/api/public/events",
  vidcdnChannelsUrl: env.VIDCDN_CHANNELS_URL || "https://vidcdn.vip/api/channels",
  cineEmbedChannelBaseUrl: env.CINE_EMBED_CHANNEL_BASE_URL || "https://cinevid.st/embed/channel",
  damApiUrl: env.DAM_API_URL || "https://ondemand.st/papi/api/streams",
  damScrapeServiceUrl: env.DAM_SCRAPE_SERVICE_URL || env.SCRAPE_SERVICE_URL || "",
  sports247Url: env.SPORTS247_URL || "https://en.sports247.ru",
  matchoraApiUrl: env.MATCHORA_API_URL || "https://matchora.to/api/v1",
  sports247ScrapeServiceUrl: env.SPORTS247_SCRAPE_SERVICE_URL || env.DAM_SCRAPE_SERVICE_URL || env.SCRAPE_SERVICE_URL || "",
  cdnChannelsUrl: env.CDN_CHANNELS_URL || "https://api.cdnlivetv.tv/api/v1/channels/?user=cdnlivetv&plan=free",
  cdnEventsUrl: env.CDN_EVENTS_URL || "https://api.cdnlivetv.tv/api/v1/events/sports/?user=cdnlivetv&plan=free",
  cdnScrapeServiceUrl: env.CDN_SCRAPE_SERVICE_URL || env.SPORTS247_SCRAPE_SERVICE_URL || env.DAM_SCRAPE_SERVICE_URL || env.SCRAPE_SERVICE_URL || "",
  scrapeServiceUrl: env.SCRAPE_SERVICE_URL || "",
  strmScrapeServiceUrl: env.STRM_SCRAPE_SERVICE_URL || env.SCRAPE_SERVICE_URL || "",
  cineScrapeServiceUrl: env.CINE_SCRAPE_SERVICE_URL || env.SCRAPE_SERVICE_URL || "",
  embedBaseUrl: env.EMBED_BASE_URL || "https://strmfree.st/embed",
  referer: env.REFERER || "https://strmfree.st/",
  origin: env.ORIGIN || "https://strmfree.st",
  userAgent: env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  checkInterval: getInt(env.CHECK_INTERVAL, 5 * 60 * 1000),
  cacheTtl: getInt(env.CACHE_TTL, 60), // in seconds
  timeout: getInt(env.TIMEOUT, 5000),
  hoursBack: getInt(env.HOURS_BACK, 4),
  hoursAhead: getInt(env.HOURS_AHEAD, 24),
  cdnHoursAhead: getInt(env.CDN_HOURS_AHEAD, 72),
  maxChannelsPerEvent: env.MAX_CHANNELS_PER_EVENT !== undefined ? parseInt(env.MAX_CHANNELS_PER_EVENT, 10) : 4,
  timezone: env.TIMEZONE || "Asia/Ho_Chi_Minh",
  xtreamPassword: env.XTREAM_PASSWORD !== undefined ? env.XTREAM_PASSWORD : "iptv",
  xtreamUsers: env.XTREAM_USERS || "",
  tmdbApiKey: env.TMDB_API_KEY || "",
  vodResolverUrl: env.VOD_RESOLVER_URL || "",
  seriesResolverUrl: env.SERIES_RESOLVER_URL || "",
};

module.exports = config;
