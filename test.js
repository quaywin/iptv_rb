const {
  generateStrmPlaylist,
  generatePpvPlaylist,
  generateTimLivePlaylist,
  generateTimChannelsPlaylist,
  generateSportsbitePlaylist,
  generateChannel3Playlist,
  generateGkPlaylist,
  generatePitPlaylist,
  generateCinePlaylist,
  generateDamPlaylist,
  generateSports247Playlist,
  generateChannel4Playlist,
  generateChannel5Playlist,
  generateCdnPlaylist,
  generateCombinedPlaylist,
} = require("./generate");
const config = require("./config");
const fs = require("fs");

async function testScraper(streamUrl, label) {
  console.log(`\nTesting Scraper for ${label}:\n${streamUrl}`);
  const res = await fetch(streamUrl, {
    redirect: "manual",
    headers: {
      "User-Agent": config.userAgent,
      "Referer": config.referer,
      "Origin": config.origin,
    }
  });

  console.log(`Scraper HTTP Status: ${res.status}`);
  if (res.status === 200) {
    const text = await res.text();
    const hasSegments = text.includes("#EXTINF");
    console.log(`✅ [${label}] Scraper returned M3U8 directly (200 OK)! Has segments: ${hasSegments}`);
  } else if (res.status === 302) {
    const location = res.headers.get("location");
    console.log(`✅ [${label}] Scraper 302 Redirect verified: ${location.slice(0, 80)}...`);
  } else {
    console.warn(`⚠️ [${label}] Unexpected scraper status: ${res.status}`);
  }
}

async function runTest() {
  const results = {};

  async function safeGenerate(stepName, fn, filename) {
    console.log(`\n=== ${stepName} ===`);
    try {
      const content = await fn();
      const count = (content.match(/#EXTINF/g) || []).length;
      const urls = content.split("\n").filter(l => l.startsWith("http://") || l.startsWith("https://"));
      const sample = urls[0] || "";
      const hasProxySegments = sample ? sample.includes("proxy_segments=true") : false;
      console.log(`✅ ${stepName} generated: ${count} items | proxy_segments: ${hasProxySegments}`);
      if (filename) fs.writeFileSync(filename, content);
      results[stepName] = { ok: true, count, sample, hasProxySegments, content };
      return content;
    } catch (err) {
      console.warn(`⚠️ [${stepName}] Generation failed (upstream mirror may be down): ${err.message}`);
      results[stepName] = { ok: false, error: err.message, content: "" };
      return "";
    }
  }

  // 1. STRM Provider
  const strmContent = await safeGenerate("Step 1: STRM Provider", generateStrmPlaylist, "test-strm.m3u");

  // 2. PPV Provider
  const ppvContent = await safeGenerate("Step 2: PPV Provider", generatePpvPlaylist, "test-ppv.m3u");

  // 3. TimStreams Channels (24/7)
  const timChannelsContent = await safeGenerate("Step 3: TimChannels (24/7)", generateTimChannelsPlaylist, "test-channels.m3u");

  // 4. Channel2: SportsBite Channels (24/7)
  const channel2Content = await safeGenerate("Step 4: SportsBite /channel2 (24/7)", generateSportsbitePlaylist, "test-channel2.m3u");

  // 4b. Channel3: VidCDN Channels (24/7)
  const channel3Content = await safeGenerate("Step 4b: VidCDN /channel3 (24/7)", generateChannel3Playlist, "test-channel3.m3u");

  // 5. TimStreams Live Events
  const timLiveContent = await safeGenerate("Step 5: TimLive", generateTimLivePlaylist, "test-tim.m3u");

  // 6. GK Provider (ReedStreams)
  const gkContent = await safeGenerate("Step 6: GK Provider", generateGkPlaylist, "test-gk.m3u");

  // 7. PitSport Provider
  const pitContent = await safeGenerate("Step 7: PitSport Provider", generatePitPlaylist, "test-pit.m3u");

  // 8. Cinevid Provider
  const cineContent = await safeGenerate("Step 8: Cinevid Provider", generateCinePlaylist, "test-cine.m3u");

  // 8c. DAM Provider (ondemand.st)
  const damContent = await safeGenerate("Step 8c: DAM Provider", generateDamPlaylist, "test-dam.m3u");

  // 8d. Sports247 Provider (en.sports247.ru /247)
  const s247Content = await safeGenerate("Step 8d: Sports247 /247 Provider", generateSports247Playlist, "test-247.m3u");

  // 8e. Channel4: Sports247 24/7 Channels (/channel4)
  const channel4Content = await safeGenerate("Step 8e: Sports247 /channel4", generateChannel4Playlist, "test-channel4.m3u");

  // 8f. Channel5: CDN Live TV 24/7 Channels (/channel5)
  const channel5Content = await safeGenerate("Step 8f: CDN Live TV /channel5", generateChannel5Playlist, "test-channel5.m3u");

  // 8g. CDN: CDN Live Sports Events (/cdn)
  const cdnContent = await safeGenerate("Step 8g: CDN Live Events /cdn", generateCdnPlaylist, "test-cdn.m3u");

  // 9. Combined Provider
  console.log("\n=== Step 9: Testing Combined Provider (generateCombinedPlaylist) ===");
  try {
    const allContent = await generateCombinedPlaylist();
    const allCount = (allContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ Combined playlist generated: ${allCount} total streams.`);
    fs.writeFileSync("test-all.m3u", allContent);
  } catch (err) {
    console.warn("⚠️ Combined playlist generation error:", err.message);
  }

  // 10. Test Scraper with sample streams from providers
  console.log("\n=== Step 10: Testing Scraper Service Integration ===");
  const samplesToTest = [
    { label: "TimChannels", content: timChannelsContent },
    { label: "Sports247 Channels (Channel4)", content: channel4Content },
    { label: "CDN Channels (Channel5)", content: channel5Content },
    { label: "DAM", content: damContent },
    { label: "PitSport", content: pitContent },
    { label: "STRM", content: strmContent },
    { label: "PPV", content: ppvContent },
  ];

  for (const s of samplesToTest) {
    if (s.content) {
      const url = s.content.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
      if (url) {
        await testScraper(url, s.label);
      }
    }
  }

  console.log("\n🎉 Testing completed!");
}

runTest();
