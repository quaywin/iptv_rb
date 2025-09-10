const fs = require("fs");
const path = require("path");

// Hàm delay để tránh spam API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm chuyển đổi timestamp sang định dạng ngày giờ
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  // So sánh ngày/tháng/năm
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  let dayOfWeek;
  if (isToday) {
    dayOfWeek = "TODAY";
  } else if (isTomorrow) {
    dayOfWeek = "TMR";
  } else {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    dayOfWeek = days[date.getDay()];
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${dayOfWeek} ${day}/${month} ${hours}:${minutes}`;
}

// Hàm lấy ngày theo định dạng dd/mm/yyyy
function getFormattedDate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Hàm gọi API để lấy danh sách trận đấu cho một ngày
async function getMatchListForDate(dateString) {
  try {
    const response = await fetch(
      `https://api.robong.net/match/list?sport_type=football&date=${dateString}&type=schedule`,
    );
    const data = await response.json();

    if (!data.status) {
      throw new Error(`API Error: ${data.msg}`);
    }

    return data.result || [];
  } catch (error) {
    console.error(`Error fetching match list for date ${dateString}:`, error);
    return [];
  }
}

// Hàm gọi API để lấy danh sách trận đấu cho hôm nay và ngày mai
async function getMatchList() {
  const daysToFetch = 8; // hôm qua + hôm nay + 6 ngày tiếp theo
  const dateStrings = [];
  for (let i = -1; i < daysToFetch - 1; i++) {
    dateStrings.push(getFormattedDate(i));
  }

  console.log(`Đang lấy dữ liệu cho các ngày: ${dateStrings.join(", ")}`);

  try {
    // Gọi API song song cho cả 2 ngày
    const matchesByDay = await Promise.all(
      dateStrings.map((date) => getMatchListForDate(date)),
    );

    const allMatches = [].concat(...matchesByDay);

    // Gộp kết quả từ 2 ngày
    const allCompetitions = [];
    const competitionMap = new Map();

    allMatches.forEach((competition) => {
      if (!competition || !competition._id) return;
      if (competitionMap.has(competition._id)) {
        competitionMap
          .get(competition._id)
          .matches.push(...competition.matches);
      } else {
        competitionMap.set(competition._id, { ...competition });
      }
    });

    // Chuyển Map thành Array
    competitionMap.forEach((competition) => {
      competition.matches.sort((a, b) => a.match_time - b.match_time);
      allCompetitions.push(competition);
    });

    const totalMatches = allCompetitions.reduce(
      (sum, comp) => sum + comp.matches.length,
      0,
    );
    console.log(
      `Tổng cộng: ${allCompetitions.length} giải đấu, ${totalMatches} trận đấu`,
    );

    return allCompetitions;
  } catch (error) {
    console.error("Error fetching match lists:", error);
    return [];
  }
}

// Hàm gọi API để lấy thông tin chi tiết trận đấu
async function getMatchInfo(roomId) {
  try {
    const response = await fetch(
      `https://api.robong.net/match/info?room_id=${roomId}`,
    );
    const data = await response.json();

    if (!data.status) {
      throw new Error(`API Error: ${data.msg}`);
    }

    return data.result;
  } catch (error) {
    console.error(`Error fetching match info for room ${roomId}:`, error);
    return null;
  }
}

// Hàm tạo nội dung IPTV M3U
async function generateIPTVFile() {
  console.log("Bắt đầu lấy danh sách trận đấu...");
  const competitions = await getMatchList();

  if (competitions.length === 0) {
    console.log("Không có trận đấu nào được tìm thấy.");
    return;
  }

  // Header của file M3U
  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  let processedMatches = 0;

  // Gộp tất cả các trận từ mọi giải vào một mảng duy nhất, loại bỏ trận trùng
  const matchMap = new Map();
  competitions.forEach((competition) => {
    competition.matches.forEach((match) => {
      if (!matchMap.has(match._id)) {
        matchMap.set(match._id, {
          competition,
          match,
        });
      }
    });
  });
  const allMatches = Array.from(matchMap.values());

  // Sort tất cả các trận theo thời gian
  allMatches.sort((a, b) => a.match.match_time - b.match.match_time);

  console.log(
    `\nBắt đầu xử lý ${allMatches.length} trận đấu đã được sắp xếp theo thời gian.`,
  );

  // Duyệt qua từng trận đã sort
  for (const item of allMatches) {
    const { competition, match } = item;
    const homeTeam = match.home_team.short_name || match.home_team.name;
    const awayTeam = match.away_team.short_name || match.away_team.name;
    const matchDateTime = formatDateTime(match.match_time);

    console.log(`  ⚽ ${homeTeam} vs ${awayTeam} - ${matchDateTime}`);

    for (const room of match.rooms) {
      try {
        const matchInfo = await getMatchInfo(room._id);

        if (
          matchInfo &&
          matchInfo.room &&
          matchInfo.room.servers &&
          matchInfo.room.servers.length > 0
        ) {
          const server = matchInfo.room.servers.find((s) => s.id == 4);

          if (server) {
            // Chỉ thêm nếu tìm thấy server id==4
            let channelName = `${homeTeam} vs ${awayTeam} - ${matchDateTime}`;
            if (match.status_text === "live") {
              channelName = `🔴 | ${channelName}`;
            }
            const groupTitle = competition.short_name || competition.name;

            m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${competition.logo}" group-title="${groupTitle}",${channelName}\n`;
            m3uContent += `${server.stream_url}\n\n`;

            console.log(
              `    ✓ Đã thêm server: ${server.name} (${server.type})`,
            );
            processedMatches++;
            await delay(500);

            break; // Nếu đã thêm thì dừng vòng lặp room
          } else {
            console.log(`    ⚠ Không có server id==4 cho trận này`);
          }
        } else {
          console.log(`    ⚠ Không có server cho trận này`);
        }
      } catch (error) {
        console.error(`    ✗ Lỗi khi xử lý room ${room._id}:`, error.message);
      }
    }
  }

  // Lưu file
  const outputPath = path.join(__dirname, `current_playlist.m3u`);

  try {
    fs.writeFileSync(outputPath, m3uContent, "utf8");
    console.log(`\n✅ Đã tạo file IPTV thành công: ${outputPath}`);
    console.log(
      `📊 Tổng cộng đã xử lý: ${processedMatches}/${allMatches.length} trận đấu`,
    );

    // Hiển thị thống kê
    const lines = m3uContent.split("\n");
    const channelCount = lines.filter((line) =>
      line.startsWith("#EXTINF"),
    ).length;
    console.log(`📺 Số kênh trong file M3U: ${channelCount}`);

    // Hiển thị thống kê theo giải đấu
    console.log("\n📋 Thống kê theo giải đấu:");
    competitions.forEach((competition) => {
      const matchCount = competition.matches.length;
      console.log(`  - ${competition.name}: ${matchCount} trận`);
    });
  } catch (error) {
    console.error("❌ Lỗi khi lưu file:", error);
  }
}

// Chạy script
async function main() {
  console.log("🚀 Bắt đầu tạo file IPTV cho các trận bóng đá (2 ngày)...\n");
  await generateIPTVFile();
}

// Chạy script và xử lý lỗi
main().catch((error) => {
  console.error("❌ Lỗi chung:", error);
  process.exit(1);
});
