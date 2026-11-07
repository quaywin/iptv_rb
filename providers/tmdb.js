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

  // Tuyệt tác & Hoạt hình đỉnh cao
  { category_id: "1025", category_name: "Tuyệt Tác IMDb Top 250", parent_id: 0, query: { sort_by: "vote_average.desc", "vote_count.gte": "8000" } },
  { category_id: "1024", category_name: "Hoạt Hình Studio Ghibli", parent_id: 0, query: { with_companies: "10342", sort_by: "popularity.desc" } },
  { category_id: "1006", category_name: "Phim Bom Tấn Đỉnh Cao", parent_id: 0, query: { sort_by: "vote_count.desc", "vote_average.gte": "7.5", "vote_count.gte": "1000" } },
  { category_id: "1007", category_name: "Phim Hoạt Hình Chiếu Rạp", parent_id: 0, query: { with_genres: "16", sort_by: "popularity.desc" } },
  { category_id: "1011", category_name: "Phim Anime Crunchyroll", parent_id: 0, query: { with_watch_providers: "283", watch_region: "US", sort_by: "popularity.desc" } },

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
        if (catDef?.query?.special === "harry_potter") {
          const [hpCol, fbCol, hpSearch] = await Promise.all([
            fetchTmdb("/collection/1241", {}, apiKey),
            fetchTmdb("/collection/435259", {}, apiKey),
            fetchTmdb("/search/movie", { query: "Harry Potter" }, apiKey),
          ]);
          const raw = [...(hpCol?.parts || []), ...(fbCol?.parts || []), ...(hpSearch?.results || [])];
          const seen = new Set();
          const unique = [];
          for (const item of raw) {
            if (item?.id && !seen.has(item.id)) { seen.add(item.id); unique.push(item); }
          }
          results = unique.slice((page - 1) * 20, page * 20);
        } else if (catDef?.query?.special === "lotr") {
          const [lotrCol, hobCol, lotrSearch] = await Promise.all([
            fetchTmdb("/collection/119", {}, apiKey),
            fetchTmdb("/collection/121938", {}, apiKey),
            fetchTmdb("/search/movie", { query: "Lord of the Rings" }, apiKey),
          ]);
          const raw = [...(lotrCol?.parts || []), ...(hobCol?.parts || []), ...(lotrSearch?.results || [])];
          const seen = new Set();
          const unique = [];
          for (const item of raw) {
            if (item?.id && !seen.has(item.id)) { seen.add(item.id); unique.push(item); }
          }
          results = unique.slice((page - 1) * 20, page * 20);
        } else if (catDef?.query?.special === "fast_and_furious") {
          const [ffCol, ffSearch] = await Promise.all([
            fetchTmdb("/collection/9485", {}, apiKey),
            fetchTmdb("/search/movie", { query: "Fast & Furious" }, apiKey),
          ]);
          const raw = [...(ffCol?.parts || []), ...(ffSearch?.results || [])];
          const seen = new Set();
          const unique = [];
          for (const item of raw) {
            if (item?.id && !seen.has(item.id)) { seen.add(item.id); unique.push(item); }
          }
          results = unique.slice((page - 1) * 20, page * 20);
        } else if (catDef?.query?.special === "monsterverse") {
          const [gz, kong] = await Promise.all([
            fetchTmdb("/search/movie", { query: "Godzilla" }, apiKey),
            fetchTmdb("/search/movie", { query: "Kong" }, apiKey),
          ]);
          const raw = [...(gz?.results || []), ...(kong?.results || [])];
          const seen = new Set();
          const unique = [];
          for (const item of raw) {
            if (item?.id && !seen.has(item.id)) { seen.add(item.id); unique.push(item); }
          }
          results = unique.slice((page - 1) * 20, page * 20);
        } else if (catDef?.query?.special === "james_bond") {
          const bondCol = await fetchTmdb("/collection/645", {}, apiKey);
          const raw = bondCol?.parts || [];
          results = raw.slice((page - 1) * 20, page * 20);
        } else {
          if (catDef) {
            if (catDef.query?.endpoint) {
              endpoint = catDef.query.endpoint;
            }
            Object.assign(baseParams, catDef.query);
          } else {
            baseParams.with_genres = String(categoryId);
          }
          const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
          results = json?.results || [];
        }
      } else {
        const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
        results = json?.results || [];
      }
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
      } else if (String(categoryId) === "1018") {
        // 1018 Harry Potter & Fantastic Beasts (Wizarding World)
        const [hpCol, fbCol, hpSearch] = await Promise.all([
          fetchTmdb("/collection/1241", {}, apiKey),
          fetchTmdb("/collection/435259", {}, apiKey),
          fetchTmdb("/search/movie", { query: "Harry Potter" }, apiKey),
        ]);
        const rawList = [...(hpCol?.parts || []), ...(fbCol?.parts || []), ...(hpSearch?.results || [])];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else if (String(categoryId) === "1019") {
        // 1019 Lord of the Rings & The Hobbit
        const [lotrCol, hobCol, lotrSearch] = await Promise.all([
          fetchTmdb("/collection/119", {}, apiKey),
          fetchTmdb("/collection/121938", {}, apiKey),
          fetchTmdb("/search/movie", { query: "Lord of the Rings" }, apiKey),
        ]);
        const rawList = [...(lotrCol?.parts || []), ...(hobCol?.parts || []), ...(lotrSearch?.results || [])];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else if (String(categoryId) === "1020") {
        // 1020 Fast & Furious Collection
        const [ffCol, ffSearch] = await Promise.all([
          fetchTmdb("/collection/9485", {}, apiKey),
          fetchTmdb("/search/movie", { query: "Fast & Furious" }, apiKey),
        ]);
        const rawList = [...(ffCol?.parts || []), ...(ffSearch?.results || [])];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else if (String(categoryId) === "1021") {
        // 1021 MonsterVerse (Godzilla & Kong)
        const [gz, kong] = await Promise.all([
          fetchTmdb("/search/movie", { query: "Godzilla" }, apiKey),
          fetchTmdb("/search/movie", { query: "Kong" }, apiKey),
        ]);
        const rawList = [...(gz?.results || []), ...(kong?.results || [])];
        const seen = new Set();
        for (const item of rawList) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      } else if (String(categoryId) === "1022") {
        // 1022 James Bond 007 Collection
        const bondCol = await fetchTmdb("/collection/645", {}, apiKey);
        const rawList = bondCol?.parts || [];
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
          if (catDef.query?.endpoint) {
            endpoint = catDef.query.endpoint;
          }
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
      // ALL category initial catalog: fetch from each curated category with multi-page depth
      // so EVERY category has at least 25 dedicated movies without getting starved by earlier categories.
      const TARGET_PER_CAT = 25;
      const categoryFetches = VOD_CATEGORIES.map(async (cat) => {
        let catEndpoint = "/discover/movie";
        let params = { sort_by: "popularity.desc" };
        if (cat.query?.endpoint) {
          catEndpoint = cat.query.endpoint;
          params = {};
        } else if (["2026", "2025", "2024", "2023"].includes(cat.category_id)) {
          params.primary_release_year = cat.category_id;
        } else if (cat.query?.special === "harry_potter") {
          const [hpCol, fbCol, hpSearch] = await Promise.all([
            fetchTmdb("/collection/1241", {}, apiKey),
            fetchTmdb("/collection/435259", {}, apiKey),
            fetchTmdb("/search/movie", { query: "Harry Potter" }, apiKey),
          ]);
          return {
            catId: cat.category_id,
            items: [...(hpCol?.parts || []), ...(fbCol?.parts || []), ...(hpSearch?.results || [])],
          };
        } else if (cat.query?.special === "lotr") {
          const [lotrCol, hobCol, lotrSearch] = await Promise.all([
            fetchTmdb("/collection/119", {}, apiKey),
            fetchTmdb("/collection/121938", {}, apiKey),
            fetchTmdb("/search/movie", { query: "Lord of the Rings" }, apiKey),
          ]);
          return {
            catId: cat.category_id,
            items: [...(lotrCol?.parts || []), ...(hobCol?.parts || []), ...(lotrSearch?.results || [])],
          };
        } else if (cat.query?.special === "fast_and_furious") {
          const [ffCol, ffSearch] = await Promise.all([
            fetchTmdb("/collection/9485", {}, apiKey),
            fetchTmdb("/search/movie", { query: "Fast & Furious" }, apiKey),
          ]);
          return {
            catId: cat.category_id,
            items: [...(ffCol?.parts || []), ...(ffSearch?.results || [])],
          };
        } else if (cat.query?.special === "monsterverse") {
          const [gz, kong] = await Promise.all([
            fetchTmdb("/search/movie", { query: "Godzilla" }, apiKey),
            fetchTmdb("/search/movie", { query: "Kong" }, apiKey),
          ]);
          return {
            catId: cat.category_id,
            items: [...(gz?.results || []), ...(kong?.results || [])],
          };
        } else if (cat.query?.special === "james_bond") {
          const bondCol = await fetchTmdb("/collection/645", {}, apiKey);
          return {
            catId: cat.category_id,
            items: bondCol?.parts || [],
          };
        } else if (cat.query) {
          Object.assign(params, cat.query);
        }

        // Platforms & kids have high overlap with Trending & Year categories, fetch up to 8 pages; others 4 pages
        const pageCount = ["1004", "1003", "1001", "1031", "1032"].includes(cat.category_id) ? 8 : 4;
        const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
        const responses = await Promise.all(
          pages.map(p => fetchTmdb(catEndpoint, { ...params, page: String(p) }, apiKey))
        );
        return {
          catId: cat.category_id,
          items: responses.flatMap(r => r?.results || []),
        };
      });

      const batches = await Promise.all(categoryFetches);
      const movieMap = new Map();

      // Allocate primary category to ensure every category has dedicated items, and multi-tag overlap
      for (const batch of batches) {
        let allocatedPrimary = 0;
        for (const item of batch.items) {
          if (!item?.id) continue;
          const existing = movieMap.get(item.id);
          if (existing) {
            existing._categoryIdsSet.add(batch.catId);
          } else {
            if (allocatedPrimary < TARGET_PER_CAT) {
              item._assignedCatId = batch.catId;
              item._categoryIdsSet = new Set([batch.catId]);
              if (item.release_date) {
                const y = item.release_date.substring(0, 4);
                if (y) item._categoryIdsSet.add(y);
              }
              movieMap.set(item.id, item);
              allocatedPrimary++;
            }
          }
        }
      }

      // Also ensure extra 2026 releases & popular hits are present
      const [res2026, resPop] = await Promise.all([
        Promise.all([1, 2].map(p => fetchTmdb("/discover/movie", { primary_release_year: "2026", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2].map(p => fetchTmdb("/movie/popular", { page: String(p) }, apiKey))),
      ]);
      for (const p of [...res2026, ...resPop]) {
        for (const item of (p?.results || [])) {
          if (item?.id && !movieMap.has(item.id)) {
            item._assignedCatId = "2026";
            item._categoryIdsSet = new Set(["2026"]);
            movieMap.set(item.id, item);
          }
        }
      }

      results = Array.from(movieMap.values());
      results.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
    }

    const baseNum = hasPageParam ? (page - 1) * 20 : 0;
    return results.map((m, idx) => {
      const year = m.release_date ? m.release_date.substring(0, 4) : "";
      let primaryCatId = m._assignedCatId || "2026";
      if (!isAllCategory(categoryId)) {
        primaryCatId = String(categoryId);
      } else if (!m._assignedCatId) {
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
        category_ids: m._categoryIdsSet ? Array.from(m._categoryIdsSet) : [primaryCatId, year].filter(Boolean),
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
  { category_id: "1000", category_name: "🔥 Series Thịnh Hành (Hot Tuần)", parent_id: 0, query: { endpoint: "/trending/tv/week" } },
  { category_id: "2026", category_name: "Series 2026", parent_id: 0, query: { first_air_date_year: "2026", sort_by: "popularity.desc" } },
  { category_id: "2025", category_name: "Series 2025 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2025", sort_by: "popularity.desc" } },
  { category_id: "2024", category_name: "Series 2024 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2024", sort_by: "popularity.desc" } },
  { category_id: "2023", category_name: "Series 2023 (Nổi Bật)", parent_id: 0, query: { first_air_date_year: "2023", sort_by: "popularity.desc" } },

  // Phim bộ Việt Nam
  { category_id: "1023", category_name: "Phim Bộ & Truyền Hình Việt Nam", parent_id: 0, query: { with_original_language: "vi", sort_by: "popularity.desc" } },

  // Vũ trụ điện ảnh & Thương hiệu đình đám (Franchises & Cinematic Universes)
  { category_id: "1015", category_name: "Series Marvel (MCU)", parent_id: 0, query: { with_companies: "420|7505", sort_by: "popularity.desc" } },
  { category_id: "1016", category_name: "Series Star Wars", parent_id: 0, query: { with_companies: "1", sort_by: "popularity.desc" } },
  { category_id: "1017", category_name: "Series DC Universe", parent_id: 0, query: { with_companies: "9993|429|128064", sort_by: "popularity.desc" } },
  { category_id: "1019", category_name: "Series Game of Thrones & LOTR", parent_id: 0, query: { special: "got_lotr", sort_by: "popularity.desc" } },

  // Tuyệt tác đỉnh cao
  { category_id: "1025", category_name: "Series Tuyệt Tác IMDb Top", parent_id: 0, query: { sort_by: "vote_average.desc", "vote_count.gte": "1500" } },
  { category_id: "1006", category_name: "Series Bom Tấn Đỉnh Cao", parent_id: 0, query: { sort_by: "vote_count.desc", "vote_average.gte": "7.5", "vote_count.gte": "500" } },
  { category_id: "1007", category_name: "Series Anime / Hoạt Hình", parent_id: 0, query: { with_genres: "16", sort_by: "popularity.desc" } },
  { category_id: "1011", category_name: "Anime Crunchyroll", parent_id: 0, query: { with_watch_providers: "283", watch_region: "US", sort_by: "popularity.desc" } },

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
        if (catDef?.query?.special === "got_lotr") {
          const [got, hotd, lotr, witcher] = await Promise.all([
            fetchTmdb("/search/tv", { query: "Game of Thrones" }, apiKey),
            fetchTmdb("/search/tv", { query: "House of the Dragon" }, apiKey),
            fetchTmdb("/search/tv", { query: "The Rings of Power" }, apiKey),
            fetchTmdb("/search/tv", { query: "The Witcher" }, apiKey),
          ]);
          const raw = [...(got?.results || []), ...(hotd?.results || []), ...(lotr?.results || []), ...(witcher?.results || [])];
          const seen = new Set();
          const unique = [];
          for (const item of raw) {
            if (item?.id && !seen.has(item.id)) { seen.add(item.id); unique.push(item); }
          }
          results = unique.slice((page - 1) * 20, page * 20);
        } else {
          if (catDef) {
            if (catDef.query?.endpoint) {
              endpoint = catDef.query.endpoint;
            }
            Object.assign(baseParams, catDef.query);
          } else {
            baseParams.with_genres = String(categoryId);
          }
          const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
          results = json?.results || [];
        }
      } else {
        const json = await fetchTmdb(endpoint, { ...baseParams, page: String(page) }, apiKey);
        results = json?.results || [];
      }
    } else if (!isAllCategory(categoryId)) {
      const yearStr = String(categoryId);
      if (["2026", "2025", "2024", "2023"].includes(yearStr)) {
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
      } else if (String(categoryId) === "1019") {
        // 1019 Game of Thrones & Lord of the Rings series
        const [got, hotd, lotr, witcher] = await Promise.all([
          fetchTmdb("/search/tv", { query: "Game of Thrones" }, apiKey),
          fetchTmdb("/search/tv", { query: "House of the Dragon" }, apiKey),
          fetchTmdb("/search/tv", { query: "The Rings of Power" }, apiKey),
          fetchTmdb("/search/tv", { query: "The Witcher" }, apiKey),
        ]);
        const rawList = [...(got?.results || []), ...(hotd?.results || []), ...(lotr?.results || []), ...(witcher?.results || [])];
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
          if (catDef.query?.endpoint) {
            endpoint = catDef.query.endpoint;
          }
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
      // ALL category initial catalog: fetch from each curated category with multi-page depth
      // so EVERY series category has at least 25 dedicated series without getting starved by earlier categories.
      const TARGET_PER_CAT = 25;
      const categoryFetches = SERIES_CATEGORIES.map(async (cat) => {
        let catEndpoint = "/discover/tv";
        let params = { sort_by: "popularity.desc" };
        if (cat.query?.endpoint) {
          catEndpoint = cat.query.endpoint;
          params = {};
        } else if (["2026", "2025", "2024", "2023"].includes(cat.category_id)) {
          params.first_air_date_year = cat.category_id;
        } else if (cat.query?.special === "got_lotr") {
          const [got, hotd, lotr, witcher] = await Promise.all([
            fetchTmdb("/search/tv", { query: "Game of Thrones" }, apiKey),
            fetchTmdb("/search/tv", { query: "House of the Dragon" }, apiKey),
            fetchTmdb("/search/tv", { query: "The Rings of Power" }, apiKey),
            fetchTmdb("/search/tv", { query: "The Witcher" }, apiKey),
          ]);
          return {
            catId: cat.category_id,
            items: [...(got?.results || []), ...(hotd?.results || []), ...(lotr?.results || []), ...(witcher?.results || [])],
          };
        } else if (cat.query) {
          Object.assign(params, cat.query);
        }

        const pageCount = ["1004", "1003", "1001", "1031", "1032"].includes(cat.category_id) ? 6 : 4;
        const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
        const responses = await Promise.all(
          pages.map(p => fetchTmdb(catEndpoint, { ...params, page: String(p) }, apiKey))
        );
        return {
          catId: cat.category_id,
          items: responses.flatMap(r => r?.results || []),
        };
      });

      const batches = await Promise.all(categoryFetches);
      const seriesMap = new Map();

      for (const batch of batches) {
        let allocatedPrimary = 0;
        for (const item of batch.items) {
          if (!item?.id) continue;
          const existing = seriesMap.get(item.id);
          if (existing) {
            existing._categoryIdsSet.add(batch.catId);
          } else {
            if (allocatedPrimary < TARGET_PER_CAT) {
              item._assignedCatId = batch.catId;
              item._categoryIdsSet = new Set([batch.catId]);
              if (item.first_air_date) {
                const y = item.first_air_date.substring(0, 4);
                if (y) item._categoryIdsSet.add(y);
              }
              seriesMap.set(item.id, item);
              allocatedPrimary++;
            }
          }
        }
      }

      // Ensure notable series like Poker Face (120998) are always included and tagged with Peacock (1001)
      if (!seriesMap.has(120998)) {
        try {
          const pf = await fetchTmdb("/tv/120998", {}, apiKey);
          if (pf?.id) {
            pf._assignedCatId = "1001";
            pf._categoryIdsSet = new Set(["1001"]);
            seriesMap.set(pf.id, pf);
          }
        } catch (_) {}
      } else {
        seriesMap.get(120998)._categoryIdsSet.add("1001");
      }

      // Also include extra 2026 releases & popular series for richness
      const [res2026, resPop] = await Promise.all([
        Promise.all([1, 2].map(p => fetchTmdb("/discover/tv", { first_air_date_year: "2026", sort_by: "popularity.desc", page: String(p) }, apiKey))),
        Promise.all([1, 2].map(p => fetchTmdb("/tv/popular", { page: String(p) }, apiKey))),
      ]);
      for (const p of [...res2026, ...resPop]) {
        for (const item of (p?.results || [])) {
          if (item?.id && !seriesMap.has(item.id)) {
            item._assignedCatId = "2026";
            item._categoryIdsSet = new Set(["2026"]);
            seriesMap.set(item.id, item);
          }
        }
      }

      results = Array.from(seriesMap.values());
      results.sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));
    }

    const baseNum = hasPageParam ? (page - 1) * 20 : 0;
    return results.map((s, idx) => {
      const year = s.first_air_date ? s.first_air_date.substring(0, 4) : "";
      let primaryCatId = s._assignedCatId || "2026";
      if (!isAllCategory(categoryId)) {
        primaryCatId = String(categoryId);
      } else if (!s._assignedCatId) {
        if (year === "2025") primaryCatId = "2025";
        else if (year === "2024") primaryCatId = "2024";
        else if (year === "2023") primaryCatId = "2023";
        else if (parseInt(year, 10) < 2023) primaryCatId = "1006";
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
        category_id: primaryCatId,
        category_ids: s._categoryIdsSet ? Array.from(s._categoryIdsSet) : [primaryCatId, year].filter(Boolean),
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
