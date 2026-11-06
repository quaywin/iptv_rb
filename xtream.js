const {
  generateStrmPlaylist,
  generatePpvPlaylist,
  generateTimLivePlaylist,
  generateTimChannelsPlaylist,
  generateSportsbitePlaylist,
  generateChannel3Playlist,
  generateChannel4Playlist,
  generateChannel5Playlist,
  generateCdnPlaylist,
  generateGkPlaylist,
  generatePitPlaylist,
  generateCinePlaylist,
  generateDamPlaylist,
  generateSports247Playlist,
  generateCombinedPlaylist,
} = require("./generate");
const defaultConfig = require("./config");
const {
  isAllCategory,
  getVodCategories,
  getVodStreams,
  getVodInfo,
  getSeriesCategories,
  getSeriesStreams,
  getSeriesInfo,
  buildVodResolverUrl,
  buildSeriesResolverUrl,
} = require("./providers/tmdb");

// Map alias -> Provider definition
const PROVIDER_MAP = {
  // STRM (Sports events)
  strm: { filename: "strm.m3u", generator: generateStrmPlaylist, title: "STRM Sports" },
  stream: { filename: "strm.m3u", generator: generateStrmPlaylist, title: "STRM Sports" },

  // PPV
  ppv: { filename: "ppv.m3u", generator: generatePpvPlaylist, title: "PPV Events" },

  // TimStreams
  tim: { filename: "tim.m3u", generator: generateTimLivePlaylist, title: "TimStreams Live" },
  "tim-live": { filename: "tim.m3u", generator: generateTimLivePlaylist, title: "TimStreams Live" },
  channel: { filename: "channels.m3u", generator: generateTimChannelsPlaylist, title: "Tim Channels" },
  channels: { filename: "channels.m3u", generator: generateTimChannelsPlaylist, title: "Tim Channels" },
  "tim-channels": { filename: "channels.m3u", generator: generateTimChannelsPlaylist, title: "Tim Channels" },

  // Channel 2 (Sportsbite)
  channel2: { filename: "channel2.m3u", generator: generateSportsbitePlaylist, title: "Sportsbite Channels" },
  sportsbite: { filename: "channel2.m3u", generator: generateSportsbitePlaylist, title: "Sportsbite Channels" },

  // Channel 3 (Vidcdn)
  channel3: { filename: "channel3.m3u", generator: generateChannel3Playlist, title: "VidCDN Channels" },
  vidcdn: { filename: "channel3.m3u", generator: generateChannel3Playlist, title: "VidCDN Channels" },

  // Channel 4 (Sports247 24/7 channels)
  channel4: { filename: "channel4.m3u", generator: generateChannel4Playlist, title: "Sports247 24/7 Channels" },
  c4: { filename: "channel4.m3u", generator: generateChannel4Playlist, title: "Sports247 24/7 Channels" },
  "sports247-channels": { filename: "channel4.m3u", generator: generateChannel4Playlist, title: "Sports247 24/7 Channels" },

  // Channel 5 (CDN Live TV 24/7 channels)
  channel5: { filename: "channel5.m3u", generator: generateChannel5Playlist, title: "CDN Live TV 24/7 Channels" },
  c5: { filename: "channel5.m3u", generator: generateChannel5Playlist, title: "CDN Live TV 24/7 Channels" },

  // CDN Live Events
  cdn: { filename: "cdn.m3u", generator: generateCdnPlaylist, title: "CDN Live Sports Events" },
  cdnlivetv: { filename: "cdn.m3u", generator: generateCdnPlaylist, title: "CDN Live Sports Events" },

  // Sports247 Live Events
  "247": { filename: "247.m3u", generator: generateSports247Playlist, title: "Sports247 Live Events" },
  sports247: { filename: "247.m3u", generator: generateSports247Playlist, title: "Sports247 Live Events" },

  // DAM / OnDemand
  dam: { filename: "dam.m3u", generator: generateDamPlaylist, title: "DAMITV" },
  ondemand: { filename: "dam.m3u", generator: generateDamPlaylist, title: "DAMITV" },
  damitv: { filename: "dam.m3u", generator: generateDamPlaylist, title: "DAMITV" },

  // Cinevid
  cine: { filename: "cine.m3u", generator: generateCinePlaylist, title: "Cinevid Sports" },
  cinevid: { filename: "cine.m3u", generator: generateCinePlaylist, title: "Cinevid Sports" },

  // PitSport
  pit: { filename: "pit.m3u", generator: generatePitPlaylist, title: "PitSport" },
  pitsport: { filename: "pit.m3u", generator: generatePitPlaylist, title: "PitSport" },

  // ReedStreams / GK
  gk: { filename: "gk.m3u", generator: generateGkPlaylist, title: "ReedStreams (GK)" },
  reed: { filename: "gk.m3u", generator: generateGkPlaylist, title: "ReedStreams (GK)" },

  // Combined (All)
  all: { filename: "all.m3u", generator: generateCombinedPlaylist, title: "All Combined" },
};

// In-memory cache for parsed Xtream data per provider
// providerKey -> { timestamp, m3uContent, categories, streams, streamMap, categoryStreams }
const xtreamCache = new Map();

/**
 * 32-bit positive integer hash function (djb2 variant)
 * Keeps integer within safe int32 range (1 to 1,000,000,000) to prevent Android/Java integer overflow.
 * Ensures stream_id remains consistent across requests and reloads for the same channel name/url.
 */
function hashStringToInt(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000000000) + 1;
}

/**
 * Extract channel display name safely from #EXTINF line
 * Finds the first comma outside quotes to avoid slicing names containing commas.
 */
function extractExtinfTitle(line) {
  let inQuotes = false;
  for (let i = 8; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      return line.slice(i + 1).trim();
    }
  }
  return "";
}

/**
 * Case-insensitive query param getter
 */
function getParam(params, key) {
  if (params.has(key)) return params.get(key);
  const target = key.toLowerCase();
  for (const [k, v] of params.entries()) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}

/**
 * Parse raw M3U text into structured Xtream categories and streams
 */
function parseM3uToXtream(m3uContent) {
  const lines = m3uContent.split(/\r?\n/);
  const rawItems = [];
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/i);

      const parsedTitle = extractExtinfTitle(line);
      const displayName = parsedTitle || (tvgNameMatch ? tvgNameMatch[1] : "Live Channel");

      currentItem = {
        name: displayName,
        tvgName: tvgNameMatch ? tvgNameMatch[1] : displayName,
        logo: tvgLogoMatch ? tvgLogoMatch[1] : "",
        groupTitle: (groupTitleMatch ? groupTitleMatch[1] : "General").trim() || "General",
        epgId: tvgIdMatch ? tvgIdMatch[1] : "",
      };
    } else if (line.startsWith("#")) {
      continue;
    } else if (currentItem) {
      rawItems.push({
        ...currentItem,
        url: line,
      });
      currentItem = null;
    }
  }

  // Build categories map
  const categoryNames = Array.from(new Set(rawItems.map(it => it.groupTitle))).sort((a, b) => a.localeCompare(b));
  const categoryIdMap = new Map(); // groupTitle -> category_id string
  const categories = categoryNames.map((name, idx) => {
    const catId = String(idx + 1);
    categoryIdMap.set(name, catId);
    return {
      category_id: catId,
      category_name: name,
      parent_id: 0,
    };
  });

  // Build streams and lookup maps
  const streams = [];
  const streamMap = new Map(); // stream_id -> url
  const categoryStreams = new Map(); // category_id -> Array<stream>
  const nowTs = String(Math.floor(Date.now() / 1000));

  const usedIds = new Set();

  rawItems.forEach((item, index) => {
    let streamId = hashStringToInt(`${item.name}|${item.url}`);
    // Handle rare hash collisions
    while (usedIds.has(streamId)) {
      streamId++;
    }
    usedIds.add(streamId);

    const catId = categoryIdMap.get(item.groupTitle) || "1";

    const streamEntry = {
      num: index + 1,
      name: item.name,
      stream_type: "live",
      stream_id: streamId,
      stream_icon: item.logo,
      epg_channel_id: item.epgId || null,
      added: nowTs,
      category_id: catId,
      custom_sid: null,
      tv_archive: 0,
      direct_source: "",
      tv_archive_duration: 0,
    };

    streams.push(streamEntry);
    streamMap.set(streamId, item.url);

    if (!categoryStreams.has(catId)) {
      categoryStreams.set(catId, []);
    }
    categoryStreams.get(catId).push(streamEntry);
  });

  return {
    categories,
    streams,
    streamMap,
    categoryStreams,
  };
}

/**
 * Authenticate username and password, resolve target provider key
 */
function authenticateUser(username, password, cfg) {
  if (!username) {
    return { valid: false, error: "Missing username" };
  }

  const u = String(username).trim();
  const p = String(password || "").trim();

  // 1. Check custom user mapping in XTREAM_USERS (format: user1:pass1:provider1,user2:pass2:provider2)
  const usersConfig = cfg.xtreamUsers || "";
  if (usersConfig) {
    const pairs = usersConfig.split(",").map(s => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const [confUser, confPass, confProvider] = pair.split(":").map(s => s.trim());
      if (confUser && confUser.toLowerCase() === u.toLowerCase()) {
        if (confPass && confPass !== p) {
          return { valid: false, error: "Invalid password" };
        }
        const resolvedProvider = confProvider ? confProvider.toLowerCase() : "all";
        if (!PROVIDER_MAP[resolvedProvider]) {
          return { valid: false, error: `Configured provider "${confProvider}" is invalid` };
        }
        return { valid: true, provider: resolvedProvider, username: confUser };
      }
    }
  }

  // 2. Direct provider mapping: username is provider name
  const providerKey = u.toLowerCase();
  const providerDef = PROVIDER_MAP[providerKey];
  if (!providerDef) {
    return { valid: false, error: `Provider "${u}" not found` };
  }

  // Check password against global XTREAM_PASSWORD
  const expectedPassword = cfg.xtreamPassword !== undefined ? String(cfg.xtreamPassword).trim() : "iptv";
  if (expectedPassword && p !== expectedPassword) {
    return { valid: false, error: "Invalid password" };
  }

  return { valid: true, provider: providerKey, username: u };
}

/**
 * Get or parse Xtream structured data for a provider with caching
 */
async function getOrLoadXtreamData(providerKey, getOrGeneratePlaylist, cfg) {
  const providerDef = PROVIDER_MAP[providerKey];
  if (!providerDef) return null;

  const now = Date.now();
  const ttlMs = (cfg.cacheTtl || 60) * 1000;
  const cached = xtreamCache.get(providerKey);

  if (cached && (now - cached.timestamp < ttlMs)) {
    return cached;
  }

  const m3uContent = await getOrGeneratePlaylist(providerDef.filename, providerDef.generator, providerKey);
  if (!m3uContent?.trim()) {
    return cached || null;
  }

  const parsed = parseM3uToXtream(m3uContent);
  const data = {
    timestamp: now,
    m3uContent,
    ...parsed,
  };

  xtreamCache.set(providerKey, data);
  return data;
}

/**
 * Standard CORS headers for Xtream endpoints
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

/**
 * Main Xtream Codes router and request handler
 */
async function handleXtreamRequest({ req, url, config = defaultConfig, getOrGeneratePlaylist }) {
  const pathname = url.pathname.toLowerCase();
  const method = req.method ? req.method.toUpperCase() : "GET";

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1. Handle /player_api.php (and /panel_api.php legacy)
  if (
    pathname === "/player_api.php" ||
    pathname.endsWith("/player_api.php") ||
    pathname === "/panel_api.php" ||
    pathname.endsWith("/panel_api.php")
  ) {
    let params = url.searchParams;

    // Parse form-data or JSON body on POST requests
    if (method === "POST") {
      try {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await req.json();
          params = new URLSearchParams(url.searchParams);
          for (const [k, v] of Object.entries(body)) {
            params.set(k, String(v));
          }
        } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
          const formText = await req.text();
          const formParams = new URLSearchParams(formText);
          params = new URLSearchParams(url.searchParams);
          for (const [k, v] of formParams.entries()) {
            params.set(k, v);
          }
        }
      } catch (e) {
        console.warn("Failed to parse POST body for player_api.php:", e.message);
      }
    }

    const username = getParam(params, "username") || getParam(params, "u");
    const password = getParam(params, "password") || getParam(params, "p");
    const action = getParam(params, "action");

    const auth = authenticateUser(username, password, config);
    if (!auth.valid) {
      return Response.json(
        { user_info: { auth: 0, status: "Disabled", message: auth.error } },
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const providerKey = auth.provider;
    const xtreamData = await getOrLoadXtreamData(providerKey, getOrGeneratePlaylist, config);

    // Auth & General Server/User Info
    if (!action) {
      const nowSec = Math.floor(Date.now() / 1000);
      const host = url.hostname || "localhost";
      const protocol = url.protocol ? url.protocol.replace(":", "") : "http";
      const port = String(url.port || (protocol === "https" ? 443 : 80));

      return Response.json({
        user_info: {
          username: auth.username,
          password: password || "",
          message: `Connected to ${PROVIDER_MAP[providerKey].title}`,
          auth: 1,
          status: "Active",
          exp_date: "1999999999",
          is_trial: "0",
          active_cons: "0",
          created_at: "1600000000",
          max_connections: "5",
          allowed_output_formats: ["m3u8", "ts", "rtmp", "mp4", "mkv", "avi"],
        },
        server_info: {
          url: host,
          port: port,
          https_port: "443",
          server_protocol: protocol,
          rtmp_port: "8880",
          timezone: config.timezone || "Asia/Ho_Chi_Minh",
          timestamp_now: nowSec,
          time_now: new Date().toISOString().replace("T", " ").substring(0, 19),
          process: true,
        },
      }, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    // Action: get_live_categories
    if (action === "get_live_categories") {
      const categories = xtreamData?.categories || [];
      return Response.json(categories, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Action: get_live_streams
    if (action === "get_live_streams") {
      const catId = getParam(params, "category_id");
      let streams = [];
      if (!isAllCategory(catId) && xtreamData?.categoryStreams) {
        streams = xtreamData.categoryStreams.get(catId) || [];
      } else {
        streams = xtreamData?.streams || [];
      }

      return Response.json(streams, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Action: VOD Movie Categories
    if (action === "get_vod_categories") {
      const categories = await getVodCategories(config?.tmdbApiKey);
      return Response.json(categories, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Action: VOD Movie Streams
    if (action === "get_vod_streams") {
      const catId = getParam(params, "category_id");
      const pageRaw = getParam(params, "page");
      const hasPageParam = pageRaw !== null && pageRaw !== undefined && pageRaw !== "";
      const page = parseInt(pageRaw || "1", 10) || 1;
      const search = getParam(params, "search") || getParam(params, "query") || getParam(params, "q") || getParam(params, "keyword") || getParam(params, "name") || getParam(params, "title") || getParam(params, "context") || "";
      const streams = await getVodStreams(catId, config?.tmdbApiKey, page, search, hasPageParam);
      return Response.json(streams, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          "X-Page": String(page),
          "X-Per-Page": "20",
        },
      });
    }

    // Action: VOD Info
    if (action === "get_vod_info") {
      const vodId = getParam(params, "vod_id") || getParam(params, "stream_id");
      if (!vodId) {
        return Response.json({}, { status: 200, headers: CORS_HEADERS });
      }
      const info = await getVodInfo(vodId, config?.tmdbApiKey);
      return Response.json(info, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Action: Series Categories
    if (action === "get_series_categories") {
      const categories = await getSeriesCategories(config?.tmdbApiKey);
      return Response.json(categories, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Action: Series Streams (supports get_series and get_series_streams alias)
    if (action === "get_series" || action === "get_series_streams") {
      const catId = getParam(params, "category_id");
      const pageRaw = getParam(params, "page");
      const hasPageParam = pageRaw !== null && pageRaw !== undefined && pageRaw !== "";
      const page = parseInt(pageRaw || "1", 10) || 1;
      const search = getParam(params, "search") || getParam(params, "query") || getParam(params, "q") || getParam(params, "keyword") || getParam(params, "name") || getParam(params, "title") || getParam(params, "context") || "";
      const series = await getSeriesStreams(catId, config?.tmdbApiKey, page, search, hasPageParam);
      return Response.json(series, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          "X-Page": String(page),
          "X-Per-Page": "20",
        },
      });
    }

    // Action: Search (search / search_vod / search_series)
    if (action === "search" || action === "search_vod" || action === "search_series") {
      const type = (getParam(params, "type") || "").toLowerCase();
      const query = getParam(params, "search") || getParam(params, "query") || getParam(params, "q") || getParam(params, "context") || getParam(params, "keyword") || "";
      const page = parseInt(getParam(params, "page") || "1", 10) || 1;

      if (action === "search_series" || type === "series" || type === "tv") {
        const series = await getSeriesStreams(null, config?.tmdbApiKey, page, query, true);
        return Response.json(series, {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "X-Page": String(page), "X-Per-Page": "20" },
        });
      }

      // Default search: VOD (movies) only - strict separation between VOD and Series schemas
      const streams = await getVodStreams(null, config?.tmdbApiKey, page, query, true);
      return Response.json(streams, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "X-Page": String(page), "X-Per-Page": "20" },
      });
    }

    // Action: Series Info
    if (action === "get_series_info") {
      const seriesId = getParam(params, "series_id") || getParam(params, "stream_id");
      if (!seriesId) {
        return Response.json({}, { status: 200, headers: CORS_HEADERS });
      }
      const info = await getSeriesInfo(seriesId, config?.tmdbApiKey);
      return Response.json(info, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Action: Short EPG
    if (action === "get_short_epg") {
      return Response.json({ epg_listings: [] }, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Fallback: Default status response
    return Response.json({ user_info: { auth: 1, status: "Active" } }, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // 2. Handle /live/:username/:password/:streamId (.ts | .m3u8 | raw id)
  if (pathname.startsWith("/live/")) {
    const parts = url.pathname.split("/").filter(Boolean); // ['live', username, password, streamId]
    if (parts.length >= 4) {
      const username = parts[1];
      const password = parts[2];
      const rawStream = parts[3];

      // Extract streamId integer
      const streamIdMatch = rawStream.match(/^(\d+)/);
      if (!streamIdMatch) {
        return new Response("Invalid stream id", { status: 400, headers: CORS_HEADERS });
      }

      const streamId = parseInt(streamIdMatch[1], 10);
      const auth = authenticateUser(username, password, config);
      if (!auth.valid) {
        return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
      }

      const providerKey = auth.provider;
      const xtreamData = await getOrLoadXtreamData(providerKey, getOrGeneratePlaylist, config);
      const targetUrl = xtreamData?.streamMap?.get(streamId);

      if (!targetUrl) {
        return new Response("Stream not found or expired", { status: 404, headers: CORS_HEADERS });
      }

      // HTTP 302 Redirect to upstream stream manifest / scraper
      return new Response(null, {
        status: 302,
        headers: {
          ...CORS_HEADERS,
          Location: targetUrl,
        },
      });
    }
  }

  // 3. Handle /movie/:username/:password/:streamId or /vod/:username/:password/:streamId (.mp4 | .mkv | .m3u8 | raw id)
  if (pathname.startsWith("/movie/") || pathname.startsWith("/vod/")) {
    const parts = url.pathname.split("/").filter(Boolean); // ['movie', username, password, streamId]
    if (parts.length >= 4) {
      const username = parts[1];
      const password = parts[2];
      const rawStream = parts[3];

      const streamIdMatch = rawStream.match(/^(\d+)/);
      if (!streamIdMatch) {
        return new Response("Invalid movie id", { status: 400, headers: CORS_HEADERS });
      }

      const streamId = parseInt(streamIdMatch[1], 10);
      const auth = authenticateUser(username, password, config);
      if (!auth.valid) {
        return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
      }

      // Build target video resolver URL
      const targetUrl = buildVodResolverUrl(streamId, config?.vodResolverUrl);

      return new Response(null, {
        status: 302,
        headers: {
          ...CORS_HEADERS,
          Location: targetUrl,
        },
      });
    }
  }

  // 4. Handle /series/:username/:password/:episodeId (.mp4 | .mkv | .m3u8 | raw id)
  if (pathname.startsWith("/series/")) {
    const parts = url.pathname.split("/").filter(Boolean); // ['series', username, password, episodeId]
    if (parts.length >= 4) {
      const username = parts[1];
      const password = parts[2];
      const rawStream = parts[3];

      const epIdMatch = rawStream.match(/^(\d+)/);
      if (!epIdMatch) {
        return new Response("Invalid episode id", { status: 400, headers: CORS_HEADERS });
      }

      const episodeId = parseInt(epIdMatch[1], 10);
      const auth = authenticateUser(username, password, config);
      if (!auth.valid) {
        return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
      }

      // Decode seriesId, season, and episode from encoded integer:
      // epId = seriesId * 10000 + (season % 100) * 100 + (epNumber % 100)
      // seriesId keeps its full width (see providers/tmdb.js) so shows with
      // TMDB ids >= 100000 resolve to the correct series.
      const epNum = episodeId % 100;
      const sNum = Math.floor((episodeId % 10000) / 100);
      const seriesId = Math.floor(episodeId / 10000);

      // Build target series video resolver URL
      const targetUrl = buildSeriesResolverUrl(seriesId, sNum, epNum, config?.seriesResolverUrl);

      return new Response(null, {
        status: 302,
        headers: {
          ...CORS_HEADERS,
          Location: targetUrl,
        },
      });
    }
  }

  // 5. Handle /get.php (Download M3U Playlist via Xtream credentials)
  if (pathname === "/get.php" || pathname.endsWith("/get.php")) {
    const username = url.searchParams.get("username") || url.searchParams.get("u");
    const password = url.searchParams.get("password") || url.searchParams.get("p");

    const auth = authenticateUser(username, password, config);
    if (!auth.valid) {
      return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
    }

    const providerKey = auth.provider;
    const providerDef = PROVIDER_MAP[providerKey];
    const m3uContent = await getOrGeneratePlaylist(providerDef.filename, providerDef.generator, providerKey);

    return new Response(m3uContent, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Content-Disposition": `attachment; filename="${providerDef.filename}"`,
      },
    });
  }

  // 4. Handle /xmltv.php (XMLTV EPG placeholder)
  if (pathname === "/xmltv.php" || pathname.endsWith("/xmltv.php")) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="IPTV_RB"></tv>`;
    return new Response(xml, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  }

  return null;
}

module.exports = {
  PROVIDER_MAP,
  authenticateUser,
  parseM3uToXtream,
  handleXtreamRequest,
};
