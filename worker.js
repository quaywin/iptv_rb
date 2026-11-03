const fs = require("fs");
const path = require("path");
const config = require("./config");
const { generateIPTVFile } = require("./generate");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
const PLAYLIST_FILE = path.join(DATA_DIR, "playlist.m3u");

async function runWorker() {
  console.log(`[${new Date().toISOString()}] Starting playlist update...`);

  try {
    const content = await generateIPTVFile();
    if (!content || !content.trim()) {
      return console.log("⚠️ Failed to generate playlist or empty result.");
    }

    fs.writeFileSync(PLAYLIST_FILE, content);
    const count = (content.match(/#EXTINF/g) || []).length;
    console.log(`✅ Updated playlist.m3u (${count} streams)`);
  } catch (error) {
    console.error("❌ Worker error:", error);
  }
}

runWorker();
setInterval(runWorker, config.checkInterval);
