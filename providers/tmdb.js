/**
 * TMDb Provider for Xtream Codes (VOD & TV Series)
 * Fetches genres, catalog, metadata and builds resolver URLs
 */

const DEFAULT_TMDB_API_KEY = "61e2290429798c561450eb56b26de19b";
const TMDB_HOSTS = ["https://api.tmdb.org/3", "https://api.themoviedb.org/3"];
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// In-memory LRU cache + in-flight deduplication to prevent hitting TMDB rate limits
const memoryCache = new Map();
const inFlightFetches = new Map();
const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours

function getCachedTmdb(cacheKey) {
  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= CACHE_TTL_MS) {
    memoryCache.delete(cacheKey);
    return null;
  }
  // Refresh LRU order
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, cached);
  return cached.data;
}

function setCachedTmdb(cacheKey, data) {
  if (memoryCache.has(cacheKey)) {
    memoryCache.delete(cacheKey);
  } else if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) memoryCache.delete(oldestKey);
  }
  memoryCache.set(cacheKey, { data, timestamp: Date.now() });
}

async function fetchTmdb(endpoint, params = {}, apiKey = DEFAULT_TMDB_API_KEY, timeoutMs = 8000) {
  const query = new URLSearchParams({
    api_key: apiKey || DEFAULT_TMDB_API_KEY,
    language: "en-US",
    ...params,
  });

  const cacheKey = `${endpoint}?${query.toString()}`;
  const cachedData = getCachedTmdb(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  if (inFlightFetches.has(cacheKey)) {
    return inFlightFetches.get(cacheKey);
  }

  const fetchPromise = (async () => {
    let lastError = null;

    for (const host of TMDB_HOSTS) {
      const url = `${host}${endpoint}?${query.toString()}`;

      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          if (res.status === 429 && attempt === 0) {
            const retryAfterSec = parseInt(res.headers.get("retry-after") || "1", 10);
            const waitMs = Math.min(1000, (Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 1) * 350);
            clearTimeout(timer);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }

          if (!res.ok) {
            throw new Error(`TMDb HTTP error: ${res.status}`);
          }

          const data = await res.json();
          setCachedTmdb(cacheKey, data);
          return data;
        } catch (err) {
          lastError = err;
          break;
        } finally {
          clearTimeout(timer);
        }
      }
    }

    throw lastError || new Error("Failed to reach TMDb API hosts");
  })().finally(() => {
    inFlightFetches.delete(cacheKey);
  });

  inFlightFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Curated VOD Categories (Cinema by year, Streaming Platforms, All-Time Acclaimed)
 */
const VOD_CATEGORIES = [
  { category_id: "1000", category_name: "🔥 Đang Thịnh Hành (Hot Tuần)", parent_id: 0, query: { endpoint: "/trending/movie/week" } },
  { category_id: "2026", category_name: "Phim Chiếu Rạp 2026", parent_id: 0, query: { primary_release_year: "2026", sort_by: "popularity.desc" } },
  { category_id: "2025", category_name: "Phim 2025 (Nổi Bật)", parent_id: 0, query: { primary_release_year: "2025", sort_by: "popularity.desc" } },
  { category_id: "2024", category_name: "Phim 2024 (Nổi Bật)", parent_id: 0, query: { primary_release_year: "2024", sort_by: "popularity.desc" } },
  { category_id: "2023", category_name: "Phim 2023 (Nổi Bật)", parent_id: 0, query: { primary_release_year: "2023", sort_by: "popularity.desc" } },

  // Điện ảnh Việt Nam
  { category_id: "1023", category_name: "Phim Chiếu Rạp Việt Nam", parent_id: 0, query: { with_original_language: "vi", sort_by: "popularity.desc" } },

  // Vũ trụ điện ảnh & Thương hiệu đình đám (Franchises & Cinematic Universes)
  { category_id: "1015", category_name: "Vũ Trụ Marvel (MCU)", parent_id: 0, query: { with_companies: "420|7505", sort_by: "popularity.desc" } },
  { category_id: "1016", category_name: "Vũ Trụ Star Wars", parent_id: 0, query: { with_companies: "1", sort_by: "popularity.desc" } },
  { category_id: "1017", category_name: "Vũ Trụ DC (Batman & Superman)", parent_id: 0, query: { with_companies: "9993|429|128064", sort_by: "popularity.desc" } },
  { category_id: "1018", category_name: "Thế Giới Phù Thủy Harry Potter", parent_id: 0, query: { special: "harry_potter", sort_by: "popularity.desc" } },
  { category_id: "1019", category_name: "Chúa Tể Những Chiếc Nhẫn (LOTR)", parent_id: 0, query: { special: "lotr", sort_by: "popularity.desc" } },
  { category_id: "1020", category_name: "Fast & Furious (Quá Nhanh)", parent_id: 0, query: { special: "fast_and_furious", sort_by: "popularity.desc" } },
  { category_id: "1021", category_name: "Vũ Trụ MonsterVerse (Godzilla & Kong)", parent_id: 0, query: { special: "monsterverse", sort_by: "popularity.desc" } },
  { category_id: "1022", category_name: "Điệp Viên 007 (James Bond)", parent_id: 0, query: { special: "james_bond", sort_by: "popularity.desc" } },

  // Tuyệt tác, Giải thưởng & Hoạt hình đỉnh cao
  { category_id: "1040", category_name: "🏆 Phim Đoạt Giải (Oscar & Cannes)", parent_id: 0, query: { special: "award_winning" } },
  { category_id: "1041", category_name: "📖 Dựa Trên Chuyện Có Thật", parent_id: 0, query: { with_keywords: "9672", without_genres: "27", "vote_average.gte": "6.8", "vote_count.gte": "300", sort_by: "popularity.desc" } },
  { category_id: "1042", category_name: "🧠 Hại Não & Plot Twist", parent_id: 0, query: { with_keywords: "275311|326438|184312|12565|335567", without_genres: "27", "vote_average.gte": "6.8", "vote_count.gte": "150", sort_by: "vote_count.desc" } },
  { category_id: "1025", category_name: "Tuyệt Tác IMDb Top 250", parent_id: 0, query: { sort_by: "vote_average.desc", "vote_count.gte": "4000" } },
  { category_id: "1024", category_name: "Hoạt Hình Studio Ghibli", parent_id: 0, query: { with_companies: "10342", sort_by: "popularity.desc" } },
  { category_id: "1006", category_name: "Phim Bom Tấn Đỉnh Cao", parent_id: 0, query: { sort_by: "vote_count.desc", "vote_average.gte": "7.5", "vote_count.gte": "1000" } },
  { category_id: "1007", category_name: "Phim Hoạt Hình Chiếu Rạp", parent_id: 0, query: { with_genres: "16", sort_by: "popularity.desc" } },
  { category_id: "1011", category_name: "Phim Anime Crunchyroll", parent_id: 0, query: { with_watch_providers: "283", watch_region: "US", sort_by: "popularity.desc" } },

  // Thể loại chính (Core Genres - omit Horror)
  { category_id: "1050", category_name: "💥 Phim Hành Động", parent_id: 0, query: { with_genres: "28", without_genres: "27", "vote_count.gte": "300", sort_by: "popularity.desc" } },
  { category_id: "1051", category_name: "🚀 Khoa Học Viễn Tưởng (Sci-Fi)", parent_id: 0, query: { with_genres: "878", without_genres: "27", "vote_count.gte": "200", sort_by: "popularity.desc" } },
  { category_id: "1052", category_name: "🧙 Phiêu Lưu & Kỳ Ảo", parent_id: 0, query: { with_genres: "12|14", without_genres: "27", "vote_count.gte": "200", sort_by: "popularity.desc" } },
  { category_id: "1053", category_name: "😂 Phim Hài Hước", parent_id: 0, query: { with_genres: "35", without_genres: "27", "vote_count.gte": "200", sort_by: "popularity.desc" } },
  { category_id: "1054", category_name: "🕵️ Hình Sự & Trinh Thám", parent_id: 0, query: { with_genres: "80|9648", without_genres: "27", "vote_count.gte": "200", sort_by: "popularity.desc" } },
  { category_id: "1055", category_name: "❤️ Tâm Lý & Tình Cảm", parent_id: 0, query: { with_genres: "18|10749", without_genres: "27", "vote_count.gte": "300", sort_by: "popularity.desc" } },
  { category_id: "1056", category_name: "⚔️ Chiến Tranh & Lịch Sử", parent_id: 0, query: { with_genres: "10752|36", without_genres: "27", "vote_count.gte": "150", sort_by: "popularity.desc" } },

  // Thiếu nhi & Hoạt hình theo lứa tuổi (Kids & Family by Age)
  { category_id: "1030", category_name: "👶 Thiếu Nhi Mầm Non (0-5 tuổi)", parent_id: 0, query: { certification_country: "US", certification: "G", with_genres: "16|10751", sort_by: "popularity.desc" } },
  { category_id: "1031", category_name: "🧒 Thiếu Nhi Tiểu Học (6-11 tuổi)", parent_id: 0, query: { certification_country: "US", certification: "PG", with_genres: "16|10751", sort_by: "popularity.desc" } },
  { category_id: "1032", category_name: "🧑‍🎓 Thiếu Niên & Tuổi Teen (12+)", parent_id: 0, query: { certification_country: "US", certification: "PG-13", with_genres: "16|12", "vote_count.gte": "100", sort_by: "popularity.desc" } },
  { category_id: "1033", category_name: "🏰 Hoạt Hình Disney & Pixar", parent_id: 0, query: { with_companies: "2|3", with_genres: "16|10751", sort_by: "popularity.desc" } },

  // Nền tảng phát hành toàn cầu
  { category_id: "1001", category_name: "Phim Peacock", parent_id: 0, query: { with_watch_providers: "386|387", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1002", category_name: "Phim Netflix", parent_id: 0, query: { with_watch_providers: "8", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1003", category_name: "Phim HBO Max", parent_id: 0, query: { with_watch_providers: "1899|384", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1008", category_name: "Phim Amazon Prime", parent_id: 0, query: { with_watch_providers: "9|119", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1009", category_name: "Phim Paramount+", parent_id: 0, query: { with_watch_providers: "531|2303|2616|582", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1010", category_name: "Phim Hulu", parent_id: 0, query: { with_watch_providers: "15", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1004", category_name: "Phim Disney+", parent_id: 0, query: { with_watch_providers: "337", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1005", category_name: "Phim Apple TV+", parent_id: 0, query: { with_watch_providers: "350", watch_region: "US", sort_by: "popularity.desc" } },

  // Điện ảnh Châu Á
  { category_id: "1012", category_name: "Phim Châu Á Nổi Bật", parent_id: 0, query: { with_original_language: "ko|zh|ja|th|vi", sort_by: "popularity.desc" } },
  { category_id: "1013", category_name: "Phim Hàn Quốc (K-Movie)", parent_id: 0, query: { with_original_language: "ko", sort_by: "popularity.desc" } },
  { category_id: "1014", category_name: "Phim Trung Quốc & HK", parent_id: 0, query: { with_original_language: "zh", sort_by: "popularity.desc" } },
];

/**
 * Get VOD Movie Categories
 */
async function getVodCategories(apiKey) {
  return VOD_CATEGORIES.map(c => ({
    category_id: c.category_id,
    category_name: c.category_name,
    parent_id: 0,
  }));
}

/**
 * Helper to check if a categoryId represents "all" categories
 */
function isAllCategory(catId) {
  if (catId === undefined || catId === null) return true;
  const s = String(catId).trim().toLowerCase();
  return (
    s === "" ||
    s === "0" ||
    s === "all" ||
    s === "*" ||
    s === "-1" ||
    s === "none"
  );
}

const CURATED_YEARS = new Set(["2023", "2024", "2025", "2026"]);
const localCatalogCache = new Map(); // type -> { mtimeMs, catalog }

function settledValues(promises) {
  return Promise.allSettled(promises).then(results =>
    results
      .filter(r => r.status === "fulfilled" && r.value !== undefined && r.value !== null)
      .map(r => r.value)
  );
}

function isReleasedDate(dateStr, todayStr) {
  if (!dateStr || typeof dateStr !== "string") return false;
  const clean = dateStr.trim().substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
  return clean <= todayStr;
}

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

async function fetchPagedTmdb(endpoint, params, maxPages, apiKey) {
  const first = await fetchTmdb(endpoint, { ...params, page: "1" }, apiKey);
  const firstItems = first?.results || [];
  const totalPages = Math.min(maxPages, Math.max(1, Number(first?.total_pages || 1)));
  if (totalPages <= 1) {
    return { items: dedupeById(firstItems), totalResults: Number(first?.total_results || firstItems.length) };
  }
  const restPages = [];
  for (let p = 2; p <= totalPages; p++) {
    restPages.push(fetchTmdb(endpoint, { ...params, page: String(p) }, apiKey));
  }
  const restResponses = await settledValues(restPages);
  const combined = [...firstItems, ...restResponses.flatMap(r => r?.results || [])];
  return {
    items: dedupeById(combined),
    totalResults: Number(first?.total_results || combined.length),
  };
}

function indexCatalog(raw) {
  if (!raw || !Array.isArray(raw.items)) return null;
  const itemById = new Map();
  for (const item of raw.items) {
    const id = Number(item.stream_id || item.series_id);
    if (Number.isFinite(id) && id > 0) {
      itemById.set(id, item);
    }
  }
  return { ...raw, itemById };
}

function loadLocalCatalog(type) {
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "..", "public", "catalog", `${type}.json`);
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const cached = localCatalogCache.get(type);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.catalog;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const indexed = indexCatalog(parsed);
    if (indexed) {
      localCatalogCache.set(type, { mtimeMs: stat.mtimeMs, catalog: indexed });
    }
    return indexed;
  } catch (_) {
    return null;
  }
}

async function resolveCatalog(type, catalogLoader) {
  try {
    if (type === "vod" && typeof catalogLoader?.getVodCatalog === "function") {
      const cat = await catalogLoader.getVodCatalog();
      if (cat?.itemById) return cat;
      if (cat) return indexCatalog(cat);
    }
    if (type === "series" && typeof catalogLoader?.getSeriesCatalog === "function") {
      const cat = await catalogLoader.getSeriesCatalog();
      if (cat?.itemById) return cat;
      if (cat) return indexCatalog(cat);
    }
  } catch (_) {}
  return loadLocalCatalog(type);
}

function serveFromCatalog(catalog, categoryId, page, hasPageParam) {
  let fullList = [];
  if (isAllCategory(categoryId)) {
    fullList = catalog.items || [];
  } else {
    const catKey = String(categoryId);
    const ids = catalog.byCategory?.[catKey] || [];
    for (const id of ids) {
      const item = catalog.itemById?.get(Number(id));
      if (item) {
        fullList.push({ ...item, category_id: catKey });
      }
    }
  }

  const sliced = hasPageParam
    ? fullList.slice((page - 1) * 20, page * 20)
    : fullList;
  const baseNum = hasPageParam ? (page - 1) * 20 : 0;
  const result = sliced.map((item, idx) => ({ ...item, num: baseNum + idx + 1 }));
  Object.defineProperty(result, "_totalCount", {
    value: fullList.length,
    enumerable: false,
  });
  return result;
}

function searchLocalCatalog(catalog, query) {
  if (!catalog?.items || !query) return [];
  const q = query.trim().toLowerCase();
  return catalog.items.filter(it =>
    String(it.title || it.name || "").toLowerCase().includes(q)
  );
}

function mapVodItem(m, idx, primaryCatId, categoryIdsSet = null) {
  const year = m.release_date ? m.release_date.substring(0, 4) : "";
  const parsedMs = m.release_date ? Date.parse(m.release_date) : NaN;
  const addedTs = Number.isFinite(parsedMs) ? Math.max(0, Math.floor(parsedMs / 1000)) : 0;
  const rawCatIds = categoryIdsSet
    ? Array.from(categoryIdsSet)
    : [primaryCatId, CURATED_YEARS.has(year) ? year : null].filter(Boolean);
  const categoryIds = Array.from(
    new Set(rawCatIds.map(id => Number(id)).filter(n => Number.isFinite(n) && n > 0))
  );

  return {
    num: idx + 1,
    name: year ? `${m.title} (${year})` : m.title,
    title: m.title,
    year,
    stream_type: "movie",
    stream_id: m.id,
    stream_icon: m.poster_path ? `${TMDB_IMAGE_BASE}/w500${m.poster_path}` : "",
    rating: String(m.vote_average || 0),
    rating_5based: Number(((m.vote_average || 0) / 2).toFixed(1)),
    added: String(addedTs),
    category_id: String(primaryCatId),
    category_ids: categoryIds,
    container_extension: "mp4",
    custom_sid: "",
    direct_source: "",
  };
}

function mapSeriesItem(s, idx, primaryCatId, categoryIdsSet = null) {
  const year = s.first_air_date ? s.first_air_date.substring(0, 4) : "";
  const parsedMs = s.first_air_date ? Date.parse(s.first_air_date) : NaN;
  const airDateTs = s.first_air_date
    ? String(Number.isFinite(parsedMs) ? Math.max(0, Math.floor(parsedMs / 1000)) : 0)
    : String(Math.floor(Date.now() / 1000));
  const rawCatIds = categoryIdsSet
    ? Array.from(categoryIdsSet)
    : [primaryCatId, CURATED_YEARS.has(year) ? year : null].filter(Boolean);
  const categoryIds = Array.from(
    new Set(rawCatIds.map(id => Number(id)).filter(n => Number.isFinite(n) && n > 0))
  );
  const iconUrl = s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : "";

  const rawPlot = String(s.overview || "").trim();
  const compactPlot = rawPlot.length > 180 ? `${rawPlot.slice(0, 177).trimEnd()}...` : rawPlot;

  return {
    num: idx + 1,
    name: year ? `${s.name} (${year})` : s.name,
    title: s.name,
    year,
    stream_type: "series",
    stream_id: s.id,
    series_id: s.id,
    cover: iconUrl,
    stream_icon: iconUrl,
    category_id: String(primaryCatId),
    category_ids: categoryIds,
    plot: compactPlot,
    cast: "",
    director: "",
    genre: "",
    releaseDate: s.first_air_date || "",
    last_modified: airDateTs,
    added: airDateTs,
    rating: String(s.vote_average || 0),
    rating_5based: Number(((s.vote_average || 0) / 2).toFixed(1)),
    backdrop_path: s.backdrop_path ? [`${TMDB_IMAGE_BASE}/w1280${s.backdrop_path}`] : [],
    youtube_trailer: "",
    episode_run_time: "45",
  };
}

const CANNES_FESTIVAL_MOVIE_IDS = [
  915935, 497828, 505192, 423, 680, 28, 103, 8967,
  86837, 448776, 266034, 374473, 582, 517814, 194, 496243,
];

const EMMY_GLOBE_SERIES_IDS = [
  126308, 136315, 76331, 95396, 111803, 241259, 100757, 154385,
  194764, 100088, 95480, 83867, 93405, 97546, 124101, 125935,
  87739, 87108, 65494, 79788, 67070, 61662, 70796, 69478,
  66292, 60622, 60059, 46648, 1399, 1396, 1104, 1398, 1438, 4613,
];

async function fetchSpecialVodCategory(special, apiKey) {
  if (special === "award_winning") {
    const [oscarPages, cannesMovies] = await Promise.all([
      settledValues([1, 2, 3, 4, 5].map(p => fetchTmdb("/list/28", { page: String(p) }, apiKey))),
      settledValues(CANNES_FESTIVAL_MOVIE_IDS.map(id => fetchTmdb(`/movie/${id}`, {}, apiKey))),
    ]);
    const listItems = oscarPages.flatMap(r => r?.items || []);
    const merged = dedupeById([...cannesMovies, ...listItems]);
    merged.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
    return merged;
  }
  if (special === "harry_potter") {
    const cols = await settledValues([
      fetchTmdb("/collection/1241", {}, apiKey),
      fetchTmdb("/collection/435259", {}, apiKey),
    ]);
    return dedupeById(cols.flatMap(c => c?.parts || []));
  }
  if (special === "lotr") {
    const cols = await settledValues([
      fetchTmdb("/collection/119", {}, apiKey),
      fetchTmdb("/collection/121938", {}, apiKey),
    ]);
    return dedupeById(cols.flatMap(c => c?.parts || []));
  }
  if (special === "fast_and_furious") {
    const col = await fetchTmdb("/collection/9485", {}, apiKey);
    return dedupeById(col?.parts || []);
  }
  if (special === "monsterverse") {
    const res = await settledValues([
      fetchTmdb("/collection/535313", {}, apiKey),
      fetchTmdb("/search/movie", { query: "Godzilla" }, apiKey),
      fetchTmdb("/search/movie", { query: "Kong" }, apiKey),
    ]);
    const colParts = res[0]?.parts || [];
    const searchItems = res.slice(1).flatMap(r => r?.results || []).filter(
      m => (m.vote_count || 0) >= 50 && !(m.genre_ids || []).includes(99)
    );
    return dedupeById([...colParts, ...searchItems]);
  }
  if (special === "james_bond") {
    const col = await fetchTmdb("/collection/645", {}, apiKey);
    return dedupeById(col?.parts || []);
  }
  return [];
}

async function fetchSpecialSeriesCategory(special, apiKey) {
  if (special === "award_winning_tv") {
    const collected = [];
    for (let i = 0; i < EMMY_GLOBE_SERIES_IDS.length; i += 8) {
      const batch = EMMY_GLOBE_SERIES_IDS.slice(i, i + 8);
      const res = await settledValues(batch.map(id => fetchTmdb(`/tv/${id}`, {}, apiKey)));
      collected.push(...res.filter(s => s?.id && s?.name));
    }
    const merged = dedupeById(collected);
    merged.sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));
    return merged;
  }
  if (special === "got_lotr") {
    const res = await settledValues([
      fetchTmdb("/search/tv", { query: "Game of Thrones" }, apiKey),
      fetchTmdb("/search/tv", { query: "House of the Dragon" }, apiKey),
      fetchTmdb("/search/tv", { query: "The Rings of Power" }, apiKey),
      fetchTmdb("/search/tv", { query: "The Witcher" }, apiKey),
    ]);
    const filtered = res.flatMap(r => r?.results || []).filter(
      s => (s.vote_count || 0) >= 20 && !(s.genre_ids || []).includes(99)
    );
    return dedupeById(filtered);
  }
  return [];
}

function encodeEpisodeId(seriesId, seasonNum, episodeNum) {
  const sid = Number(seriesId);
  const s = Number(seasonNum);
  const e = Number(episodeNum);
  if (Number.isFinite(sid) && s >= 0 && s < 100 && e >= 0 && e < 100) {
    return String(sid * 10000 + s * 100 + e);
  }
  return (
    "8" +
    String(Math.max(0, sid)).padStart(7, "0") +
    String(Math.max(0, s)).padStart(3, "0") +
    String(Math.max(0, e)).padStart(4, "0")
  );
}

function decodeEpisodeId(rawStream) {
  const str = String(rawStream || "").trim();
  const delimMatch = str.match(/^(\d+)[_-](\d+)[_-](\d+)/);
  if (delimMatch) {
    return {
      seriesId: parseInt(delimMatch[1], 10),
      season: parseInt(delimMatch[2], 10),
      episode: parseInt(delimMatch[3], 10),
    };
  }

  const numMatch = str.match(/^(\d+)/);
  if (!numMatch) return null;

  const digits = numMatch[1];
  if (digits.length === 15 && digits.startsWith("8")) {
    return {
      seriesId: parseInt(digits.slice(1, 8), 10),
      season: parseInt(digits.slice(8, 11), 10),
      episode: parseInt(digits.slice(11, 15), 10),
    };
  }

  const episodeId = parseInt(digits, 10);
  if (!Number.isFinite(episodeId)) return null;
  return {
    seriesId: Math.floor(episodeId / 10000),
    season: Math.floor((episodeId % 10000) / 100),
    episode: episodeId % 100,
  };
}

async function fetchVodCategoryItems(categoryId, apiKey, { maxPages = 6, today = new Date().toISOString().split("T")[0] } = {}) {
  const catIdStr = String(categoryId);
  const catDef = VOD_CATEGORIES.find(c => c.category_id === catIdStr);

  if (catDef?.query?.special) {
    const raw = await fetchSpecialVodCategory(catDef.query.special, apiKey);
    return raw.filter(m => isReleasedDate(m.release_date, today));
  }

  if (["2026", "2025", "2024", "2023"].includes(catIdStr)) {
    const baseYear = { primary_release_year: catIdStr, "primary_release_date.lte": today };
    const [revPages, votePages, popPages] = await Promise.all([
      settledValues([1, 2, 3, 4].map(p => fetchTmdb("/discover/movie", { ...baseYear, sort_by: "revenue.desc", page: String(p) }, apiKey))),
      settledValues([1, 2, 3, 4].map(p => fetchTmdb("/discover/movie", { ...baseYear, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
      settledValues([1, 2, 3, 4].map(p => fetchTmdb("/discover/movie", { ...baseYear, sort_by: "popularity.desc", "vote_count.gte": catIdStr >= "2025" ? "10" : "50", page: String(p) }, apiKey))),
    ]);
    const combined = dedupeById([
      ...revPages.flatMap(r => r?.results || []),
      ...votePages.flatMap(r => r?.results || []),
      ...popPages.flatMap(r => r?.results || []),
    ]);
    return combined.filter(m => isReleasedDate(m.release_date, today) && (m.vote_count || 0) > 0);
  }

  if (["1012", "1013", "1014"].includes(catIdStr)) {
    const lang = catDef?.query?.with_original_language || "ko|zh|ja|th|vi";
    const [votePages, popPages] = await Promise.all([
      settledValues([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/movie", { with_original_language: lang, "primary_release_date.lte": today, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
      settledValues([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/movie", { with_original_language: lang, "primary_release_date.lte": today, sort_by: "popularity.desc", "vote_count.gte": "20", page: String(p) }, apiKey))),
    ]);
    const combined = dedupeById([
      ...votePages.flatMap(r => r?.results || []),
      ...popPages.flatMap(r => r?.results || []),
    ]);
    return combined.filter(m => isReleasedDate(m.release_date, today) && (m.vote_count || 0) > 0);
  }

  let endpoint = "/discover/movie";
  let baseParams = {
    sort_by: "primary_release_date.desc",
    "primary_release_date.lte": today,
    "vote_count.gte": "5",
  };
  if (catDef) {
    const { endpoint: catEndpoint, special: _sp, ...cleanQuery } = catDef.query || {};
    if (catEndpoint) {
      endpoint = catEndpoint;
      baseParams = { ...cleanQuery };
    } else {
      Object.assign(baseParams, cleanQuery);
    }
  } else {
    baseParams.with_genres = catIdStr;
  }

  const { items } = await fetchPagedTmdb(endpoint, baseParams, maxPages, apiKey);
  return items.filter(m => isReleasedDate(m.release_date, today) && (m.vote_count || 0) > 0);
}

/**
 * Get VOD Movie Streams (sorted from newest to oldest, optionally filtered by category_id or search keyword)
 */
async function getVodStreams(categoryId, apiKey, page = 1, search = "", hasPageParam = false, catalogLoader = null) {
  try {
    const today = new Date().toISOString().split("T")[0];
    let results = [];
    let totalCount = null;

    if (search && search.trim()) {
      const pagesToFetch = hasPageParam ? [page] : [1, 2, 3];
      const responses = await settledValues(
        pagesToFetch.map(p => fetchTmdb("/search/movie", { query: search.trim(), page: String(p) }, apiKey))
      );
      if (hasPageParam) {
        totalCount = Math.min(10000, Number(responses[0]?.total_results || 0));
      }
      results = dedupeById(responses.flatMap(r => r?.results || []));
      if (!results.length) {
        const catalog = await resolveCatalog("vod", catalogLoader);
        const localHits = searchLocalCatalog(catalog, search);
        const sliced = hasPageParam ? localHits.slice((page - 1) * 20, page * 20) : localHits;
        const baseNum = hasPageParam ? (page - 1) * 20 : 0;
        const out = sliced.map((it, idx) => ({ ...it, num: baseNum + idx + 1 }));
        Object.defineProperty(out, "_totalCount", { value: localHits.length, enumerable: false });
        return out;
      }
    } else {
      const catalog = await resolveCatalog("vod", catalogLoader);
      const catKey = String(categoryId || "");
      if (catalog && (isAllCategory(categoryId) || Array.isArray(catalog.byCategory?.[catKey]))) {
        return serveFromCatalog(catalog, categoryId, page, hasPageParam);
      }

      if (hasPageParam) {
        if (!isAllCategory(categoryId)) {
          const catDef = VOD_CATEGORIES.find(c => c.category_id === catKey);
          if (catDef?.query?.special) {
            const unique = (await fetchSpecialVodCategory(catDef.query.special, apiKey))
              .filter(m => isReleasedDate(m.release_date, today));
            totalCount = unique.length;
            results = unique.slice((page - 1) * 20, page * 20);
          } else {
            let endpoint = "/discover/movie";
            let baseParams = { sort_by: "primary_release_date.desc", "primary_release_date.lte": today, "vote_count.gte": "5" };
            if (catDef) {
              const { endpoint: catEndpoint, special: _sp, ...cleanQuery } = catDef.query || {};
              if (catEndpoint) { endpoint = catEndpoint; baseParams = { ...cleanQuery }; }
              else Object.assign(baseParams, cleanQuery);
            } else {
              baseParams.with_genres = catKey;
            }
            const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
            results = json?.results || [];
            totalCount = Math.min(10000, Number(json?.total_results || results.length));
          }
        } else {
          const json = await fetchTmdb("/discover/movie", { sort_by: "primary_release_date.desc", "primary_release_date.lte": today, "vote_count.gte": "5", page: String(page) }, apiKey);
          results = json?.results || [];
          totalCount = Math.min(10000, Number(json?.total_results || results.length));
        }
      } else if (!isAllCategory(categoryId)) {
        results = await fetchVodCategoryItems(categoryId, apiKey, { maxPages: 6, today });
      } else {
        const batches = await settledValues(
          VOD_CATEGORIES.map(async (cat) => ({
            catId: cat.category_id,
            items: (await fetchVodCategoryItems(cat.category_id, apiKey, { maxPages: 1, today })).slice(0, 20),
          }))
        );
        const itemMap = new Map();
        for (const batch of batches) {
          for (const item of batch.items) {
            const existing = itemMap.get(item.id);
            if (existing) {
              existing._categoryIdsSet.add(batch.catId);
            } else {
              itemMap.set(item.id, { ...item, _assignedCatId: batch.catId, _categoryIdsSet: new Set([batch.catId]) });
            }
          }
        }
        results = Array.from(itemMap.values());
        results.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
      }
    }

    const baseNum = hasPageParam ? (page - 1) * 20 : 0;
    const mapped = results.map((m, idx) => {
      const year = m.release_date ? m.release_date.substring(0, 4) : "";
      let primaryCatId = m._assignedCatId || "2026";
      if (!isAllCategory(categoryId)) {
        primaryCatId = String(categoryId);
      } else if (!m._assignedCatId) {
        if (CURATED_YEARS.has(year)) primaryCatId = year;
        else if (parseInt(year, 10) < 2023) primaryCatId = "1006";
      }
      const item = mapVodItem(m, baseNum + idx, primaryCatId, m._categoryIdsSet || null);
      return item;
    });
    Object.defineProperty(mapped, "_totalCount", {
      value: hasPageParam ? (totalCount !== null ? totalCount : mapped.length) : mapped.length,
      enumerable: false,
    });
    return mapped;
  } catch (err) {
    console.error("Error fetching VOD streams:", err.message);
    return [];
  }
}

/**
 * Get VOD Info (Details for a specific movie)
 */
async function getVodInfo(tmdbId, apiKey, catalogLoader = null) {
  try {
    const [m, catalog] = await Promise.all([
      fetchTmdb(`/movie/${tmdbId}`, { append_to_response: "credits,translations" }, apiKey),
      resolveCatalog("vod", catalogLoader),
    ]);
    const catalogItem = catalog?.itemById?.get(Number(tmdbId));
    const year = m.release_date ? m.release_date.substring(0, 4) : "";
    const cast = (m.credits?.cast || []).slice(0, 5).map(c => c.name).join(", ");
    const director = (m.credits?.crew || []).find(c => c.job === "Director")?.name || "";
    const genre = (m.genres || []).map(g => g.name).join(", ");

    // Prefer Vietnamese translation for description/plot if available; fallback to English
    const viOverview = m.translations?.translations?.find(t => t.iso_639_1 === "vi")?.data?.overview;
    const overview = viOverview || m.overview || "";

    return {
      info: {
        kinopoisk_url: `https://www.themoviedb.org/movie/${tmdbId}`,
        tmdb_id: tmdbId,
        name: m.title, // English title for easy subtitle search
        o_name: m.original_title,
        cover_big: m.poster_path ? `${TMDB_IMAGE_BASE}/w780${m.poster_path}` : "",
        movie_image: m.poster_path ? `${TMDB_IMAGE_BASE}/w500${m.poster_path}` : "",
        backdrop_path: m.backdrop_path ? [`${TMDB_IMAGE_BASE}/w1280${m.backdrop_path}`] : [],
        release_date: m.release_date || "",
        releasedate: m.release_date || "",
        episode_run_time: m.runtime ? String(m.runtime) : "120",
        duration: m.runtime ? `${m.runtime} min` : "120 min",
        duration_secs: (m.runtime || 120) * 60,
        youtube_trailer: "",
        director,
        actors: cast,
        cast,
        description: overview,
        plot: overview,
        age: "",
        country: (m.production_countries || []).map(c => c.name).join(", "),
        genre,
        rating: String(m.vote_average || 0),
        rating_5based: Number(((m.vote_average || 0) / 2).toFixed(1)),
        rating_count_kinopoisk: m.vote_count || 0,
        subtitles: [],
      },
      movie_data: {
        stream_id: m.id,
        name: year ? `${m.title} (${year})` : m.title,
        title: m.title,
        year,
        added: catalogItem?.added || String(Math.floor(Date.now() / 1000)),
        category_id: catalogItem?.category_id || (CURATED_YEARS.has(year) ? year : "1006"),
        container_extension: "mp4",
        custom_sid: "",
        direct_source: "",
      },
    };
  } catch (err) {
    console.error(`Error fetching VOD info for ${tmdbId}:`, err.message);
    return {};
  }
}

/**
 * Curated Series Categories (TV Shows by year, Streaming Platforms, All-Time Acclaimed)
 */
const SERIES_CATEGORIES = [
  { category_id: "1000", category_name: "🔥 Series Thịnh Hành (Hot Tuần)", parent_id: 0, query: { endpoint: "/trending/tv/week" } },
  { category_id: "2026", category_name: "Series 2026", parent_id: 0, query: { first_air_date_year: "2026", sort_by: "popularity.desc" } },
  { category_id: "2025", category_name: "Series 2025 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2025", sort_by: "popularity.desc" } },
  { category_id: "2024", category_name: "Series 2024 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2024", sort_by: "popularity.desc" } },
  { category_id: "2023", category_name: "Series 2023 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2023", sort_by: "popularity.desc" } },

  // Phim bộ Việt Nam
  { category_id: "1023", category_name: "Phim Bộ & Truyền Hình Việt Nam", parent_id: 0, query: { with_original_language: "vi", "vote_count.gte": "0", sort_by: "popularity.desc" } },

  // Vũ trụ điện ảnh & Thương hiệu đình đám (Franchises & Cinematic Universes)
  { category_id: "1015", category_name: "Series Marvel (MCU)", parent_id: 0, query: { with_companies: "420|7505", sort_by: "popularity.desc" } },
  { category_id: "1016", category_name: "Series Star Wars", parent_id: 0, query: { with_companies: "1", sort_by: "popularity.desc" } },
  { category_id: "1017", category_name: "Series DC Universe", parent_id: 0, query: { with_companies: "9993|429|128064", sort_by: "popularity.desc" } },
  { category_id: "1019", category_name: "Series Game of Thrones & LOTR", parent_id: 0, query: { special: "got_lotr", sort_by: "popularity.desc" } },

  // Tuyệt tác, Giải thưởng & Hoạt hình đỉnh cao
  { category_id: "1040", category_name: "🏆 Series Đoạt Giải (Emmy & Quả Cầu Vàng)", parent_id: 0, query: { special: "award_winning_tv" } },
  { category_id: "1041", category_name: "📖 Series Dựa Trên Chuyện Có Thật", parent_id: 0, query: { with_keywords: "9672", "vote_average.gte": "7.0", "vote_count.gte": "50", sort_by: "popularity.desc" } },
  { category_id: "1042", category_name: "🧠 Series Hại Não & Plot Twist", parent_id: 0, query: { with_keywords: "275311|326438|184312|12565|335567", "vote_average.gte": "7.0", "vote_count.gte": "50", sort_by: "vote_count.desc" } },
  { category_id: "1025", category_name: "Series Tuyệt Tác IMDb Top", parent_id: 0, query: { sort_by: "vote_average.desc", "vote_count.gte": "1500" } },
  { category_id: "1006", category_name: "Series Bom Tấn Đỉnh Cao", parent_id: 0, query: { sort_by: "vote_count.desc", "vote_average.gte": "7.5", "vote_count.gte": "500" } },
  { category_id: "1007", category_name: "Series Anime / Hoạt Hình", parent_id: 0, query: { with_genres: "16", sort_by: "popularity.desc" } },
  { category_id: "1011", category_name: "Anime Crunchyroll", parent_id: 0, query: { with_watch_providers: "283", watch_region: "US", sort_by: "popularity.desc" } },

  // Thể loại chính (Core TV Genres)
  { category_id: "1050", category_name: "💥 Series Hành Động & Phiêu Lưu", parent_id: 0, query: { with_genres: "10759", "vote_count.gte": "100", sort_by: "popularity.desc" } },
  { category_id: "1051", category_name: "🚀 Series Viễn Tưởng & Kỳ Ảo", parent_id: 0, query: { with_genres: "10765", "vote_count.gte": "100", sort_by: "popularity.desc" } },
  { category_id: "1053", category_name: "😂 Series Hài Hước / Sitcom", parent_id: 0, query: { with_genres: "35", "vote_count.gte": "100", sort_by: "popularity.desc" } },
  { category_id: "1054", category_name: "🕵️ Series Hình Sự & Trinh Thám", parent_id: 0, query: { with_genres: "80|9648", "vote_count.gte": "100", sort_by: "popularity.desc" } },
  { category_id: "1055", category_name: "❤️ Series Tâm Lý", parent_id: 0, query: { with_genres: "18", "vote_count.gte": "150", sort_by: "popularity.desc" } },
  { category_id: "1057", category_name: "🌍 Series Tài Liệu & Khám Phá", parent_id: 0, query: { with_genres: "99", "vote_count.gte": "50", sort_by: "popularity.desc" } },

  // Thiếu nhi & Hoạt hình theo lứa tuổi (Kids & Family by Age)
  { category_id: "1030", category_name: "👶 Series Mầm Non (0-5 tuổi)", parent_id: 0, query: { certification_country: "US", certification: "TV-Y", with_genres: "10762|16", sort_by: "popularity.desc" } },
  { category_id: "1031", category_name: "🧒 Series Thiếu Nhi (6-11 tuổi)", parent_id: 0, query: { certification_country: "US", certification: "TV-Y7|TV-G", with_genres: "10762|16", sort_by: "popularity.desc" } },
  { category_id: "1032", category_name: "🧑‍🎓 Series Thiếu Niên & Teen (12+)", parent_id: 0, query: { with_genres: "16,10759", sort_by: "popularity.desc" } },
  { category_id: "1033", category_name: "🏰 Series Hoạt Hình Disney", parent_id: 0, query: { with_networks: "54|2739|255", with_genres: "10762|16", sort_by: "popularity.desc" } },

  // Nền tảng phát hành toàn cầu
  { category_id: "1001", category_name: "Series Peacock", parent_id: 0, query: { with_watch_providers: "386|387", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1002", category_name: "Series Netflix", parent_id: 0, query: { with_watch_providers: "8", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1003", category_name: "Series HBO Max", parent_id: 0, query: { with_watch_providers: "1899|384", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1008", category_name: "Series Amazon Prime", parent_id: 0, query: { with_watch_providers: "9|119", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1009", category_name: "Series Paramount+", parent_id: 0, query: { with_watch_providers: "531|2303|2616|582", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1010", category_name: "Series Hulu", parent_id: 0, query: { with_watch_providers: "15", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1004", category_name: "Series Disney+", parent_id: 0, query: { with_watch_providers: "337", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1005", category_name: "Series Apple TV+", parent_id: 0, query: { with_watch_providers: "350", watch_region: "US", sort_by: "popularity.desc" } },

  // Điện ảnh Châu Á
  { category_id: "1012", category_name: "Series Châu Á Nổi Bật", parent_id: 0, query: { with_original_language: "ko|zh|ja|th|vi", sort_by: "popularity.desc" } },
  { category_id: "1013", category_name: "Series Hàn Quốc (K-Drama)", parent_id: 0, query: { with_original_language: "ko", sort_by: "popularity.desc" } },
  { category_id: "1014", category_name: "Series Trung Quốc (C-Drama)", parent_id: 0, query: { with_original_language: "zh", sort_by: "popularity.desc" } },
];

/**
 * Get Series Categories
 */
async function getSeriesCategories(apiKey) {
  return SERIES_CATEGORIES.map(c => ({
    category_id: c.category_id,
    category_name: c.category_name,
    parent_id: 0,
  }));
}

async function fetchSeriesCategoryItems(categoryId, apiKey, { maxPages = 6, today = new Date().toISOString().split("T")[0] } = {}) {
  const catIdStr = String(categoryId);
  const catDef = SERIES_CATEGORIES.find(c => c.category_id === catIdStr);

  if (catDef?.query?.special) {
    const raw = await fetchSpecialSeriesCategory(catDef.query.special, apiKey);
    return raw.filter(s => !s.first_air_date || isReleasedDate(s.first_air_date, today));
  }

  if (["2026", "2025", "2024", "2023"].includes(catIdStr)) {
    const baseYear = { first_air_date_year: catIdStr, "first_air_date.lte": today };
    const [votePages, popPages] = await Promise.all([
      settledValues([1, 2, 3, 4].map(p => fetchTmdb("/discover/tv", { ...baseYear, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
      settledValues([1, 2, 3, 4].map(p => fetchTmdb("/discover/tv", { ...baseYear, sort_by: "popularity.desc", "vote_count.gte": "10", page: String(p) }, apiKey))),
    ]);
    const combined = dedupeById([
      ...votePages.flatMap(r => r?.results || []),
      ...popPages.flatMap(r => r?.results || []),
    ]);
    return combined.filter(s => isReleasedDate(s.first_air_date, today) && (s.vote_count || 0) > 0);
  }

  if (["1012", "1013", "1014"].includes(catIdStr)) {
    const lang = catDef?.query?.with_original_language || "ko|zh|ja|th|vi";
    const [votePages, popPages] = await Promise.all([
      settledValues([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/tv", { with_original_language: lang, "first_air_date.lte": today, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
      settledValues([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/tv", { with_original_language: lang, "first_air_date.lte": today, sort_by: "popularity.desc", "vote_count.gte": "10", page: String(p) }, apiKey))),
    ]);
    const combined = dedupeById([
      ...votePages.flatMap(r => r?.results || []),
      ...popPages.flatMap(r => r?.results || []),
    ]);
    return combined.filter(s => isReleasedDate(s.first_air_date, today) && (s.vote_count || 0) > 0);
  }

  let endpoint = "/discover/tv";
  let baseParams = {
    sort_by: "first_air_date.desc",
    "first_air_date.lte": today,
    "vote_count.gte": "5",
  };
  if (catDef) {
    const { endpoint: catEndpoint, special: _sp, ...cleanQuery } = catDef.query || {};
    if (catEndpoint) {
      endpoint = catEndpoint;
      baseParams = { ...cleanQuery };
    } else {
      Object.assign(baseParams, cleanQuery);
    }
  } else {
    baseParams.with_genres = catIdStr;
  }

  const { items } = await fetchPagedTmdb(endpoint, baseParams, maxPages, apiKey);
  const filtered = items.filter(s =>
    isReleasedDate(s.first_air_date, today) &&
    (catIdStr === "1023" ? Boolean(s.poster_path) : (s.vote_count || 0) > 0)
  );

  if (catIdStr === "1001" && !filtered.some(s => s.id === 120998)) {
    try {
      const pf = await fetchTmdb("/tv/120998", {}, apiKey);
      if (pf?.id) filtered.unshift(pf);
    } catch (_) {}
  }

  return filtered;
}

/**
 * Get Series Streams (TV Shows catalog, sorted from newest to oldest, optionally filtered by category_id or search keyword)
 */
async function getSeriesStreams(categoryId, apiKey, page = 1, search = "", hasPageParam = false, catalogLoader = null) {
  try {
    const today = new Date().toISOString().split("T")[0];
    let results = [];
    let totalCount = null;

    if (search && search.trim()) {
      const pagesToFetch = hasPageParam ? [page] : [1, 2, 3];
      const responses = await settledValues(
        pagesToFetch.map(p => fetchTmdb("/search/tv", { query: search.trim(), page: String(p) }, apiKey))
      );
      if (hasPageParam) {
        totalCount = Math.min(10000, Number(responses[0]?.total_results || 0));
      }
      results = dedupeById(responses.flatMap(r => r?.results || []));
      if (!results.length) {
        const catalog = await resolveCatalog("series", catalogLoader);
        const localHits = searchLocalCatalog(catalog, search);
        const sliced = hasPageParam ? localHits.slice((page - 1) * 20, page * 20) : localHits;
        const baseNum = hasPageParam ? (page - 1) * 20 : 0;
        const out = sliced.map((it, idx) => ({ ...it, num: baseNum + idx + 1 }));
        Object.defineProperty(out, "_totalCount", { value: localHits.length, enumerable: false });
        return out;
      }
    } else {
      const catalog = await resolveCatalog("series", catalogLoader);
      const catKey = String(categoryId || "");
      if (catalog && (isAllCategory(categoryId) || Array.isArray(catalog.byCategory?.[catKey]))) {
        return serveFromCatalog(catalog, categoryId, page, hasPageParam);
      }

      if (hasPageParam) {
        if (!isAllCategory(categoryId)) {
          const catDef = SERIES_CATEGORIES.find(c => c.category_id === catKey);
          if (catDef?.query?.special) {
            const unique = (await fetchSpecialSeriesCategory(catDef.query.special, apiKey))
              .filter(s => !s.first_air_date || isReleasedDate(s.first_air_date, today));
            totalCount = unique.length;
            results = unique.slice((page - 1) * 20, page * 20);
          } else {
            let endpoint = "/discover/tv";
            let baseParams = { sort_by: "first_air_date.desc", "first_air_date.lte": today, "vote_count.gte": "5" };
            if (catDef) {
              const { endpoint: catEndpoint, special: _sp, ...cleanQuery } = catDef.query || {};
              if (catEndpoint) { endpoint = catEndpoint; baseParams = { ...cleanQuery }; }
              else Object.assign(baseParams, cleanQuery);
            } else {
              baseParams.with_genres = catKey;
            }
            const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
            results = json?.results || [];
            totalCount = Math.min(10000, Number(json?.total_results || results.length));
          }
        } else {
          const json = await fetchTmdb("/discover/tv", { sort_by: "first_air_date.desc", "first_air_date.lte": today, "vote_count.gte": "5", page: String(page) }, apiKey);
          results = json?.results || [];
          totalCount = Math.min(10000, Number(json?.total_results || results.length));
        }
      } else if (!isAllCategory(categoryId)) {
        results = await fetchSeriesCategoryItems(categoryId, apiKey, { maxPages: 6, today });
      } else {
        const batches = await settledValues(
          SERIES_CATEGORIES.map(async (cat) => ({
            catId: cat.category_id,
            items: (await fetchSeriesCategoryItems(cat.category_id, apiKey, { maxPages: 1, today })).slice(0, 20),
          }))
        );
        const itemMap = new Map();
        for (const batch of batches) {
          for (const item of batch.items) {
            const existing = itemMap.get(item.id);
            if (existing) {
              existing._categoryIdsSet.add(batch.catId);
            } else {
              itemMap.set(item.id, { ...item, _assignedCatId: batch.catId, _categoryIdsSet: new Set([batch.catId]) });
            }
          }
        }
        const existingPf = itemMap.get(120998);
        if (existingPf) {
          existingPf._categoryIdsSet.add("1001");
        } else {
          try {
            const pf = await fetchTmdb("/tv/120998", {}, apiKey);
            if (pf?.id) {
              itemMap.set(pf.id, { ...pf, _assignedCatId: "1001", _categoryIdsSet: new Set(["1001"]) });
            }
          } catch (_) {}
        }
        results = Array.from(itemMap.values());
        results.sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));
      }
    }

    const baseNum = hasPageParam ? (page - 1) * 20 : 0;
    const mapped = results.map((s, idx) => {
      const year = s.first_air_date ? s.first_air_date.substring(0, 4) : "";
      let primaryCatId = s._assignedCatId || "2026";
      if (!isAllCategory(categoryId)) {
        primaryCatId = String(categoryId);
      } else if (!s._assignedCatId) {
        if (CURATED_YEARS.has(year)) primaryCatId = year;
        else if (parseInt(year, 10) < 2023) primaryCatId = "1006";
      }
      return mapSeriesItem(s, baseNum + idx, primaryCatId, s._categoryIdsSet || null);
    });
    Object.defineProperty(mapped, "_totalCount", {
      value: hasPageParam ? (totalCount !== null ? totalCount : mapped.length) : mapped.length,
      enumerable: false,
    });
    return mapped;
  } catch (err) {
    console.error("Error fetching series streams:", err.message);
    return [];
  }
}

const BROAD_CATALOG_CATEGORIES = new Set([
  "1000", "1001", "1002", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1010", "1011",
  "1012", "1013", "1014", "1025", "1041", "1050", "1051", "1052", "1053", "1054", "1055", "1056", "1057",
  "2023", "2024", "2025", "2026",
]);

async function buildFullCatalog({ categories, fetchCategory, mapItem, apiKey }) {
  const today = new Date().toISOString().split("T")[0];
  const itemMap = new Map();
  const byCategory = {};

  // Process categories in controlled batches of 4 to avoid TMDB rate limits
  for (let i = 0; i < categories.length; i += 4) {
    const batch = categories.slice(i, i + 4);
    const batchResults = await settledValues(
      batch.map(async (cat) => ({
        catId: cat.category_id,
        list: await fetchCategory(cat.category_id, apiKey, {
          maxPages: BROAD_CATALOG_CATEGORIES.has(cat.category_id) ? 9 : 6,
          today,
        }),
      }))
    );

    for (const { catId, list } of batchResults) {
      const catIds = [];
      for (const raw of list) {
        if (!raw?.id) continue;
        catIds.push(raw.id);
        const existing = itemMap.get(raw.id);
        if (existing) {
          existing.categoryIdsSet.add(catId);
        } else {
          itemMap.set(raw.id, {
            raw,
            primaryCatId: catId,
            categoryIdsSet: new Set([catId]),
          });
        }
      }
      byCategory[catId] = catIds;
    }
  }

  const mapped = Array.from(itemMap.values()).map((entry, idx) =>
    mapItem(entry.raw, idx, entry.primaryCatId, entry.categoryIdsSet)
  );
  mapped.sort((a, b) => Number(b.added || 0) - Number(a.added || 0));
  const items = mapped.map((item, idx) => ({ ...item, num: idx + 1 }));

  return indexCatalog({
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    categoriesCount: categories.length,
    items,
    byCategory,
  });
}

async function buildFullVodCatalog(apiKey) {
  return buildFullCatalog({
    categories: VOD_CATEGORIES,
    fetchCategory: fetchVodCategoryItems,
    mapItem: mapVodItem,
    apiKey,
  });
}

async function buildFullSeriesCatalog(apiKey) {
  return buildFullCatalog({
    categories: SERIES_CATEGORIES,
    fetchCategory: fetchSeriesCategoryItems,
    mapItem: mapSeriesItem,
    apiKey,
  });
}

/**
 * Get Series Info (Seasons and Episodes breakdown)
 */
async function getSeriesInfo(seriesId, apiKey, catalogLoader = null) {
  try {
    const [s, catalog] = await Promise.all([
      fetchTmdb(`/tv/${seriesId}`, { append_to_response: "credits,translations" }, apiKey),
      resolveCatalog("series", catalogLoader),
    ]);
    const catalogItem = catalog?.itemById?.get(Number(seriesId));
    const year = s.first_air_date ? s.first_air_date.substring(0, 4) : "";
    const cast = (s.credits?.cast || []).slice(0, 5).map(c => c.name).join(", ");
    const genre = (s.genres || []).map(g => g.name).join(", ");

    // Prefer Vietnamese translation for description/plot if available; fallback to English
    const viOverview = s.translations?.translations?.find(t => t.iso_639_1 === "vi")?.data?.overview;
    const overview = viOverview || s.overview || "";

    const seasons = [];
    const episodes = {};

    // Filter valid regular seasons (season_number >= 1), capped at 40 to stay under CF subrequest limits
    const validSeasons = (s.seasons || []).filter(sn => sn.season_number > 0).slice(0, 40);

    for (const seasonMeta of validSeasons) {
      const sNum = seasonMeta.season_number;
      seasons.push({
        air_date: seasonMeta.air_date || "",
        episode_count: seasonMeta.episode_count || 0,
        id: seasonMeta.id,
        name: seasonMeta.name || `Season ${sNum}`,
        overview: seasonMeta.overview || "",
        season_number: sNum,
        cover: seasonMeta.poster_path ? `${TMDB_IMAGE_BASE}/w500${seasonMeta.poster_path}` : "",
        cover_big: seasonMeta.poster_path ? `${TMDB_IMAGE_BASE}/w780${seasonMeta.poster_path}` : "",
      });
    }

    // Fetch season episodes in parallel batches of 6
    const SEASON_BATCH_SIZE = 6;
    for (let i = 0; i < validSeasons.length; i += SEASON_BATCH_SIZE) {
      const batch = validSeasons.slice(i, i + SEASON_BATCH_SIZE);
      await Promise.all(batch.map(async (seasonMeta) => {
        const sNum = seasonMeta.season_number;
        try {
          const seasonDetail = await fetchTmdb(`/tv/${seriesId}/season/${sNum}`, {}, apiKey);
          const epList = seasonDetail.episodes || [];

          episodes[String(sNum)] = epList.map(ep => {
            const epId = encodeEpisodeId(Number(seriesId), sNum, ep.episode_number);
            const epTitle = ep.name || `Episode ${ep.episode_number}`;

            return {
              id: epId,
              episode_num: ep.episode_number,
              title: epTitle,
              container_extension: "mp4",
              info: {
                name: epTitle,
                overview: ep.overview || "",
                duration_secs: (ep.runtime || 45) * 60,
                duration: `${ep.runtime || 45} min`,
                video: {},
                audio: {},
                bitrate: 0,
                rating: ep.vote_average || 0,
                season: sNum,
                tmdb_id: ep.id,
                series_id: seriesId,
                subtitles: [],
              },
              custom_sid: "",
              added: String(Math.floor(Date.now() / 1000)),
              season: sNum,
              direct_source: "",
            };
          });
        } catch (epErr) {
          console.warn(`Could not load episodes for series ${seriesId} S${sNum}:`, epErr.message);
          episodes[String(sNum)] = [];
        }
      }));
    }

    return {
      seasons,
      info: {
        name: year ? `${s.name} (${year})` : s.name,
        cover: s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : "",
        plot: overview,
        cast,
        director: "",
        genre,
        releaseDate: s.first_air_date || "",
        last_modified: catalogItem?.last_modified || String(Math.floor(Date.now() / 1000)),
        rating: String(s.vote_average || 0),
        rating_5based: Number(((s.vote_average || 0) / 2).toFixed(1)),
        backdrop_path: s.backdrop_path ? [`${TMDB_IMAGE_BASE}/w1280${s.backdrop_path}`] : [],
        youtube_trailer: "",
        episode_run_time: "45",
        category_id: catalogItem?.category_id || (CURATED_YEARS.has(year) ? year : "1006"),
      },
      episodes,
    };
  } catch (err) {
    console.error(`Error fetching series info for ${seriesId}:`, err.message);
    return {};
  }
}

/**
 * Build resolver URL for VOD movie.
 * No proxy=true: scrape-video 302s straight to the resolved stream instead of
 * relaying chunks through the proxy.
 * Cinejoy (https://cinejoy.pk) provides high quality streams (up to 4K HLS) with
 * multi-language audio & subtitles, resolved via scrape-video.
 * NOTE on backup mirrors: VidSrc-style players (player.videasy.ws) are not
 * usable from the VPS — their source API blocks datacenter IPs and their
 * stream tokens are IP-bound (fetching from a different IP returns 403), so
 * a server-side scrape can never serve clients in direct-302 mode. The
 * scrape-video `fallback` param stays available for future direct-mode mirrors.
 */
function buildVodResolverUrl(tmdbId, template = "") {
  const defaultTemplate = "https://your-proxy-domain.com/scrape-video?url=https%3A%2F%2Fcinejoy.pk%2Fwatch%2Fmovie%2F{tmdbId}";
  let tpl = template || defaultTemplate;
  if (tpl.includes("vidnest.fun")) {
    tpl = tpl
      .replace(/vidnest\.fun%2Fmovie%2F/g, "cinejoy.pk%2Fwatch%2Fmovie%2F")
      .replace(/vidnest\.fun\/movie\//g, "cinejoy.pk/watch/movie/");
  }
  return tpl.replace(/\{tmdbId\}/g, String(tmdbId));
}

/**
 * Build resolver URL for Series TV episode (see buildVodResolverUrl notes).
 */
function buildSeriesResolverUrl(tmdbId, season, episode, template = "") {
  const defaultTemplate = "https://your-proxy-domain.com/scrape-video?url=https%3A%2F%2Fcinejoy.pk%2Fwatch%2Ftv%2F{tmdbId}%2F{season}%2F{episode}";
  let tpl = template || defaultTemplate;
  if (tpl.includes("vidnest.fun")) {
    tpl = tpl
      .replace(/vidnest\.fun%2Ftv%2F/g, "cinejoy.pk%2Fwatch%2Ftv%2F")
      .replace(/vidnest\.fun\/tv\//g, "cinejoy.pk/watch/tv/");
  }
  return tpl
    .replace(/\{tmdbId\}/g, String(tmdbId))
    .replace(/\{season\}/g, String(season))
    .replace(/\{episode\}/g, String(episode));
}

module.exports = {
  DEFAULT_TMDB_API_KEY,
  isAllCategory,
  encodeEpisodeId,
  decodeEpisodeId,
  indexCatalog,
  buildFullVodCatalog,
  buildFullSeriesCatalog,
  VOD_CATEGORIES,
  SERIES_CATEGORIES,
  getVodCategories,
  getVodStreams,
  getVodInfo,
  getSeriesCategories,
  getSeriesStreams,
  getSeriesInfo,
  buildVodResolverUrl,
  buildSeriesResolverUrl,
};
