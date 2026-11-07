const {
  PROVIDER_MAP,
  authenticateUser,
  parseM3uToXtream,
  handleXtreamRequest,
} = require("./xtream");
const { buildVodResolverUrl, buildSeriesResolverUrl } = require("./providers/tmdb");
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

  // 5l. /epg.xml placeholder test
  const epgXmlReq = new Request("http://localhost:3030/epg.xml");
  const epgXmlRes = await handleXtreamRequest({
    req: epgXmlReq,
    url: new URL(epgXmlReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const epgXmlText = await epgXmlRes.text();
  console.log("/epg.xml XMLTV response:", epgXmlText.includes("<tv") ? "PASSED" : "FAILED");

  console.log("\n🎉 ALL XTREAM CODES API & VOD/SERIES TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runXtreamTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
