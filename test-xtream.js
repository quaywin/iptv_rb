const {
  PROVIDER_MAP,
  authenticateUser,
  parseM3uToXtream,
  handleXtreamRequest,
} = require("./xtream");
const config = require("./config");

async function runXtreamTests() {
  console.log("=== Starting Xtream Codes API Unit & Integration Tests ===\n");

  // --- Test 1: Authentication ---
  console.log("--- Test 1: Authentication ---");

  // Default password is config.xtreamPassword (default 'iptv')
  const authValid = authenticateUser("strm", "iptv", config);
  console.log("Valid user (strm / iptv):", authValid.valid ? "PASSED" : "FAILED", authValid);
  if (!authValid.valid || authValid.provider !== "strm") {
    throw new Error("Auth test failed for valid user");
  }

  const authInvalidPass = authenticateUser("strm", "wrong_pass", config);
  console.log("Invalid password (strm / wrong_pass):", !authInvalidPass.valid ? "PASSED (rejected)" : "FAILED");
  if (authInvalidPass.valid) {
    throw new Error("Auth test failed: accepted wrong password");
  }

  const authInvalidProvider = authenticateUser("nonexistent", "iptv", config);
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
  const infoReq = new Request("http://localhost:3030/player_api.php?username=strm&password=iptv");
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
  const catReq = new Request("http://localhost:3030/player_api.php?username=strm&password=iptv&action=get_live_categories");
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
  const streamReq = new Request("http://localhost:3030/player_api.php?username=strm&password=iptv&action=get_live_streams");
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

  // 3d. Stream playback: /live/:user/:pass/:streamId.m3u8
  const liveReq = new Request(`http://localhost:3030/live/strm/iptv/${firstStreamId}.m3u8`);
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
  const getReq = new Request("http://localhost:3030/get.php?username=strm&password=iptv");
  const getRes = await handleXtreamRequest({
    req: getReq,
    url: new URL(getReq.url),
    config,
    getOrGeneratePlaylist: dummyGetOrGenerate,
  });
  const getText = await getRes.text();
  console.log("get.php M3U download verified:", getText.includes("#EXTM3U") ? "PASSED" : "FAILED");

  console.log("\n🎉 ALL XTREAM CODES API TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runXtreamTests().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
