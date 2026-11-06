/**
 * TMDb Provider for Xtream Codes (VOD & TV Series)
 * Fetches genres, catalog, metadata and builds resolver URLs
 */

const DEFAULT_TMDB_API_KEY = "61e2290429798c561450eb56b26de19b";
const TMDB_HOSTS = ["https://api.tmdb.org/3", "https://api.themoviedb.org/3"];
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// In-memory cache to prevent hitting TMDB rate limits
const memoryCache = new Map();
const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours

async function fetchTmdb(endpoint, params = {}, apiKey = DEFAULT_TMDB_API_KEY, timeoutMs = 8000) {
  const query = new URLSearchParams({
    api_key: apiKey || DEFAULT_TMDB_API_KEY,
    language: "en-US",
    ...params,
  });

  const cacheKey = `${endpoint}?${query.toString()}`;
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  let lastError = null;

  for (const host of TMDB_HOSTS) {
    const url = `${host}${endpoint}?${query.toString()}`;
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

      if (!res.ok) {
        throw new Error(`TMDb HTTP error: ${res.status}`);
      }

      const data = await res.json();
      memoryCache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("Failed to reach TMDb API hosts");
}

/**
 * Curated VOD Categories (Cinema by year, Streaming Platforms, All-Time Acclaimed)
 */
const VOD_CATEGORIES = [
  { category_id: "2026", category_name: "Phim Chiếu Rạp 2026", parent_id: 0, query: { primary_release_year: "2026", sort_by: "popularity.desc" } },
  { category_id: "1001", category_name: "Phim Peacock", parent_id: 0, query: { with_watch_providers: "386|387", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "2025", category_name: "Phim 2025 (Nổi Bật)", parent_id: 0, query: { primary_release_year: "2025", sort_by: "popularity.desc" } },
  { category_id: "2024", category_name: "Phim 2024 (Nổi Bật)", parent_id: 0, query: { primary_release_year: "2024", sort_by: "popularity.desc" } },
  { category_id: "2023", category_name: "Phim 2023 (Nổi Bật)", parent_id: 0, query: { primary_release_year: "2023", sort_by: "popularity.desc" } },
  { category_id: "1002", category_name: "Phim Netflix", parent_id: 0, query: { with_watch_providers: "8", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1003", category_name: "Phim HBO Max", parent_id: 0, query: { with_watch_providers: "1899|384", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1008", category_name: "Phim Amazon Prime", parent_id: 0, query: { with_watch_providers: "9|119", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1009", category_name: "Phim Paramount+", parent_id: 0, query: { with_watch_providers: "531|2303|2616|582", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1010", category_name: "Phim Hulu", parent_id: 0, query: { with_watch_providers: "15", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1004", category_name: "Phim Disney+", parent_id: 0, query: { with_watch_providers: "337", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1005", category_name: "Phim Apple TV+", parent_id: 0, query: { with_watch_providers: "350", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1006", category_name: "Phim Bom Tấn Đỉnh Cao", parent_id: 0, query: { sort_by: "vote_count.desc", "vote_average.gte": "7.5", "vote_count.gte": "1000" } },
  { category_id: "1007", category_name: "Phim Hoạt Hình Chiếu Rạp", parent_id: 0, query: { with_genres: "16", sort_by: "popularity.desc" } },
  { category_id: "1011", category_name: "Phim Anime Crunchyroll", parent_id: 0, query: { with_watch_providers: "283", watch_region: "US", sort_by: "popularity.desc" } },
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

/**
 * Get VOD Movie Streams (sorted from newest to oldest, optionally filtered by category_id or search keyword)
 */
async function getVodStreams(categoryId, apiKey, page = 1, search = "", hasPageParam = false) {
  try {
    const today = new Date().toISOString().split("T")[0];
    let endpoint = "/discover/movie";
    let baseParams = {
      sort_by: "primary_release_date.desc",
      "primary_release_date.lte": today,
      "vote_count.gte": "5",
    };

    let results = [];

    if (search && search.trim()) {
      endpoint = "/search/movie";
      baseParams = { query: search.trim() };
      const pagesToFetch = hasPageParam ? [page] : [1, 2, 3];
      const responses = await Promise.all(
        pagesToFetch.map(p => fetchTmdb(endpoint, { ...baseParams, page: String(p) }, apiKey))
      );
      const rawList = responses.flatMap(r => r?.results || []);
      const seen = new Set();
      for (const item of rawList) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    } else if (hasPageParam) {
      if (!isAllCategory(categoryId)) {
        const catDef = VOD_CATEGORIES.find(c => c.category_id === String(categoryId));
        if (catDef) {
          Object.assign(baseParams, catDef.query);
        } else {
          baseParams.with_genres = String(categoryId);
        }
      }
      const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
      results = json?.results || [];
    } else if (!isAllCategory(categoryId)) {
      const yearStr = String(categoryId);
      if (["2026", "2025", "2024", "2023"].includes(yearStr)) {
        // Multi-angle query for ALL notable blockbusters of the year:
        // 1. Box Office leaders (revenue.desc)
        // 2. Most reviewed/voted by audience (vote_count.desc)
        // 3. Trending/popular releases (popularity.desc)
        const [revPages, votePages, popPages] = await Promise.all([
          Promise.all([1, 2, 3, 4].map(p => fetchTmdb(endpoint, { primary_release_year: yearStr, sort_by: "revenue.desc", page: String(p) }, apiKey))),
          Promise.all([1, 2, 3, 4].map(p => fetchTmdb(endpoint, { primary_release_year: yearStr, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
          Promise.all([1, 2, 3, 4].map(p => fetchTmdb(endpoint, { primary_release_year: yearStr, sort_by: "popularity.desc", "vote_count.gte": yearStr >= "2025" ? "10" : "50", page: String(p) }, apiKey))),
        ]);

        const rawList = [
          ...revPages.flatMap(r => r?.results || []),
          ...votePages.flatMap(r => r?.results || []),
          ...popPages.flatMap(r => r?.results || []),
        ];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else if (["1012", "1013", "1014"].includes(String(categoryId))) {
        // Multi-angle query for Asian hits:
        // 1. Most acclaimed / voted of all time (Parasite, Spirited Away, Train to Busan, Oldboy...)
        // 2. High popularity trending Asian movies (Exhuma, Godzilla Minus One...)
        const catDef = VOD_CATEGORIES.find(c => c.category_id === String(categoryId));
        const lang = catDef?.query?.with_original_language || "ko|zh|ja|th|vi";
        const [votePages, popPages] = await Promise.all([
          Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb(endpoint, { with_original_language: lang, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
          Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb(endpoint, { with_original_language: lang, sort_by: "popularity.desc", "vote_count.gte": "20", page: String(p) }, apiKey))),
        ]);

        const rawList = [
          ...votePages.flatMap(r => r?.results || []),
          ...popPages.flatMap(r => r?.results || []),
        ];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else {
        // Specific platform or genre category: fetch 10 pages (~200 movies)
        const catDef = VOD_CATEGORIES.find(c => c.category_id === String(categoryId));
        if (catDef) {
          Object.assign(baseParams, catDef.query);
        } else {
          baseParams.with_genres = String(categoryId);
        }
        const responses = await Promise.all(
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => fetchTmdb(endpoint, { ...baseParams, page: String(p) }, apiKey))
        );
        const rawList = responses.flatMap(r => r?.results || []);
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      }
    } else {
      // ALL category initial catalog: fetch newest 2026 cinema + Peacock + 2025 + popular blockbusters (~400+ movies)
      const [res2026, resPeacock, res2025, resPop] = await Promise.all([
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/movie", { primary_release_year: "2026", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/movie", { with_watch_providers: "386|387", watch_region: "US", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/movie", { primary_release_year: "2025", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => fetchTmdb("/movie/popular", { page: String(p) }, apiKey))),
      ]);

      const rawList = [
        ...res2026.flatMap(r => r?.results || []),
        ...resPeacock.flatMap(r => r?.results || []),
        ...res2025.flatMap(r => r?.results || []),
        ...resPop.flatMap(r => r?.results || []),
      ];
      const seen = new Set();
      for (const item of rawList) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
      // Sort so newest releases stay on top
      results.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
    }

    const baseNum = hasPageParam ? (page - 1) * 20 : 0;
    return results.map((m, idx) => {
      const year = m.release_date ? m.release_date.substring(0, 4) : "";
      let primaryCatId = "2026";
      if (!isAllCategory(categoryId)) {
        primaryCatId = String(categoryId);
      } else {
        if (year === "2025") primaryCatId = "2025";
        else if (year === "2024") primaryCatId = "2024";
        else if (year === "2023") primaryCatId = "2023";
        else if (parseInt(year, 10) < 2023) primaryCatId = "1006";
      }
      return {
        num: baseNum + idx + 1,
        name: year ? `${m.title} (${year})` : m.title,
        title: m.title,
        year,
        stream_type: "movie",
        stream_id: m.id, // 32-bit tmdbId
        stream_icon: m.poster_path ? `${TMDB_IMAGE_BASE}/w500${m.poster_path}` : "",
        rating: String(m.vote_average || 0),
        rating_5based: ((m.vote_average || 0) / 2).toFixed(1),
        added: m.release_date ? String(Math.floor(new Date(m.release_date).getTime() / 1000)) : "0",
        category_id: primaryCatId,
        container_extension: "mp4",
        custom_sid: "",
        direct_source: "",
      };
    });
  } catch (err) {
    console.error("Error fetching VOD streams:", err.message);
    return [];
  }
}

/**
 * Get VOD Info (Details for a specific movie)
 */
async function getVodInfo(tmdbId, apiKey) {
  try {
    const m = await fetchTmdb(`/movie/${tmdbId}`, { append_to_response: "credits,translations" }, apiKey);
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
        rating_5based: ((m.vote_average || 0) / 2).toFixed(1),
        rating_count_kinopoisk: m.vote_count || 0,
        subtitles: [],
      },
      movie_data: {
        stream_id: m.id,
        name: year ? `${m.title} (${year})` : m.title,
        title: m.title,
        year,
        added: String(Math.floor(Date.now() / 1000)),
        category_id: (m.genres && m.genres[0]) ? String(m.genres[0].id) : "0",
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
  { category_id: "2026", category_name: "Series 2026", parent_id: 0, query: { first_air_date_year: "2026", sort_by: "popularity.desc" } },
  { category_id: "1001", category_name: "Series Peacock", parent_id: 0, query: { with_watch_providers: "386|387", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "2025", category_name: "Series 2025 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2025", sort_by: "popularity.desc" } },
  { category_id: "2024", category_name: "Series 2024 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2024", sort_by: "popularity.desc" } },
  { category_id: "1002", category_name: "Series Netflix", parent_id: 0, query: { with_watch_providers: "8", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1003", category_name: "Series HBO Max", parent_id: 0, query: { with_watch_providers: "1899|384", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1008", category_name: "Series Amazon Prime", parent_id: 0, query: { with_watch_providers: "9|119", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1009", category_name: "Series Paramount+", parent_id: 0, query: { with_watch_providers: "531|2303|2616|582", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1010", category_name: "Series Hulu", parent_id: 0, query: { with_watch_providers: "15", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1004", category_name: "Series Disney+", parent_id: 0, query: { with_watch_providers: "337", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1005", category_name: "Series Apple TV+", parent_id: 0, query: { with_watch_providers: "350", watch_region: "US", sort_by: "popularity.desc" } },
  { category_id: "1006", category_name: "Series Bom Tấn Đỉnh Cao", parent_id: 0, query: { sort_by: "vote_count.desc", "vote_average.gte": "7.5", "vote_count.gte": "500" } },
  { category_id: "1007", category_name: "Series Anime / Hoạt Hình", parent_id: 0, query: { with_genres: "16", sort_by: "popularity.desc" } },
  { category_id: "1011", category_name: "Anime Crunchyroll", parent_id: 0, query: { with_watch_providers: "283", watch_region: "US", sort_by: "popularity.desc" } },
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

/**
 * Get Series Streams (TV Shows catalog, sorted from newest to oldest, optionally filtered by category_id or search keyword)
 */
async function getSeriesStreams(categoryId, apiKey, page = 1, search = "", hasPageParam = false) {
  try {
    const today = new Date().toISOString().split("T")[0];
    let endpoint = "/discover/tv";
    let baseParams = {
      sort_by: "first_air_date.desc",
      "first_air_date.lte": today,
      "vote_count.gte": "5",
    };

    let results = [];

    if (search && search.trim()) {
      endpoint = "/search/tv";
      baseParams = { query: search.trim() };
      const pagesToFetch = hasPageParam ? [page] : [1, 2, 3];
      const responses = await Promise.all(
        pagesToFetch.map(p => fetchTmdb(endpoint, { ...baseParams, page: String(p) }, apiKey))
      );
      const rawList = responses.flatMap(r => r?.results || []);
      const seen = new Set();
      for (const item of rawList) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    } else if (hasPageParam) {
      if (!isAllCategory(categoryId)) {
        const catDef = SERIES_CATEGORIES.find(c => c.category_id === String(categoryId));
        if (catDef) {
          Object.assign(baseParams, catDef.query);
        } else {
          baseParams.with_genres = String(categoryId);
        }
      }
      const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
      results = json?.results || [];
    } else if (!isAllCategory(categoryId)) {
      const yearStr = String(categoryId);
      if (["2026", "2025", "2024"].includes(yearStr)) {
        // Multi-angle query for ALL notable series of the year:
        // 1. Most voted series (vote_count.desc)
        // 2. High popularity trending series (popularity.desc)
        const [votePages, popPages] = await Promise.all([
          Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb(endpoint, { first_air_date_year: yearStr, sort_by: "vote_count.desc", page: String(p) }, apiKey))),
          Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb(endpoint, { first_air_date_year: yearStr, sort_by: "popularity.desc", "vote_count.gte": "10", page: String(p) }, apiKey))),
        ]);

        const rawList = [
          ...votePages.flatMap(r => r?.results || []),
          ...popPages.flatMap(r => r?.results || []),
        ];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else {
        // Specific platform or genre category: fetch 10 pages (~200 series)
        const catDef = SERIES_CATEGORIES.find(c => c.category_id === String(categoryId));
        if (catDef) {
          Object.assign(baseParams, catDef.query);
        } else {
          baseParams.with_genres = String(categoryId);
        }
        const responses = await Promise.all(
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => fetchTmdb(endpoint, { ...baseParams, page: String(p) }, apiKey))
        );
        const rawList = responses.flatMap(r => r?.results || []);
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }

        // If Peacock category, ensure Poker Face (120998) is always included
        if (String(categoryId) === "1001" && !seen.has(120998)) {
          try {
            const pf = await fetchTmdb("/tv/120998", {}, apiKey);
            if (pf?.id) results.unshift(pf);
          } catch (_) {}
        }
      }
    } else {
      // ALL category initial catalog: 2026 + Peacock + 2025 + popular series + top voted (~450+ shows)
      const [res2026, resPeacock, res2025, resPop, resTop] = await Promise.all([
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/tv", { first_air_date_year: "2026", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/tv", { with_watch_providers: "386|387", watch_region: "US", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/tv", { first_air_date_year: "2025", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(p => fetchTmdb("/tv/popular", { page: String(p) }, apiKey))),
        Promise.all([1, 2, 3, 4, 5].map(p => fetchTmdb("/discover/tv", { sort_by: "vote_count.desc", page: String(p) }, apiKey))),
      ]);

      const rawList = [
        ...res2026.flatMap(r => r?.results || []),
        ...resPeacock.flatMap(r => r?.results || []),
        ...res2025.flatMap(r => r?.results || []),
        ...resPop.flatMap(r => r?.results || []),
        ...resTop.flatMap(r => r?.results || []),
      ];
      const seen = new Set();
      for (const item of rawList) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }

      // Ensure notable series like Poker Face (120998) are always included in the initial local database
      if (!seen.has(120998)) {
        try {
          const pf = await fetchTmdb("/tv/120998", {}, apiKey);
          if (pf?.id) {
            seen.add(pf.id);
            results.push(pf);
          }
        } catch (_) {}
      }

      results.sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));
    }

    const baseNum = hasPageParam ? (page - 1) * 20 : 0;
    return results.map((s, idx) => {
      const year = s.first_air_date ? s.first_air_date.substring(0, 4) : "";
      let primaryCatId = "2026";
      if (!isAllCategory(categoryId)) {
        primaryCatId = String(categoryId);
      } else {
        if (year === "2025") primaryCatId = "2025";
        else if (year === "2024") primaryCatId = "2024";
        else if (parseInt(year, 10) < 2024) primaryCatId = "1006";
      }
      const airDateTs = s.first_air_date
        ? String(Math.floor(new Date(s.first_air_date).getTime() / 1000))
        : String(Math.floor(Date.now() / 1000));
      const iconUrl = s.poster_path ? `${TMDB_IMAGE_BASE}/w500${s.poster_path}` : "";
      return {
        num: baseNum + idx + 1,
        name: year ? `${s.name} (${year})` : s.name,
        title: s.name,
        year,
        stream_type: "series",
        stream_id: s.id, // Compatibility alias for players expecting stream_id
        series_id: s.id, // 32-bit tmdbId
        cover: iconUrl,
        stream_icon: iconUrl,
        plot: s.overview || "",
        cast: "",
        director: "",
        genre: "",
        releaseDate: s.first_air_date || "",
        last_modified: airDateTs,
        added: airDateTs,
        rating: String(s.vote_average || 0),
        rating_5based: ((s.vote_average || 0) / 2).toFixed(1),
        backdrop_path: s.backdrop_path ? [`${TMDB_IMAGE_BASE}/w1280${s.backdrop_path}`] : [],
        youtube_trailer: "",
        episode_run_time: "45",
        category_id: primaryCatId,
        category_ids: [primaryCatId],
      };
    });
  } catch (err) {
    console.error("Error fetching series streams:", err.message);
    return [];
  }
}

/**
 * Get Series Info (Seasons and Episodes breakdown)
 */
async function getSeriesInfo(seriesId, apiKey) {
  try {
    const s = await fetchTmdb(`/tv/${seriesId}`, { append_to_response: "credits,translations" }, apiKey);
    const year = s.first_air_date ? s.first_air_date.substring(0, 4) : "";
    const cast = (s.credits?.cast || []).slice(0, 5).map(c => c.name).join(", ");
    const genre = (s.genres || []).map(g => g.name).join(", ");

    // Prefer Vietnamese translation for description/plot if available; fallback to English
    const viOverview = s.translations?.translations?.find(t => t.iso_639_1 === "vi")?.data?.overview;
    const overview = viOverview || s.overview || "";

    const seasons = [];
    const episodes = {};

    // Filter valid regular seasons (season_number >= 1)
    const validSeasons = (s.seasons || []).filter(sn => sn.season_number > 0);

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

      // Fetch season episodes
      try {
        const seasonDetail = await fetchTmdb(`/tv/${seriesId}/season/${sNum}`, {}, apiKey);
        const epList = seasonDetail.episodes || [];

        episodes[String(sNum)] = epList.map(ep => {
          // Encoded episodeId: seriesId * 10000 + season * 100 + epNumber
          // e.g. series 1399, S01E02 -> 13990102; series 119451, S01E01 -> 1194510101
          // Keep the full seriesId (no % truncation): truncating made any seriesId >= 100000
          // resolve to a different show. Note: exceeds 32-bit int for seriesId > 214748
          // (newest shows); safe in JS/URLs and most clients treat ids as strings/longs.
          const epId = seriesId * 10000 + (sNum % 100) * 100 + (ep.episode_number % 100);

          const epTitle = ep.name || `Episode ${ep.episode_number}`;

          return {
            id: String(epId),
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
        last_modified: String(Math.floor(Date.now() / 1000)),
        rating: String(s.vote_average || 0),
        rating_5based: ((s.vote_average || 0) / 2).toFixed(1),
        backdrop_path: s.backdrop_path ? [`${TMDB_IMAGE_BASE}/w1280${s.backdrop_path}`] : [],
        youtube_trailer: "",
        episode_run_time: "45",
        category_id: (s.genres && s.genres[0]) ? String(s.genres[0].id) : "0",
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
 * NOTE on backup mirrors: VidSrc-style players (player.videasy.ws) are not
 * usable from the VPS — their source API blocks datacenter IPs and their
 * stream tokens are IP-bound (fetching from a different IP returns 403), so
 * a server-side scrape can never serve clients in direct-302 mode. The
 * scrape-video `fallback` param stays available for future direct-mode mirrors.
 */
function buildVodResolverUrl(tmdbId, template = "") {
  const defaultTemplate = "https://your-proxy-domain.com/scrape-video?url=https%3A%2F%2Fvidnest.fun%2Fmovie%2F{tmdbId}";
  const tpl = template || defaultTemplate;
  return tpl.replace(/\{tmdbId\}/g, String(tmdbId));
}

/**
 * Build resolver URL for Series TV episode (see buildVodResolverUrl notes).
 */
function buildSeriesResolverUrl(tmdbId, season, episode, template = "") {
  const defaultTemplate = "https://your-proxy-domain.com/scrape-video?url=https%3A%2F%2Fvidnest.fun%2Ftv%2F{tmdbId}%2F{season}%2F{episode}";
  const tpl = template || defaultTemplate;
  return tpl
    .replace(/\{tmdbId\}/g, String(tmdbId))
    .replace(/\{season\}/g, String(season))
    .replace(/\{episode\}/g, String(episode));
}

module.exports = {
  DEFAULT_TMDB_API_KEY,
  isAllCategory,
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
