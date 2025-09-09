const fs = require("fs");
const path = require("path");

// Hàm delay để tránh spam API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm chuyển đổi timestamp sang định dạng ngày giờ
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
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
  const yesterday = getFormattedDate(-1);
  const today = getFormattedDate(0); // Ngày hôm nay
  const tomorrow = getFormattedDate(1); // Ngày mai

  console.log(`Đang lấy dữ liệu cho ngày hôm qua: ${yesterday}`);
  console.log(`Đang lấy dữ liệu cho ngày hôm nay: ${today}`);
  console.log(`Đang lấy dữ liệu cho ngày mai: ${tomorrow}`);

  try {
    // Gọi API song song cho cả 2 ngày
    const [yesterdayMatches, todayMatches, tomorrowMatches] = await Promise.all(
      [
        getMatchListForDate(yesterday),
        getMatchListForDate(today),
        getMatchListForDate(tomorrow),
      ],
    );

    console.log(`Hôm qua (${yesterday}): ${yesterdayMatches.length} giải đấu`);
    console.log(`Hôm nay (${today}): ${todayMatches.length} giải đấu`);
    console.log(`Ngày mai (${tomorrow}): ${tomorrowMatches.length} giải đấu`);

    // Gộp kết quả từ 2 ngày
    const allCompetitions = [];
    const competitionMap = new Map();

    yesterdayMatches.forEach((competition) => {
      if (competitionMap.has(competition._id)) {
        // Nếu giải đấu đã tồn tại, thêm trận đấu vào
        competitionMap
          .get(competition._id)
          .matches.push(...competition.matches);
      } else {
        // Thêm giải đấu mới
        competitionMap.set(competition._id, { ...competition });
      }
    });

    // Xử lý trận đấu hôm nay
    todayMatches.forEach((competition) => {
      if (competitionMap.has(competition._id)) {
        // Nếu giải đấu đã tồn tại, thêm trận đấu vào
        competitionMap
          .get(competition._id)
          .matches.push(...competition.matches);
      } else {
        // Thêm giải đấu mới
        competitionMap.set(competition._id, { ...competition });
      }
    });

    // Xử lý trận đấu ngày mai
    tomorrowMatches.forEach((competition) => {
      if (competitionMap.has(competition._id)) {
        // Nếu giải đấu đã tồn tại, thêm trận đấu vào
        competitionMap
          .get(competition._id)
          .matches.push(...competition.matches);
      } else {
        // Thêm giải đấu mới
        competitionMap.set(competition._id, { ...competition });
      }
    });

    // Chuyển Map thành Array
    competitionMap.forEach((competition) => {
      allCompetitions.push(competition);
    });

    // Sắp xếp trận đấu theo thời gian
    allCompetitions.forEach((competition) => {
      competition.matches.sort((a, b) => a.match_time - b.match_time);
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

  let totalMatches = 0;
  let processedMatches = 0;

  // Đếm tổng số trận đấu
  competitions.forEach((competition) => {
    totalMatches += competition.matches.length;
  });

  console.log(
    `\nBắt đầu xử lý ${totalMatches} trận đấu trong ${competitions.length} giải đấu.`,
  );

  // Duyệt qua từng giải đấu
  for (const competition of competitions) {
    console.log(
      `\n📺 Đang xử lý giải đấu: ${competition.name} (${competition.matches.length} trận)`,
    );

    // Duyệt qua từng trận đấu trong giải
    for (const match of competition.matches) {
      const homeTeam = match.home_team.short_name || match.home_team.name;
      const awayTeam = match.away_team.short_name || match.away_team.name;
      const matchDateTime = formatDateTime(match.match_time);

      console.log(`  ⚽ ${homeTeam} vs ${awayTeam} - ${matchDateTime}`);

      // Duyệt qua từng room của trận đấu
      for (const room of match.rooms) {
        try {
          // Lấy thông tin chi tiết trận đấu
          const matchInfo = await getMatchInfo(room._id);

          if (
            matchInfo &&
            matchInfo.room &&
            matchInfo.room.servers &&
            matchInfo.room.servers.length > 0
          ) {
            // Lấy server đầu tiên (có thể tùy chỉnh để chọn server khác)
            const server = matchInfo.room.servers.find((s) => s.id == 4);

            // Tạo tên kênh
            const channelName = `${homeTeam} vs ${awayTeam} - ${matchDateTime}`;
            const groupTitle = competition.short_name || competition.name;

            // Thêm vào nội dung M3U
            m3uContent += `#EXTINF:-1 tvg-name="${channelName}" group-title="${groupTitle}",${channelName}\n`;
            m3uContent += `${server.stream_url}\n\n`;

            console.log(
              `    ✓ Đã thêm server: ${server.name} (${server.type})`,
            );
          } else {
            console.log(`    ⚠ Không có server cho trận này`);
          }

          processedMatches++;

          // Delay để tránh spam API
          await delay(500);
        } catch (error) {
          console.error(`    ✗ Lỗi khi xử lý room ${room._id}:`, error.message);
        }
      }
    }
  }

  // Lưu file
  const outputPath = path.join(__dirname, `current_playlist.m3u`);

  try {
    fs.writeFileSync(outputPath, m3uContent, "utf8");
    console.log(`\n✅ Đã tạo file IPTV thành công: ${outputPath}`);
    console.log(
      `📊 Tổng cộng đã xử lý: ${processedMatches}/${totalMatches} trận đấu`,
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

// Hàm tạo file với tùy chọn nâng cao
async function generateAdvancedIPTVFile(options = {}) {
  const {
    includeAllServers = false,
    preferredServerType = "hls",
    outputFileName = null, // Sẽ auto generate với ngày
    delayBetweenRequests = 300,
    includeDateRange = true, // Có bao gồm ngày trong tên file không
  } = options;

  console.log("🔧 Cấu hình:");
  console.log(`  - Bao gồm tất cả servers: ${includeAllServers}`);
  console.log(`  - Ưu tiên server type: ${preferredServerType}`);
  console.log(`  - Delay giữa requests: ${delayBetweenRequests}ms`);

  const competitions = await getMatchList();

  if (competitions.length === 0) {
    console.log("Không có trận đấu nào được tìm thấy.");
    return;
  }

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  let totalMatches = 0;
  let processedMatches = 0;
  let successfulMatches = 0;

  competitions.forEach((competition) => {
    totalMatches += competition.matches.length;
  });

  console.log(`\n🚀 Bắt đầu xử lý ${totalMatches} trận đấu...`);

  for (const competition of competitions) {
    console.log(
      `\n📺 ${competition.name} (${competition.matches.length} trận)`,
    );

    for (const match of competition.matches) {
      const homeTeam = match.home_team.short_name || match.home_team.name;
      const awayTeam = match.away_team.short_name || match.away_team.name;
      const matchDateTime = formatDateTime(match.match_time);

      for (const room of match.rooms) {
        try {
          const matchInfo = await getMatchInfo(room._id);

          if (
            matchInfo &&
            matchInfo.room &&
            matchInfo.room.servers &&
            matchInfo.room.servers.length > 0
          ) {
            let servers = matchInfo.room.servers;

            // Lọc server theo type ưa thích
            const preferredServers = servers.filter(
              (s) => s.type === preferredServerType,
            );
            if (preferredServers.length > 0) {
              servers = preferredServers;
            }

            if (includeAllServers) {
              // Thêm tất cả servers
              for (const server of servers) {
                const channelName = `${homeTeam} vs ${awayTeam} - ${matchDateTime} [${server.name}]`;
                const groupTitle = competition.short_name || competition.name;

                m3uContent += `#EXTINF:-1 tvg-name="${channelName}" group-title="${groupTitle}",${channelName}\n`;
                m3uContent += `${server.stream_url}\n\n`;
              }
            } else {
              // Chỉ thêm server đầu tiên
              const server = servers[0];
              const channelName = `${homeTeam} vs ${awayTeam} - ${matchDateTime}`;
              const groupTitle = competition.short_name || competition.name;

              m3uContent += `#EXTINF:-1 tvg-name="${channelName}" group-title="${groupTitle}",${channelName}\n`;
              m3uContent += `${server.stream_url}\n\n`;
            }

            successfulMatches++;
            console.log(
              `  ✅ ${homeTeam} vs ${awayTeam} (${servers.length} servers)`,
            );
          } else {
            console.log(`  ❌ ${homeTeam} vs ${awayTeam} - Không có server`);
          }

          processedMatches++;
          await delay(delayBetweenRequests);
        } catch (error) {
          console.error(
            `  ❌ ${homeTeam} vs ${awayTeam} - Lỗi:`,
            error.message,
          );
          processedMatches++;
        }
      }
    }

    // Hiển thị tiến độ
    console.log(
      `📊 Tiến độ: ${processedMatches}/${totalMatches} (${Math.round((processedMatches / totalMatches) * 100)}%)`,
    );
  }

  // Tạo tên file
  const defaultFileName = "current_playlist.m3u";

  const finalFileName = outputFileName || defaultFileName;
  const outputPath = path.join(__dirname, finalFileName);

  // Lưu file
  fs.writeFileSync(outputPath, m3uContent, "utf8");

  const channelCount = m3uContent
    .split("\n")
    .filter((line) => line.startsWith("#EXTINF")).length;

  console.log(`\n🎉 Hoàn thành!`);
  console.log(`📁 File: ${outputPath}`);
  console.log(`📊 Đã xử lý: ${processedMatches}/${totalMatches} trận`);
  console.log(`✅ Thành công: ${successfulMatches} trận`);
  console.log(`❌ Thất bại: ${processedMatches - successfulMatches} trận`);
  console.log(`📺 Tổng số kênh: ${channelCount}`);
  console.log(`📅 Thời gian: ${getFormattedDate(0)} - ${getFormattedDate(1)}`);
}

// Chạy script
async function main() {
  console.log("🚀 Bắt đầu tạo file IPTV cho các trận bóng đá (2 ngày)...\n");

  // Chạy với cấu hình nâng cao
  // await generateAdvancedIPTVFile({
  //   includeAllServers: false,
  //   preferredServerType: "hls",
  //   delayBetweenRequests: 300,
  //   includeDateRange: true,
  // });
  //
  await generateIPTVFile();
}

// Chạy script và xử lý lỗi
main().catch((error) => {
  console.error("❌ Lỗi chung:", error);
  process.exit(1);
});
