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
  try {
    // 1. STRM Provider
    console.log("=== Step 1: Testing STRM Provider (generateStrmPlaylist) ===");
    const strmContent = await generateStrmPlaylist();
    const strmCount = (strmContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ STRM playlist generated: ${strmCount} streams.`);
    fs.writeFileSync("test-strm.m3u", strmContent);

    // 2. PPV Provider
    console.log("\n=== Step 2: Testing PPV Provider (generatePpvPlaylist) ===");
    const ppvContent = await generatePpvPlaylist();
    const ppvCount = (ppvContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ PPV playlist generated: ${ppvCount} streams.`);
    fs.writeFileSync("test-ppv.m3u", ppvContent);

    // 3. TimStreams Channels (24/7)
    console.log("\n=== Step 3: Testing TimStreams Channels (generateTimChannelsPlaylist) ===");
    const timChannelsContent = await generateTimChannelsPlaylist();
    const timChannelsCount = (timChannelsContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ TimChannels playlist generated: ${timChannelsCount} channels.`);
    fs.writeFileSync("test-channels.m3u", timChannelsContent);

    // 4. Channel2: SportsBite Channels (24/7)
    console.log("\n=== Step 4: Testing SportsBite Channels (generateSportsbitePlaylist) ===");
    const channel2Content = await generateSportsbitePlaylist();
    const channel2Count = (channel2Content.match(/#EXTINF/g) || []).length;
    console.log(`✅ SportsBite /channel2 playlist generated: ${channel2Count} channels.`);
    fs.writeFileSync("test-channel2.m3u", channel2Content);

    // 4b. Channel3: VidCDN Channels (24/7)
    console.log("\n=== Step 4b: Testing VidCDN Channels (generateChannel3Playlist) ===");
    const channel3Content = await generateChannel3Playlist();
    const channel3Count = (channel3Content.match(/#EXTINF/g) || []).length;
    console.log(`✅ VidCDN /channel3 playlist generated: ${channel3Count} channels.`);
    fs.writeFileSync("test-channel3.m3u", channel3Content);

    // 5. TimStreams Live Events
    console.log("\n=== Step 5: Testing TimStreams Live (generateTimLivePlaylist) ===");
    const timLiveContent = await generateTimLivePlaylist();
    const timLiveCount = (timLiveContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ TimLive playlist generated: ${timLiveCount} live events.`);
    fs.writeFileSync("test-tim.m3u", timLiveContent);

    // 6. GK Provider (ReedStreams)
    console.log("\n=== Step 6: Testing GK Provider (generateGkPlaylist) ===");
    const gkContent = await generateGkPlaylist();
    const gkCount = (gkContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ GK playlist generated: ${gkCount} matches.`);
    fs.writeFileSync("test-gk.m3u", gkContent);

    // 7. PitSport Provider
    console.log("\n=== Step 7: Testing PitSport Provider (generatePitPlaylist) ===");
    const pitContent = await generatePitPlaylist();
    const pitCount = (pitContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ PitSport playlist generated: ${pitCount} programs.`);
    fs.writeFileSync("test-pit.m3u", pitContent);

    // 8. Cinevid Provider
    console.log("\n=== Step 8: Testing Cinevid Provider (generateCinePlaylist) ===");
    const cineContent = await generateCinePlaylist();
    const cineCount = (cineContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ Cinevid playlist generated: ${cineCount} events.`);
    fs.writeFileSync("test-cine.m3u", cineContent);

    // 9. Combined Provider
    console.log("\n=== Step 9: Testing Combined Provider (generateCombinedPlaylist) ===");
    const allContent = await generateCombinedPlaylist();
    const allCount = (allContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ Combined playlist generated: ${allCount} total streams.`);
    fs.writeFileSync("test-all.m3u", allContent);

    // 10. Test Scraper with sample streams from providers
    console.log("\n=== Step 10: Testing Scraper Service Integration ===");
    const strmSample = strmContent.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (strmSample) await testScraper(strmSample, "STRM");

    const ppvSample = ppvContent.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (ppvSample) await testScraper(ppvSample, "PPV");

    const gkSample = gkContent.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (gkSample) await testScraper(gkSample, "GK");

    const pitSample = pitContent.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (pitSample) await testScraper(pitSample, "PitSport");

    const cineSample = cineContent.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (cineSample) await testScraper(cineSample, "Cinevid");

    const channel3Sample = channel3Content.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (channel3Sample) await testScraper(channel3Sample, "Channel3");

    const channelSample = timChannelsContent.split("\n").find(l => l.startsWith("http://") || l.startsWith("https://"));
    if (channelSample) await testScraper(channelSample, "TimChannels");

    console.log("\n🎉 All tests passed successfully!");
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

runTest();
