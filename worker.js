const fs = require("fs");
const path = require("path");
const config = require("./config");
const { generateIPTVFile } = require("./generate");

// Cấu hình
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
const PLAYLIST_FILE = path.join(DATA_DIR, "playlist.m3u");

// Main logic
async function runWorker() {
  console.log(`[${new Date().toISOString()}] Starting playlist update...`);

  try {
    const originalContent = await generateIPTVFile();
    if (!originalContent) return console.log("⚠️ Failed to generate playlist.");

    const lines = originalContent.split("\n");
    const newLines = [];
    let currentEntry = [];
    let isLive = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("#EXTINF")) {
        currentEntry = [trimmed];
        isLive = trimmed.includes("🔴");
      } else if (trimmed.startsWith("http") || trimmed.startsWith("PROXY://")) {
        if (isLive) {
          // Add Direct
          newLines.push(...currentEntry, trimmed, "");

          // Add Backup (Proxy)
          const inf = currentEntry[0];
          const lastComma = inf.lastIndexOf(",");
          if (lastComma !== -1) {
            const meta = inf.substring(0, lastComma);
            const title = inf.substring(lastComma + 1);
            newLines.push(`${meta},${title} [Backup]`, `PROXY://${trimmed}`, "");
          }
        } else {
          newLines.push(...currentEntry, trimmed, "");
        }
        currentEntry = [];
      } else if (trimmed.startsWith("#EXTM3U")) {
        newLines.push(trimmed, "");
      }
    }

    const finalContent = newLines.join("\n");
    fs.writeFileSync(PLAYLIST_FILE, finalContent);
    const count = (finalContent.match(/#EXTINF/g) || []).length;
    console.log(`✅ Updated playlist.m3u (${count} channels)`);

  } catch (error) {
    console.error("❌ Worker error:", error);
  }
}

runWorker();
setInterval(runWorker, config.checkInterval);
