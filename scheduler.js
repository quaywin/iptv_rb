const cron = require("node-cron");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const playlistPath = path.join(__dirname, "current_playlist.m3u");

// Hàm cập nhật playlist (2 giờ/lần)
function updatePlaylist() {
  console.log(
    `[${new Date().toLocaleString()}] Đang chạy generate.js để cập nhật playlist...`,
  );
  exec("node generate.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Lỗi khi chạy generate.js: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`STDERR: ${stderr}`);
    }
    console.log(`Kết quả generate.js:\n${stdout}`);
  });
}

async function getLiveMatchIds() {
  try {
    const response = await fetch("https://api.robong.net/match/live");
    const data = await response.json();
    if (!data.status) return [];
    // Lấy tất cả _id của các trận bóng đá đang live
    return (data.result.footballMatches || []).map((match) => match._id);
  } catch (err) {
    console.error("Lỗi khi lấy danh sách trận live:", err.message);
    return [];
  }
}

// Hàm kiểm tra trận đấu (5 phút/lần)
async function checkMatches() {
  console.log(
    `[${new Date().toLocaleString()}] Đang kiểm tra trạng thái LIVE từ API...`,
  );
  try {
    const liveMatchIds = await getLiveMatchIds();
    const m3uContent = fs.readFileSync(playlistPath, "utf8");
    const lines = m3uContent.split("\n");

    lines.forEach((line, idx) => {
      if (line.startsWith("#EXTINF")) {
        // Giả sử bạn đã lưu _id vào tvg-id="..."
        const idMatch = line.match(/tvg-id="([^"]+)"/);
        if (idMatch) {
          const matchId = idMatch[1];
          if (liveMatchIds.includes(matchId)) {
            // Đang LIVE, thêm "🔴 |" nếu chưa có
            const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
            const commaMatch = line.match(/,([^,]+)$/);
            let tvgName = tvgNameMatch ? tvgNameMatch[1] : "";
            let commaName = commaMatch ? commaMatch[1] : "";
            let updated = false;
            if (!tvgName.startsWith("🔴 |")) {
              tvgName = `🔴 | ${tvgName}`;
              updated = true;
            }
            if (!commaName.startsWith("🔴 |")) {
              commaName = `🔴 | ${commaName}`;
              updated = true;
            }
            if (updated) {
              let newLine = line.replace(
                /tvg-name="([^"]+)"/,
                `tvg-name="${tvgName}"`,
              );
              newLine = newLine.replace(/,([^,]+)$/, `,${commaName}`);
              lines[idx] = newLine;
              console.log(`  🟢 Đã cập nhật trạng thái LIVE cho: ${commaName}`);
            }
          }
        }
      }
    });

    fs.writeFileSync(playlistPath, lines.join("\n"), "utf8");
  } catch (err) {
    console.error("Lỗi khi đọc hoặc cập nhật playlist:", err.message);
  }
}

// Tạo cron job
cron.schedule("0 */2 * * *", updatePlaylist); // mỗi 2 giờ
cron.schedule("*/5 * * * *", checkMatches); // mỗi 5 phút

// Chạy ngay khi khởi động
updatePlaylist();
checkMatches();

console.log("Scheduler đã khởi động!");
