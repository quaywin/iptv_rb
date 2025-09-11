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

// Hàm kiểm tra trận đấu (5 phút/lần)
function checkMatches() {
  console.log(
    `[${new Date().toLocaleString()}] Đang kiểm tra các trận gần bắt đầu và cập nhật status live...`,
  );
  try {
    const m3uContent = fs.readFileSync(playlistPath, "utf8");
    const lines = m3uContent.split("\n");
    const now = Date.now();
    const currentYear = new Date().getFullYear();

    lines.forEach((line, idx) => {
      if (line.startsWith("#EXTINF")) {
        // Lấy tên kênh từ tvg-name=""
        const match = line.match(/tvg-name="([^"]+)"/);
        if (match) {
          const channelName = match[1];

          // Khớp định dạng TODAY dd/mm hh:mm ở cuối chuỗi
          const timeMatch = channelName.match(
            /TODAY (\d{2})\/(\d{2}) (\d{2}):(\d{2})$/,
          );
          if (timeMatch) {
            const day = timeMatch[1];
            const month = timeMatch[2];
            const hour = timeMatch[3];
            const minute = timeMatch[4];
            // Tạo timestamp với năm hiện tại
            const matchTimestamp = new Date(
              `${currentYear}-${month}-${day}T${hour}:${minute}:00`,
            ).getTime();

            const timeToStart = matchTimestamp - now;
            const timeSinceStart = now - matchTimestamp;

            if (timeToStart > 0 && timeToStart < 30 * 60 * 1000) {
              console.log(
                `  ⚽ Sắp bắt đầu: ${channelName} (còn ${Math.round(timeToStart / 60000)} phút)`,
              );
            }

            if (timeSinceStart > 0 && timeSinceStart < 3 * 60 * 60 * 1000) {
              if (!channelName.startsWith("🔴 |")) {
                const newChannelName = `🔴 | ${channelName}`;
                // Thay thế tên kênh trong dòng EXTINF
                lines[idx] = line.replace(channelName, newChannelName);
                console.log(
                  `  🟢 Đã cập nhật trạng thái LIVE cho: ${channelName}`,
                );
              }
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
// cron.schedule("0 */2 * * *", updatePlaylist); // mỗi 2 giờ
// cron.schedule("*/5 * * * *", checkMatches); // mỗi 5 phút

// Chạy ngay khi khởi động
// updatePlaylist();
checkMatches();

console.log("Scheduler đã khởi động!");
