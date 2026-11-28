const {
  PROVIDER_MAP,
  authenticateUser,
  parseM3uToXtream,
  handleXtreamRequest,
} = require("./xtream");
const { buildVodResolverUrl, buildSeriesResolverUrl, encodeEpisodeId, decodeEpisodeId, indexCatalog } = require("./providers/tmdb");
const { sanitizeM3uAttr, normalizeSportGroup, scoreBroadcastChannel } = require("./utils/helpers");
const config = require("./config");

async function runXtreamTests() {
  console.log("=== Starting Xtream Codes API Unit & Integration Tests ===\n");

  // --- Test 1: Authentication ---
  console.log("--- Test 1: Authentication ---");

  const currentPass = config.xtreamPassword || "iptv";
  const authValid = authenticateUser("strm", currentPass, config);
  console.log(`Valid user (strm / ${currentPass}):`, authValid.valid ? "PASSED" : "FAILED", authValid);
  if (!authValid.valid || authValid.provider !== "strm") {
    throw new Error("Auth test failed for valid user");
  }

  const authInvalidPass = authenticateUser("strm", "wrong_pass_123456789", config);
  console.log("Invalid password (strm / wrong_pass_123456789):", !authInvalidPass.valid ? "PASSED (rejected)" : "FAILED");
  if (authInvalidPass.valid) {
    throw new Error("Auth test failed: accepted wrong password");
  }

  const authInvalidProvider = authenticateUser("nonexistent", currentPass, config);
  console.log("Invalid provider (nonexistent / iptv):", !authInvalidProvider.valid ? "PASSED (rejected)" : "FAILED");
  if (authInvalidProvider.valid) {
    throw new Error("Auth test failed: accepted invalid provider");
  }

  // Custom user config test
  const customCfg = {
    ...config,
    xtreamUsers: "sports_fan:secret123:strm,movie_buff:pass456:cine,vip:allpass:all",
  };
  const authCustom = authenticateUser("sports_fan", "secret123", customCfg);
  console.log("Custom user mapping (sports_fan -> strm):", authCustom.valid && authCustom.provider === "strm" ? "PASSED" : "FAILED");
  if (!authCustom.valid || authCustom.provider !== "strm") {
    throw new Error("Auth test failed for custom mapping");
  }

  // --- Test 2: M3U to Xtream Parser ---
  console.log("\n--- Test 2: M3U Parser ---");
  const sampleM3u = `#EXTM3U tvg-shift=0 m3uautoload=1

#EXTINF:-1 tvg-id="espn.us" tvg-name="ESPN HD" tvg-logo="https://example.com/espn.png" group-title="United States",ESPN HD
https://stream.example.com/espn/index.m3u8

#EXTINF:-1 tvg-id="sky.f1" tvg-name="Sky Sports F1" tvg-logo="https://example.com/skyf1.png" group-title="Motorsport",Sky Sports F1
https://stream.example.com/skyf1/index.m3u8

#EXTINF:-1 tvg-id="sky.pl" tvg-name="Sky Sports Premier League" tvg-logo="https://example.com/skypl.png" group-title="United Kingdom",Sky Sports Premier League
https://stream.example.com/skypl/index.m3u8
`;

  const parsed = parseM3uToXtream(sampleM3u);
  console.log(`Parsed categories count: ${parsed.categories.length}`);
  console.log("Categories:", parsed.categories);
  console.log(`Parsed streams count: ${parsed.streams.length}`);
  console.log("First stream:", parsed.streams[0]);

  if (parsed.categories.length !== 3) {
    throw new Error(`Expected 3 categories, got ${parsed.categories.length}`);
  }
  if (parsed.streams.length !== 3) {
    throw new Error(`Expected 3 streams, got ${parsed.streams.length}`);
  }
  if (typeof parsed.streams[0].stream_id !== "number" || parsed.streams[0].stream_id <= 0) {
    throw new Error("stream_id must be a positive integer");
  }

  const firstStreamId = parsed.streams[0].stream_id;
  const targetUrl = parsed.streamMap.get(firstStreamId);
  console.log(`Resolved streamMap[${firstStreamId}] =>`, targetUrl);
  if (targetUrl !== "https://stream.example.com/espn/index.m3u8") {
    throw new Error("Stream URL mapping mismatch");
  }

  // --- Test 3: Xtream Handler Endpoints ---
  console.log("\n--- Test 3: Xtream Endpoints Simulation ---");
  const dummyGetOrGenerate = async (filename, generator, providerKey) => sampleM3u;

  // 3a. Auth / Info
  const infoReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}`);
  const infoRes = await handleXtreamRequest({
    req: infoReq,
    url: new URL(infoReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const infoJson = await infoRes.json();
  console.log("Endpoint Auth Info response:", infoJson.user_info.status === "Active" ? "PASSED" : "FAILED", {
    auth: infoJson.user_info.auth,
    status: infoJson.user_info.status,
    server: infoJson.server_info.url,
  });
  if (infoJson.user_info.auth !== 1) {
    throw new Error("Failed auth info response");
  }

  // 3b. get_live_categories
  const catReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_live_categories`);
  const catRes = await handleXtreamRequest({
    req: catReq,
    url: new URL(catReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const catJson = await catRes.json();
  console.log("Endpoint get_live_categories count:", catJson.length, catJson.length === 3 ? "PASSED" : "FAILED");
  if (catJson.length !== 3) {
    throw new Error("Failed get_live_categories response");
  }

  // 3c. get_live_streams
  const streamReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_live_streams`);
  const streamRes = await handleXtreamRequest({
    req: streamReq,
    url: new URL(streamReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const streamJson = await streamRes.json();
  console.log("Endpoint get_live_streams count:", streamJson.length, streamJson.length === 3 ? "PASSED" : "FAILED");
  if (streamJson.length !== 3) {
    throw new Error("Failed get_live_streams response");
  }

  // 3c-1. get_live_streams with category_id=all
  const streamAllReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_live_streams&category_id=all`);
  const streamAllRes = await handleXtreamRequest({
    req: streamAllReq,
    url: new URL(streamAllReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const streamAllJson = await streamAllRes.json();
  console.log("Endpoint get_live_streams category_id=all count:", streamAllJson.length, streamAllJson.length === 3 ? "PASSED" : "FAILED");
  if (streamAllJson.length !== 3) {
    throw new Error("Failed get_live_streams with category_id=all");
  }

  // 3d. Stream playback: /live/:user/:pass/:streamId.m3u8
  const liveReq = new Request(`http://localhost:3030/live/strm/${currentPass}/${firstStreamId}.m3u8`);
  const liveRes = await handleXtreamRequest({
    req: liveReq,
    url: new URL(liveReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("Stream Playback Status:", liveRes.status, liveRes.status === 302 ? "PASSED (302 Redirect)" : "FAILED");
  console.log("Redirect Location:", liveRes.headers.get("Location"));
  if (liveRes.status !== 302 || liveRes.headers.get("Location") !== "https://stream.example.com/espn/index.m3u8") {
    throw new Error("Stream redirect failed");
  }

  // 3e. get.php (M3U download)
  const getReq = new Request(`http://localhost:3030/get.php?username=strm&password=${currentPass}`);
  const getRes = await handleXtreamRequest({
    req: getReq,
    url: new URL(getReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const getText = await getRes.text();
  console.log("get.php M3U download verified:", getText.includes("#EXTM3U") ? "PASSED" : "FAILED");

  // --- Test 4: VOD and Series Endpoints ---
  console.log("\n--- Test 4: VOD & Series Integration ---");

  // 4a. get_vod_categories
  const vodCatReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_categories`);
  const vodCatRes = await handleXtreamRequest({
    req: vodCatReq,
    url: new URL(vodCatReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodCats = await vodCatRes.json();
  console.log("VOD Categories Count:", vodCats.length, vodCats.length > 0 ? "PASSED" : "FAILED");
  console.log("Sample VOD Category:", vodCats[0]);
  if (!Array.isArray(vodCats) || vodCats.length === 0) {
    throw new Error("Failed get_vod_categories");
  }

  // 4b. get_vod_streams
  const vodStreamReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=${vodCats[0].category_id}`);
  const vodStreamRes = await handleXtreamRequest({
    req: vodStreamReq,
    url: new URL(vodStreamReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodStreams = await vodStreamRes.json();
  console.log(`VOD Streams for Category ${vodCats[0].category_id}:`, vodStreams.length, vodStreams.length > 0 ? "PASSED" : "FAILED");
  console.log("Sample VOD Stream:", vodStreams[0]);
  if (!Array.isArray(vodStreams) || vodStreams.length === 0) {
    throw new Error("Failed get_vod_streams");
  }

  // 4b-1. Test Bulk VOD with disableBulkVod=true (returns 501 to force per-category sync)
  const vodBulk501Req = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams`);
  const vodBulk501Res = await handleXtreamRequest({
    req: vodBulk501Req,
    url: new URL(vodBulk501Req.url),
    config: { ...config, disableBulkVod: true },
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("Bulk VOD with disableBulkVod=true status:", vodBulk501Res.status, vodBulk501Res.status === 501 ? "PASSED (501 Not Implemented)" : "FAILED");
  if (vodBulk501Res.status !== 501) {
    throw new Error("Expected 501 for bulk get_vod_streams when disableBulkVod is true");
  }

  // 4b-2. Test Bulk Series with disableBulkVod=true (returns 501 to force per-category sync)
  const seriesBulk501Req = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series`);
  const seriesBulk501Res = await handleXtreamRequest({
    req: seriesBulk501Req,
    url: new URL(seriesBulk501Req.url),
    config: { ...config, disableBulkVod: true },
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("Bulk Series with disableBulkVod=true status:", seriesBulk501Res.status, seriesBulk501Res.status === 501 ? "PASSED (501 Not Implemented)" : "FAILED");
  if (seriesBulk501Res.status !== 501) {
    throw new Error("Expected 501 for bulk get_series when disableBulkVod is true");
  }

  // 4b-3. Test Per-Category VOD (Loads ~200 items for specific category)
  const vodPerCatReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=1004`);
  const vodPerCatRes = await handleXtreamRequest({
    req: vodPerCatReq,
    url: new URL(vodPerCatReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodPerCatStreams = await vodPerCatRes.json();
  console.log(`Per-category VOD (category_id=1004) count:`, vodPerCatStreams.length, vodPerCatStreams.length >= 100 ? "PASSED" : "FAILED");
  if (vodPerCatRes.status !== 200 || !Array.isArray(vodPerCatStreams) || vodPerCatStreams.length === 0) {
    throw new Error("Failed get_vod_streams for category_id=1004");
  }

  // 4b-4. Test Bulk VOD with disableBulkVod=false (fallback mode)
  const vodAllReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=all`);
  const vodAllRes = await handleXtreamRequest({
    req: vodAllReq,
    url: new URL(vodAllReq.url),
    config: { ...config, disableBulkVod: false },
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodAllStreams = await vodAllRes.json();
  console.log(`VOD 'All' Streams Count (disableBulkVod=false):`, vodAllStreams.length, vodAllStreams.length > 0 ? "PASSED" : "FAILED");
  if (!Array.isArray(vodAllStreams) || vodAllStreams.length === 0) {
    throw new Error("Failed get_vod_streams with category_id=all when disableBulkVod=false");
  }
  // Verify sorted newest to oldest
  const isSorted = parseInt(vodAllStreams[0].added, 10) >= parseInt(vodAllStreams[1].added, 10);
  console.log("VOD sorted newest to oldest check:", isSorted ? "PASSED" : "FAILED");

  // 4b-5. Test Series category_id=all with disableBulkVod=false
  const seriesAllReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series&category_id=all`);
  const seriesAllRes = await handleXtreamRequest({
    req: seriesAllReq,
    url: new URL(seriesAllReq.url),
    config: { ...config, disableBulkVod: false },
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const seriesAllStreams = await seriesAllRes.json();
  console.log(`Series 'All' Streams Count (disableBulkVod=false):`, seriesAllStreams.length, seriesAllStreams.length > 0 ? "PASSED" : "FAILED");
  if (!Array.isArray(seriesAllStreams) || seriesAllStreams.length === 0) {
    throw new Error("Failed get_series with category_id=all when disableBulkVod=false");
  }

  // 4b-3. Test Pagination (page=1, page=2)
  const vodPage1Req = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=28&page=1`);
  const vodPage1Res = await handleXtreamRequest({
    req: vodPage1Req,
    url: new URL(vodPage1Req.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodPage1 = await vodPage1Res.json();
  const page1Header = vodPage1Res.headers.get("X-Page");

  const vodPage2Req = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=28&page=2`);
  const vodPage2Res = await handleXtreamRequest({
    req: vodPage2Req,
    url: new URL(vodPage2Req.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodPage2 = await vodPage2Res.json();
  const page2Header = vodPage2Res.headers.get("X-Page");

  console.log("VOD Pagination (Page 1 count):", vodPage1.length, vodPage1.length === 20 ? "PASSED" : "FAILED");
  console.log("VOD Pagination (Page 2 count):", vodPage2.length, vodPage2.length === 20 ? "PASSED" : "FAILED");
  console.log("VOD Pagination num indexing (Page 2 first num):", vodPage2[0]?.num === 21 ? "PASSED (num=21)" : "FAILED", `num=${vodPage2[0]?.num}`);
  console.log("VOD Pagination headers (X-Page):", page1Header === "1" && page2Header === "2" ? "PASSED" : "FAILED");
  if (vodPage1.length !== 20 || vodPage2.length !== 20 || vodPage2[0]?.num !== 21) {
    throw new Error("Pagination test failed");
  }

  // 4c. get_vod_info (Interstellar tmdbId 157336)
  const vodInfoReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_info&vod_id=157336`);
  const vodInfoRes = await handleXtreamRequest({
    req: vodInfoReq,
    url: new URL(vodInfoReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodInfo = await vodInfoRes.json();
  console.log("VOD Info for 157336:", vodInfo?.movie_data?.name ? "PASSED" : "FAILED", {
    name: vodInfo?.movie_data?.name,
    duration: vodInfo?.info?.duration,
    actors: vodInfo?.info?.actors,
  });
  if (!vodInfo?.movie_data?.name) {
    throw new Error("Failed get_vod_info");
  }

  // 4d. Playback movie: /movie/:username/:password/157336.mp4
  const moviePlayReq = new Request(`http://localhost:3030/movie/strm/${currentPass}/157336.mp4`);
  const moviePlayRes = await handleXtreamRequest({
    req: moviePlayReq,
    url: new URL(moviePlayReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("VOD Movie Playback Status:", moviePlayRes.status, moviePlayRes.status === 302 ? "PASSED" : "FAILED");
  console.log("Movie Redirect Location:", moviePlayRes.headers.get("Location"));
  const expectedMovieLoc = buildVodResolverUrl(157336, config.vodResolverUrl);
  if (moviePlayRes.status !== 302 || moviePlayRes.headers.get("Location") !== expectedMovieLoc) {
    throw new Error(`Movie playback redirect mismatch. Expected: ${expectedMovieLoc}`);
  }

  // 4e. get_series_categories
  const seriesCatReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series_categories`);
  const seriesCatRes = await handleXtreamRequest({
    req: seriesCatReq,
    url: new URL(seriesCatReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const seriesCats = await seriesCatRes.json();
  console.log("Series Categories Count:", seriesCats.length, seriesCats.length > 0 ? "PASSED" : "FAILED");
  console.log("Sample Series Category:", seriesCats[0]);
  if (!Array.isArray(seriesCats) || seriesCats.length === 0) {
    throw new Error("Failed get_series_categories");
  }

  // 4f. Playback series episode: /series/:username/:password/13990102.mp4 (Game of Thrones S01E02)
  // Encoded: series 1399, Season 1, Episode 2 -> 13990102
  const seriesPlayReq = new Request(`http://localhost:3030/series/strm/${currentPass}/13990102.mp4`);
  const seriesPlayRes = await handleXtreamRequest({
    req: seriesPlayReq,
    url: new URL(seriesPlayReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("Series Episode Playback Status:", seriesPlayRes.status, seriesPlayRes.status === 302 ? "PASSED" : "FAILED");
  console.log("Episode Redirect Location:", seriesPlayRes.headers.get("Location"));
  const expectedSeriesLoc = buildSeriesResolverUrl(1399, 1, 2, config.seriesResolverUrl);
  if (seriesPlayRes.status !== 302 || seriesPlayRes.headers.get("Location") !== expectedSeriesLoc) {
    throw new Error(`Series playback redirect mismatch. Expected: ${expectedSeriesLoc}`);
  }

  // 4g. Regression: series with TMDB id >= 100000 must keep the full id
  // Encoded: series 119451 (Wednesday), Season 1, Episode 1 -> 1194510101
  // (bug history: seriesId % 100000 truncated the id -> resolved to wrong show 19451)
  const bigSeriesPlayReq = new Request(`http://localhost:3030/series/strm/${currentPass}/1194510101.mp4`);
  const bigSeriesPlayRes = await handleXtreamRequest({
    req: bigSeriesPlayReq,
    url: new URL(bigSeriesPlayReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("Big Series ID Playback Status:", bigSeriesPlayRes.status, bigSeriesPlayRes.status === 302 ? "PASSED" : "FAILED");
  console.log("Big Series Redirect Location:", bigSeriesPlayRes.headers.get("Location"));
  const expectedBigSeriesLoc = buildSeriesResolverUrl(119451, 1, 1, config.seriesResolverUrl);
  if (bigSeriesPlayRes.status !== 302 || bigSeriesPlayRes.headers.get("Location") !== expectedBigSeriesLoc) {
    throw new Error(`Big series id redirect mismatch. Expected: ${expectedBigSeriesLoc}`);
  }

  // --- Test 5: Aliases & Extended Client Compatibility ---
  console.log("\n--- Test 5: Player Aliases & Compatibility ---");

  // 5a. panel_api.php alias
  const panelReq = new Request(`http://localhost:3030/panel_api.php?username=strm&password=${currentPass}`);
  const panelRes = await handleXtreamRequest({
    req: panelReq,
    url: new URL(panelReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const panelJson = await panelRes.json();
  console.log("panel_api.php alias status:", panelJson?.user_info?.status === "Active" ? "PASSED" : "FAILED");
  console.log("allowed_output_formats:", panelJson?.user_info?.allowed_output_formats);
  if (!panelJson?.user_info?.allowed_output_formats?.includes("mp4")) {
    throw new Error("allowed_output_formats must include mp4 for VOD compatibility");
  }

  // 5b. action=get_series_streams alias
  const seriesStreamsReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series_streams&category_id=1001`);
  const seriesStreamsRes = await handleXtreamRequest({
    req: seriesStreamsReq,
    url: new URL(seriesStreamsReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const seriesStreamsJson = await seriesStreamsRes.json();
  console.log("get_series_streams alias count:", seriesStreamsJson.length, seriesStreamsJson.length > 0 ? "PASSED" : "FAILED");
  if (!Array.isArray(seriesStreamsJson) || seriesStreamsJson.length === 0) {
    throw new Error("Failed get_series_streams alias");
  }

  // 5c. stream_id param fallback for get_vod_info
  const vodFallbackReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_info&stream_id=157336`);
  const vodFallbackRes = await handleXtreamRequest({
    req: vodFallbackReq,
    url: new URL(vodFallbackReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const vodFallbackJson = await vodFallbackRes.json();
  console.log("get_vod_info with stream_id fallback:", vodFallbackJson?.movie_data?.name ? "PASSED" : "FAILED");
  if (!vodFallbackJson?.movie_data?.name) {
    throw new Error("Failed get_vod_info stream_id fallback");
  }

  // 5d. /vod/ route alias
  const vodRouteReq = new Request(`http://localhost:3030/vod/strm/${currentPass}/157336.mp4`);
  const vodRouteRes = await handleXtreamRequest({
    req: vodRouteReq,
    url: new URL(vodRouteReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("/vod/ route alias status:", vodRouteRes.status === 302 ? "PASSED" : "FAILED");
  if (vodRouteRes.status !== 302 || vodRouteRes.headers.get("Location") !== expectedMovieLoc) {
    throw new Error("/vod/ route alias failed redirect");
  }

  // 5e. u/p shortcut params
  const upReq = new Request(`http://localhost:3030/player_api.php?u=strm&p=${currentPass}&action=get_vod_categories`);
  const upRes = await handleXtreamRequest({
    req: upReq,
    url: new URL(upReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const upJson = await upRes.json();
  console.log("u & p shortcut authentication:", Array.isArray(upJson) && upJson.length > 0 ? "PASSED" : "FAILED");
  if (!Array.isArray(upJson) || upJson.length === 0) {
    throw new Error("u & p shortcut authentication failed");
  }

  // 5f. Subtitles field check
  console.log("get_vod_info subtitles field:", Array.isArray(vodFallbackJson?.info?.subtitles) ? "PASSED" : "FAILED");

  // 5g. Search query in get_vod_streams
  const searchReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&search=Avatar`);
  const searchRes = await handleXtreamRequest({
    req: searchReq,
    url: new URL(searchReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const searchJson = await searchRes.json();
  console.log("get_vod_streams search keyword:", Array.isArray(searchJson) && searchJson.some(m => m.name.toLowerCase().includes("avatar")) ? "PASSED" : "FAILED");

  // 5h. action=search endpoint (Matrix)
  const actSearchReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=search&type=movies&context=Matrix`);
  const actSearchRes = await handleXtreamRequest({
    req: actSearchReq,
    url: new URL(actSearchReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const actSearchJson = await actSearchRes.json();
  console.log("action=search movies (Matrix):", Array.isArray(actSearchJson) && actSearchJson.some(m => m.name.toLowerCase().includes("matrix")) ? "PASSED" : "FAILED");

  // 5i. action=search_series endpoint (Breaking Bad)
  const actSeriesSearchReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=search_series&q=Breaking`);
  const actSeriesSearchRes = await handleXtreamRequest({
    req: actSeriesSearchReq,
    url: new URL(actSeriesSearchReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const actSeriesSearchJson = await actSeriesSearchRes.json();
  console.log("action=search_series (Breaking):", Array.isArray(actSeriesSearchJson) && actSeriesSearchJson.some(s => s.name.toLowerCase().includes("breaking")) ? "PASSED" : "FAILED");

  // 5j. Unsupported action test (should log warning and return status Active)
  const unhandledReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=unknown_custom_action&foo=bar`);
  const unhandledRes = await handleXtreamRequest({
    req: unhandledReq,
    url: new URL(unhandledReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const unhandledJson = await unhandledRes.json();
  console.log("unhandled action fallback status:", unhandledJson.user_info.status === "Active" ? "PASSED" : "FAILED");

  // 5k. EPG get_simple_data_table test
  const epgTableReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_simple_data_table&stream_id=123`);
  const epgTableRes = await handleXtreamRequest({
    req: epgTableReq,
    url: new URL(epgTableReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const epgTableJson = await epgTableRes.json();
  console.log("get_simple_data_table empty listings:", Array.isArray(epgTableJson.epg_listings) ? "PASSED" : "FAILED");

  // 5l. /epg.xml & /channel/epg XMLTV EPG test
  const epgXmlReq = new Request("http://localhost:3030/epg.xml");
  const epgXmlRes = await handleXtreamRequest({
    req: epgXmlReq,
    url: new URL(epgXmlReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const epgType = epgXmlRes.headers.get("content-type") || "";
  const isEpgOk = (epgXmlRes.status === 200 || epgXmlRes.status === 302) && (epgType.includes("gzip") || epgType.includes("xml") || Boolean(epgXmlRes.headers.get("location")));
  console.log("/epg.xml XMLTV response:", isEpgOk ? "PASSED" : "FAILED");

  const channelEpgReq = new Request("http://localhost:3030/channel/epg?redirect=true");
  const channelEpgRes = await handleXtreamRequest({
    req: channelEpgReq,
    url: new URL(channelEpgReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  console.log("/channel/epg 302 redirect:", channelEpgRes.status === 302 && channelEpgRes.headers.get("location").includes("epg-us") ? "PASSED" : "FAILED");

  // --- Test 6: Optimizations, Protocol Compatibility & Edge Cache ---
  console.log("\n--- Test 6: Optimizations & Protocol Compatibility ---");

  // 6a. Lazy-load M3U: auth/VOD/Series/EPG must NOT invoke getOrGeneratePlaylist
  let ppvLoadCount = 0;
  const countingGetOrGenerate = async () => {
    ppvLoadCount++;
    return sampleM3u;
  };
  for (const qs of [
    `username=ppv&password=${currentPass}`,
    `username=ppv&password=${currentPass}&action=get_vod_categories`,
    `username=ppv&password=${currentPass}&action=get_vod_info&vod_id=157336`,
    `username=ppv&password=${currentPass}&action=get_series_categories`,
    `username=ppv&password=${currentPass}&action=get_short_epg&stream_id=123`,
  ]) {
    const r = new Request(`http://localhost:3030/player_api.php?${qs}`);
    await handleXtreamRequest({ req: r, url: new URL(r.url), config, getOrGeneratePlaylist: countingGetOrGenerate });
  }
  if (ppvLoadCount !== 0) {
    throw new Error(`Lazy-load failed: expected 0 live playlist loads, got ${ppvLoadCount}`);
  }
  const liveCatLazyReq = new Request(`http://localhost:3030/player_api.php?username=ppv&password=${currentPass}&action=get_live_categories`);
  await handleXtreamRequest({ req: liveCatLazyReq, url: new URL(liveCatLazyReq.url), config, getOrGeneratePlaylist: countingGetOrGenerate });
  const liveStreamLazyReq = new Request(`http://localhost:3030/player_api.php?username=ppv&password=${currentPass}&action=get_live_streams`);
  await handleXtreamRequest({ req: liveStreamLazyReq, url: new URL(liveStreamLazyReq.url), config, getOrGeneratePlaylist: countingGetOrGenerate });
  if (ppvLoadCount !== 1) {
    throw new Error(`Expected exactly 1 live playlist load after get_live_categories + get_live_streams, got ${ppvLoadCount}`);
  }
  console.log("Lazy-load Live M3U only on live actions: PASSED");

  // 6b. Bulk VOD & Series deduplication and normalized schema fields
  const uniqueVodIds = new Set(vodAllStreams.map(v => v.stream_id));
  if (uniqueVodIds.size !== vodAllStreams.length) {
    throw new Error(`Duplicate VOD stream_id detected in bulk catalog: ${vodAllStreams.length} vs ${uniqueVodIds.size}`);
  }
  if (typeof vodAllStreams[0].rating_5based !== "number") {
    throw new Error(`Expected numeric rating_5based, got ${typeof vodAllStreams[0].rating_5based}`);
  }
  if (!vodAllStreams.every(v => parseInt(v.added, 10) >= 0)) {
    throw new Error("Negative added timestamp detected in VOD catalog");
  }
  if (!Array.isArray(vodAllStreams[0].category_ids) || !vodAllStreams[0].category_ids.every(id => typeof id === "number")) {
    throw new Error("Expected numeric category_ids array in VOD catalog");
  }
  const uniqueSeriesIds = new Set(seriesAllStreams.map(s => s.series_id));
  if (uniqueSeriesIds.size !== seriesAllStreams.length) {
    throw new Error(`Duplicate series_id detected in bulk catalog: ${seriesAllStreams.length} vs ${uniqueSeriesIds.size}`);
  }
  if (typeof seriesAllStreams[0].rating_5based !== "number") {
    throw new Error(`Expected numeric series rating_5based, got ${typeof seriesAllStreams[0].rating_5based}`);
  }
  console.log("Bulk VOD/Series deduplication & schema normalization: PASSED");

  // 6c. Episode ID encoding/decoding for >= 100 episodes and delimiter syntax
  const epId100 = encodeEpisodeId(37854, 1, 100);
  const epId1050 = encodeEpisodeId(37854, 1, 1050);
  const dec100 = decodeEpisodeId(epId100);
  const dec1050 = decodeEpisodeId(epId1050);
  if (dec100?.seriesId !== 37854 || dec100?.season !== 1 || dec100?.episode !== 100) {
    throw new Error(`encode/decode failed for S01E100: ${JSON.stringify(dec100)}`);
  }
  if (dec1050?.seriesId !== 37854 || dec1050?.season !== 1 || dec1050?.episode !== 1050) {
    throw new Error(`encode/decode failed for S01E1050: ${JSON.stringify(dec1050)}`);
  }
  const expectedOnePieceLoc = buildSeriesResolverUrl(37854, 1, 1050, config.seriesResolverUrl);
  const ep1050Req = new Request(`http://localhost:3030/series/strm/${currentPass}/${epId1050}.mp4`);
  const ep1050Res = await handleXtreamRequest({ req: ep1050Req, url: new URL(ep1050Req.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  if (ep1050Res.status !== 302 || ep1050Res.headers.get("Location") !== expectedOnePieceLoc) {
    throw new Error(`Episode >=100 redirect failed: ${ep1050Res.headers.get("Location")}`);
  }
  const epDelimReq = new Request(`http://localhost:3030/series/strm/${currentPass}/37854-1-1050.mp4`);
  const epDelimRes = await handleXtreamRequest({ req: epDelimReq, url: new URL(epDelimReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  if (epDelimRes.status !== 302 || epDelimRes.headers.get("Location") !== expectedOnePieceLoc) {
    throw new Error(`Delimiter episode redirect failed: ${epDelimRes.headers.get("Location")}`);
  }
  console.log("Episode ID >=100 & delimiter encoding/decoding: PASSED");

  // 6d. Live TV stable category_id, stable stream_id across LIVE badge, clean schema
  const sampleM3uNoMotorsport = `#EXTM3U
#EXTINF:-1 tvg-name="ESPN HD" group-title="United States",🔴 ESPN HD
https://stream.example.com/espn/index.m3u8
#EXTINF:-1 tvg-id="sky.pl" group-title="United Kingdom",Sky Sports Premier League
https://stream.example.com/skypl/index.m3u8
`;
  const parsedSubset = parseM3uToXtream(sampleM3uNoMotorsport);
  const origUsCat = parsed.categories.find(c => c.category_name === "United States")?.category_id;
  const origUkCat = parsed.categories.find(c => c.category_name === "United Kingdom")?.category_id;
  const subUsCat = parsedSubset.categories.find(c => c.category_name === "United States")?.category_id;
  const subUkCat = parsedSubset.categories.find(c => c.category_name === "United Kingdom")?.category_id;
  if (origUsCat !== subUsCat || origUkCat !== subUkCat) {
    throw new Error(`Unstable category_id across refresh: US ${origUsCat} vs ${subUsCat}, UK ${origUkCat} vs ${subUkCat}`);
  }
  if (parsedSubset.streams[0].stream_id !== firstStreamId) {
    throw new Error(`Stream ID changed when 🔴 prefix added: ${parsedSubset.streams[0].stream_id} vs ${firstStreamId}`);
  }
  if (parsedSubset.streams[0].epg_channel_id !== "" || parsedSubset.streams[0].custom_sid !== "") {
    throw new Error("Expected empty string for missing epg_channel_id and custom_sid");
  }
  if (infoJson.user_info.allowed_output_formats.includes("rtmp")) {
    throw new Error("allowed_output_formats should not include unsupported rtmp");
  }
  console.log("Live TV stable category_id, stream_id & clean schema: PASSED");

  // 6e. Reverse-proxy server_info & timezone time_now
  const proxyReq = new Request(`http://127.0.0.1:3030/player_api.php?username=strm&password=${currentPass}`, {
    headers: {
      "X-Forwarded-Proto": "https",
      "X-Forwarded-Host": "iptv.example.com",
    },
  });
  const proxyRes = await handleXtreamRequest({ req: proxyReq, url: new URL(proxyReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  const proxyJson = await proxyRes.json();
  if (
    proxyJson.server_info.server_protocol !== "https" ||
    proxyJson.server_info.url !== "iptv.example.com" ||
    proxyJson.server_info.port !== "443" ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(proxyJson.server_info.time_now)
  ) {
    throw new Error(`Reverse-proxy server_info mismatch: ${JSON.stringify(proxyJson.server_info)}`);
  }
  console.log("Reverse-proxy server_info & timezone time_now: PASSED");

  // 6f. POST multipart/form-data
  const formData = new FormData();
  formData.append("username", "strm");
  formData.append("password", currentPass);
  formData.append("action", "get_vod_categories");
  const mpReq = new Request("http://localhost:3030/player_api.php", { method: "POST", body: formData });
  const mpRes = await handleXtreamRequest({ req: mpReq, url: new URL(mpReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  const mpJson = await mpRes.json();
  if (!Array.isArray(mpJson) || mpJson.length === 0) {
    throw new Error("POST multipart/form-data failed for player_api.php");
  }
  console.log("POST multipart/form-data parsing: PASSED");

  // 6g. Root playback shortcut /:username/:password/:streamId
  const rootPlayTsReq = new Request(`http://localhost:3030/strm/${currentPass}/${firstStreamId}.ts`);
  const rootPlayTsRes = await handleXtreamRequest({ req: rootPlayTsReq, url: new URL(rootPlayTsReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  const rootPlayRawReq = new Request(`http://localhost:3030/strm/${currentPass}/${firstStreamId}`);
  const rootPlayRawRes = await handleXtreamRequest({ req: rootPlayRawReq, url: new URL(rootPlayRawReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  if (
    rootPlayTsRes.status !== 302 ||
    rootPlayTsRes.headers.get("Location") !== "https://stream.example.com/espn/index.m3u8" ||
    rootPlayRawRes.status !== 302 ||
    rootPlayRawRes.headers.get("Location") !== "https://stream.example.com/espn/index.m3u8"
  ) {
    throw new Error("Root /:user/:pass/:streamId playback shortcut failed");
  }
  console.log("Root /:user/:pass/:streamId playback shortcut: PASSED");

  // 6h. edgeCache adapter hit on repeated get_vod_categories & get_live_categories (with real request origin)
  const fakeEdgeStore = new Map();
  let edgeLiveLoads = 0;
  const mockEdgeCache = {
    async match(key) {
      const hit = fakeEdgeStore.get(key);
      return hit ? hit.clone() : null;
    },
    put(key, res) {
      fakeEdgeStore.set(key, res.clone());
    },
  };
  const edgeVodReq1 = new Request(`http://localhost:3030/player_api.php?username=gk&password=${currentPass}&action=get_vod_categories`);
  const edgeVodRes1 = await handleXtreamRequest({
    req: edgeVodReq1,
    url: new URL(edgeVodReq1.url),
    config,
    getOrGeneratePlaylist: async () => { edgeLiveLoads++; return sampleM3u; },
    edgeCache: mockEdgeCache,
  });
  await edgeVodRes1.json();
  const storeSizeAfterVod = fakeEdgeStore.size;
  for (const cacheKey of fakeEdgeStore.keys()) {
    if (!cacheKey.startsWith("http://localhost:3030/__cache/xtream/v1/")) {
      throw new Error(`Expected edgeCache key with real origin, got: ${cacheKey}`);
    }
  }
  const edgeVodReq2 = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_categories`);
  const edgeVodRes2 = await handleXtreamRequest({
    req: edgeVodReq2,
    url: new URL(edgeVodReq2.url),
    config,
    getOrGeneratePlaylist: async () => { edgeLiveLoads++; return sampleM3u; },
    edgeCache: mockEdgeCache,
  });
  const edgeVodJson2 = await edgeVodRes2.json();
  if (storeSizeAfterVod !== 1 || !Array.isArray(edgeVodJson2) || edgeVodJson2.length === 0) {
    throw new Error("edgeCache failed for get_vod_categories");
  }
  const edgeLiveReq1 = new Request(`http://localhost:3030/player_api.php?username=gk&password=${currentPass}&action=get_live_categories`);
  await handleXtreamRequest({
    req: edgeLiveReq1,
    url: new URL(edgeLiveReq1.url),
    config,
    getOrGeneratePlaylist: async () => { edgeLiveLoads++; return sampleM3u; },
    edgeCache: mockEdgeCache,
  });
  const edgeLiveReq2 = new Request(`http://localhost:3030/player_api.php?username=gk&password=${currentPass}&action=get_live_categories`);
  await handleXtreamRequest({
    req: edgeLiveReq2,
    url: new URL(edgeLiveReq2.url),
    config,
    getOrGeneratePlaylist: async () => { edgeLiveLoads++; return sampleM3u; },
    edgeCache: mockEdgeCache,
  });
  if (edgeLiveLoads !== 1 || fakeEdgeStore.size !== 2) {
    throw new Error(`edgeCache failed for get_live_categories: loads=${edgeLiveLoads}, entries=${fakeEdgeStore.size}`);
  }
  console.log("edgeCache adapter hit with real origin for VOD & Live categories: PASSED");

  // 6i. disableBulkVod="auto": OwnTV gets 501, standard players (TiviMate) get 200 deduplicated bulk catalog
  const autoCfg = { ...config, disableBulkVod: "auto" };
  const ownTvVodReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams`, {
    headers: { "User-Agent": "OwnTV/2.0" },
  });
  const ownTvVodRes = await handleXtreamRequest({ req: ownTvVodReq, url: new URL(ownTvVodReq.url), config: autoCfg, getOrGeneratePlaylist: dummyGetOrGenerate });
  const ownTvSeriesReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series`, {
    headers: { "User-Agent": "OwnTV/2.0" },
  });
  const ownTvSeriesRes = await handleXtreamRequest({ req: ownTvSeriesReq, url: new URL(ownTvSeriesReq.url), config: autoCfg, getOrGeneratePlaylist: dummyGetOrGenerate });
  if (ownTvVodRes.status !== 501 || ownTvSeriesRes.status !== 501) {
    throw new Error(`Expected 501 for OwnTV in auto mode, got VOD=${ownTvVodRes.status}, Series=${ownTvSeriesRes.status}`);
  }

  const tiviVodReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams`, {
    headers: { "User-Agent": "TiviMate/5.1.0" },
  });
  const tiviVodRes = await handleXtreamRequest({ req: tiviVodReq, url: new URL(tiviVodReq.url), config: autoCfg, getOrGeneratePlaylist: dummyGetOrGenerate });
  const tiviVodJson = await tiviVodRes.json();
  const tiviSeriesReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series`, {
    headers: { "User-Agent": "TiviMate/5.1.0" },
  });
  const tiviSeriesRes = await handleXtreamRequest({ req: tiviSeriesReq, url: new URL(tiviSeriesReq.url), config: autoCfg, getOrGeneratePlaylist: dummyGetOrGenerate });
  const tiviSeriesJson = await tiviSeriesRes.json();
  if (
    tiviVodRes.status !== 200 || !Array.isArray(tiviVodJson) || tiviVodJson.length === 0 ||
    tiviSeriesRes.status !== 200 || !Array.isArray(tiviSeriesJson) || tiviSeriesJson.length === 0
  ) {
    throw new Error(`Expected 200 non-empty bulk catalog for TiviMate in auto mode`);
  }
  console.log("disableBulkVod='auto' (501 for OwnTV, 200 bulk for TiviMate): PASSED");

  // --- Test 7: Pre-Built Static Catalog & Per-Category Consistency ---
  console.log("\n--- Test 7: Pre-Built Static Catalog & Consistency ---");
  const fs = require("fs");
  const path = require("path");
  const vodCatalogPath = path.join(__dirname, "public", "catalog", "vod.json");
  const seriesCatalogPath = path.join(__dirname, "public", "catalog", "series.json");
  if (!fs.existsSync(vodCatalogPath) || !fs.existsSync(seriesCatalogPath)) {
    throw new Error("Missing public/catalog/vod.json or public/catalog/series.json");
  }

  const nowLimitSec = Math.floor(Date.now() / 1000) + 86400;
  if (vodAllStreams.length < 800 || seriesAllStreams.length < 500) {
    throw new Error(`Expected rich static catalogs (VOD=${vodAllStreams.length}, Series=${seriesAllStreams.length})`);
  }
  if (!vodAllStreams.every(v => parseInt(v.added, 10) <= nowLimitSec)) {
    throw new Error("Unreleased future movie found in VOD catalog");
  }
  if (!seriesAllStreams.every(s => parseInt(s.added, 10) <= nowLimitSec)) {
    throw new Error("Unreleased future show found in Series catalog");
  }

  const allVodIdSet = new Set(vodAllStreams.map(v => v.stream_id));
  for (const catCheckId of ["1002", "1004", "1040", "1041", "1042", "1050"]) {
    const catReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=${catCheckId}`);
    const catRes = await handleXtreamRequest({ req: catReq, url: new URL(catReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
    const catList = await catRes.json();
    if (!Array.isArray(catList) || catList.length < 15) {
      throw new Error(`VOD category ${catCheckId} returned too few items (${catList?.length || 0})`);
    }
    const missing = catList.filter(item => !allVodIdSet.has(item.stream_id));
    if (missing.length > 0) {
      throw new Error(`Category ${catCheckId} has ${missing.length} items missing from ALL bulk catalog`);
    }
  }
  const allSeriesIdSet = new Set(seriesAllStreams.map(s => s.series_id));
  for (const seriesCatCheckId of ["1040", "1041", "1042", "1050"]) {
    const sCatReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series&category_id=${seriesCatCheckId}`);
    const sCatRes = await handleXtreamRequest({ req: sCatReq, url: new URL(sCatReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
    const sCatList = await sCatRes.json();
    if (!Array.isArray(sCatList) || sCatList.length < 15) {
      throw new Error(`Series category ${seriesCatCheckId} returned too few items (${sCatList?.length || 0})`);
    }
    const missing = sCatList.filter(item => !allSeriesIdSet.has(item.series_id));
    if (missing.length > 0) {
      throw new Error(`Series category ${seriesCatCheckId} has ${missing.length} items missing from ALL bulk catalog`);
    }
  }

  // Verify get_vod_info returns consistent category_id & added from static catalog
  const sampleCatalogMovie = vodAllStreams[0];
  const catInfoReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_info&vod_id=${sampleCatalogMovie.stream_id}`);
  const catInfoRes = await handleXtreamRequest({ req: catInfoReq, url: new URL(catInfoReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate });
  const catInfoJson = await catInfoRes.json();
  if (
    catInfoJson?.movie_data?.category_id !== sampleCatalogMovie.category_id ||
    catInfoJson?.movie_data?.added !== sampleCatalogMovie.added
  ) {
    throw new Error(
      `get_vod_info metadata mismatch for ${sampleCatalogMovie.stream_id}: got (${catInfoJson?.movie_data?.category_id}, ${catInfoJson?.movie_data?.added}) vs catalog (${sampleCatalogMovie.category_id}, ${sampleCatalogMovie.added})`
    );
  }
  console.log("Static catalog size, released-only filter & ALL/Per-Category/Info consistency: PASSED");

  // 7b. Custom catalogLoader injection (simulating Cloudflare env.ASSETS)
  const injectedVod = indexCatalog({
    generatedAt: "2026-11-28T00:00:00Z",
    totalItems: 2,
    categoriesCount: 1,
    items: [
      { num: 1, name: "Injected Movie A (2025)", title: "Injected Movie A", year: "2025", stream_type: "movie", stream_id: 999001, stream_icon: "", rating: "8.0", rating_5based: 4, added: "1750000000", category_id: "1002", category_ids: [1002], container_extension: "mp4", custom_sid: "", direct_source: "" },
      { num: 2, name: "Injected Movie B (2024)", title: "Injected Movie B", year: "2024", stream_type: "movie", stream_id: 999002, stream_icon: "", rating: "7.5", rating_5based: 3.8, added: "1720000000", category_id: "1002", category_ids: [1002], container_extension: "mp4", custom_sid: "", direct_source: "" },
    ],
    byCategory: { "1002": [999001, 999002] },
  });
  const injectedSeries = indexCatalog({
    generatedAt: "2026-11-28T00:00:00Z",
    totalItems: 1,
    categoriesCount: 1,
    items: [
      { num: 1, name: "Injected Show (2025)", title: "Injected Show", year: "2025", stream_type: "series", stream_id: 888001, series_id: 888001, cover: "", stream_icon: "", category_id: "1002", category_ids: [1002], plot: "", cast: "", director: "", genre: "", releaseDate: "2025-01-01", last_modified: "1735689600", added: "1735689600", rating: "8.2", rating_5based: 4.1, backdrop_path: [], youtube_trailer: "", episode_run_time: "45" },
    ],
    byCategory: { "1002": [888001] },
  });
  const mockCatalogLoader = {
    getVodCatalog: async () => injectedVod,
    getSeriesCatalog: async () => injectedSeries,
  };
  const injVodReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_vod_streams&category_id=1002&page=1`);
  const injVodRes = await handleXtreamRequest({ req: injVodReq, url: new URL(injVodReq.url), config, getOrGeneratePlaylist: dummyGetOrGenerate, catalogLoader: mockCatalogLoader });
  const injVodJson = await injVodRes.json();
  const injSeriesReq = new Request(`http://localhost:3030/player_api.php?username=strm&password=${currentPass}&action=get_series`);
  const injSeriesRes = await handleXtreamRequest({ req: injSeriesReq, url: new URL(injSeriesReq.url), config: { ...config, disableBulkVod: false }, getOrGeneratePlaylist: dummyGetOrGenerate, catalogLoader: mockCatalogLoader });
  const injSeriesJson = await injSeriesRes.json();
  if (
    injVodJson.length !== 2 || injVodJson[0].stream_id !== 999001 ||
    injVodRes.headers.get("X-Total-Count") !== "2" ||
    injSeriesJson.length !== 1 || injSeriesJson[0].series_id !== 888001
  ) {
    throw new Error("Injected catalogLoader test failed");
  }
  console.log("Injected catalogLoader (Cloudflare ASSETS mock): PASSED");

  // --- Test 8: Live Sports Optimization (LIVE NOW, sports account, ranking & sanitization) ---
  console.log("\n--- Test 8: Live Sports Optimization ---");

  // 8a. Virtual "🔴 LIVE NOW" category & sport emoji priority ordering
  const liveM3uSample = `#EXTM3U
#EXTINF:-1 tvg-name="Sky F1" group-title="📺 24/7 Sports Channels",Sky F1
https://stream.example.com/skyf1.m3u8
#EXTINF:-1 tvg-name="Lakers vs Celtics" group-title="🏀 Basketball",Lakers vs Celtics | 22:00 🏀
https://stream.example.com/nba.m3u8
#EXTINF:-1 tvg-name="Arsenal vs Chelsea" group-title="⚽ Football / Soccer",🔴 Arsenal vs Chelsea | 20:00 ⚽
https://stream.example.com/epl.m3u8
`;
  const parsedLive = parseM3uToXtream(liveM3uSample);
  if (parsedLive.categories[0]?.category_name !== "🔴 LIVE NOW") {
    throw new Error(`Expected first category to be "🔴 LIVE NOW", got "${parsedLive.categories[0]?.category_name}"`);
  }
  if (parsedLive.categories[1]?.category_name !== "⚽ Football / Soccer") {
    throw new Error(`Expected second category to be "⚽ Football / Soccer", got "${parsedLive.categories[1]?.category_name}"`);
  }
  if (parsedLive.categories[parsedLive.categories.length - 1]?.category_name !== "📺 24/7 Sports Channels") {
    throw new Error(`Expected 24/7 category at bottom, got "${parsedLive.categories[parsedLive.categories.length - 1]?.category_name}"`);
  }
  const liveNowCatId = parsedLive.categories[0].category_id;
  const liveNowStreams = parsedLive.categoryStreams.get(liveNowCatId) || [];
  if (liveNowStreams.length !== 1 || !liveNowStreams[0].name.includes("Arsenal vs Chelsea")) {
    throw new Error(`Expected 1 live stream in "🔴 LIVE NOW", got ${liveNowStreams.length}`);
  }
  if (parsedLive.streams.length !== 3) {
    throw new Error(`Expected 3 total streams without duplication, got ${parsedLive.streams.length}`);
  }
  if (parsed.categories.some(c => c.category_name === "🔴 LIVE NOW")) {
    throw new Error("Should NOT add 🔴 LIVE NOW category when no live streams exist");
  }

  // 8b. sports / sport Xtream credentials
  const cleanCfg = { ...config, xtreamUsers: "" };
  const authSports = authenticateUser("sports", currentPass, cleanCfg);
  const authSportAlias = authenticateUser("sport", currentPass, cleanCfg);
  if (!authSports.valid || authSports.provider !== "sports" || !authSportAlias.valid || authSportAlias.provider !== "sport") {
    throw new Error("Failed Xtream auth for sports / sport provider");
  }

  // 8c. sanitizeM3uAttr, normalizeSportGroup, scoreBroadcastChannel
  if (sanitizeM3uAttr('Jon "Bones" Jones\nUFC') !== "Jon 'Bones' Jones UFC") {
    throw new Error("sanitizeM3uAttr failed to escape quotes/newlines");
  }
  if (normalizeSportGroup("soccer", "UEFA Champions League") !== "⚽ Football / Soccer") {
    throw new Error("normalizeSportGroup failed for soccer");
  }
  if (normalizeSportGroup("motorsport", "Formula 1 Grand Prix") !== "🏎️ Motorsport / F1") {
    throw new Error("normalizeSportGroup failed for motorsport");
  }
  if (
    normalizeSportGroup("24/7-streams") !== "📺 24/7 Sports Channels" ||
    normalizeSportGroup("Football") !== "⚽ Football / Soccer" ||
    normalizeSportGroup("NBA") !== "🏀 Basketball" ||
    normalizeSportGroup("UFC") !== "🥊 Combat / UFC & Boxing"
  ) {
    throw new Error("normalizeSportGroup failed for representative provider inputs");
  }
  const fhdEn = scoreBroadcastChannel({ name: "TNT Sports 1", quality: "FHD", lang: "en", playing: true }, true);
  const sdAr = scoreBroadcastChannel({ name: "Channel X", quality: "SD", lang: "ar", playing: false }, true);
  const offCh = scoreBroadcastChannel({ name: "ESPN", quality: "FHD", status: "offline" }, true);
  if (!(fhdEn > sdAr && offCh < 0)) {
    throw new Error(`scoreBroadcastChannel ranking invalid: fhdEn=${fhdEn}, sdAr=${sdAr}, offCh=${offCh}`);
  }
  console.log("Live Sports LIVE NOW, sports provider, grouping & channel ranking: PASSED");

  console.log("\n🎉 ALL XTREAM CODES API & VOD/SERIES TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runXtreamTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
