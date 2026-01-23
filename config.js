require('dotenv').config();

function getInt(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const config = {
  port: process.env.PORT || 3030,
  vpsUrl: process.env.VPS_URL || "",
  apiBaseUrl: process.env.API_BASE_URL || "https://api.robong.me/v1",
  referer: process.env.REFERER || "https://robong.me/",
  origin: process.env.ORIGIN || "https://robong.me",
  userAgent: process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  backupStreamBase: process.env.BACKUP_STREAM_BASE || "https://2988376792.global.cdnfastest.com",
  primaryStreamBase: process.env.PRIMARY_STREAM_BASE || "https://rblive.starxcdn.xyz",
  checkInterval: getInt(process.env.CHECK_INTERVAL, 5 * 60 * 1000),
  timeout: getInt(process.env.TIMEOUT, 2000),
  proxyThreshold: getInt(process.env.PROXY_THRESHOLD, 500),
  hoursBack: getInt(process.env.HOURS_BACK, 6),
  hoursAhead: getInt(process.env.HOURS_AHEAD, 24),
  hoursLookingAhead: getInt(process.env.HOURS_LOOKING_AHEAD, 24),
};

module.exports = config;
