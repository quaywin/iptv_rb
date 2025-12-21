const fs = require("fs");
const path = require("path");

// Hàm delay để tránh spam API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm chuyển đổi timestamp sang định dạng ngày giờ
function formatDateTime(timestamp) {
  // Date gốc từ timestamp (giây -> ms)
  const srcDate = new Date(timestamp * 1000);

  // Tạo đối tượng Date thể hiện cùng thời điểm nhưng "theo giờ Việt Nam"
  // (dùng trick toLocaleString với timeZone để chuyển timezone)
  const vDate = new Date(
    srcDate.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );

  // Lấy "now" theo giờ VN để xác định TODAY / TMR
  const vNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );

  // Kiểm tra today / tomorrow
  const isToday =
    vNow.getFullYear() === vDate.getFullYear() &&
    vNow.getMonth() === vDate.getMonth() &&
    vNow.getDate() === vDate.getDate();

  const tmr = new Date(vNow);
  tmr.setDate(tmr.getDate() + 1);
  const isTomorrow =
    tmr.getFullYear() === vDate.getFullYear() &&
    tmr.getMonth() === vDate.getMonth() &&
    tmr.getDate() === vDate.getDate();

  let dayOfWeek;
  if (isToday) {
    dayOfWeek = "TODAY";
  } else if (isTomorrow) {
    dayOfWeek = "TMR";
  } else {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    dayOfWeek = days[vDate.getDay()];
  }

  const day = vDate.getDate().toString().padStart(2, "0");
  const month = (vDate.getMonth() + 1).toString().padStart(2, "0");
  const hours = vDate.getHours().toString().padStart(2, "0");
  const minutes = vDate.getMinutes().toString().padStart(2, "0");

  return `${dayOfWeek} ${day}/${month} ${hours}:${minutes}`;
}

// Hàm lấy ngày theo định dạng dd/mm/yyyy (theo giờ Việt Nam)
function getFormattedDate(daysOffset = 0) {
  // Lấy thời gian hiện tại và chuyển sang giờ VN
  const nowUtc = new Date();
  const vnTimeOffset = 7 * 60; // UTC+7 = 420 phút
  const vnNow = new Date(nowUtc.getTime() + vnTimeOffset * 60 * 1000);

  // Thêm offset ngày
  const targetDate = new Date(
    vnNow.getTime() + daysOffset * 24 * 60 * 60 * 1000,
  );

  const day = targetDate.getUTCDate().toString().padStart(2, "0");
  const month = (targetDate.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = targetDate.getUTCFullYear();

  return `${day}-${month}-${year}`;
}

// Hàm gọi API để lấy danh sách trận đấu cho một ngày và một sport
async function getMatchListForDate(dateString, sport) {
  try {
    const response = await fetch(
      `https://api.robong.me/v1/match/list?sport_type=${sport}&date=${dateString}&type=schedule`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://robong.me/",
          Origin: "https://robong.me",
        },
      },
    );
    console.log(
      `Fetched: ${sport} - ${dateString}`,
    );
    const data = await response.json();

    if (!data.status) {
      throw new Error(`API Error: ${data.msg}`);
    }

    // Gắn thêm field sport vào mỗi competition để biết môn khi xử lý
    const result = data.result || [];
    return result.map((comp) => ({ ...comp, sport }));
  } catch (error) {
    console.error(
      `Error fetching match list for date ${dateString} (sport=${sport}):`,
      error,
    );
    return [];
  }
}

// Hàm gọi API để lấy danh sách trận đấu cho nhiều sport và nhiều ngày
async function getMatchList() {
  const daysToFetch = 4;
  const dateStrings = [];
  for (let i = -1; i < daysToFetch - 1; i++) {
    dateStrings.push(getFormattedDate(i));
  }

  const sports = ["volleyball", "tennis", "football"]; // Thêm volleyball và tennis
  console.log(
    `Đang lấy dữ liệu cho các ngày: ${dateStrings.join(", ")} và các sport: ${sports.join(", ")}`,
  );

  try {
    // Gọi tuần tự có delay để tránh bị chặn IP/Rate limit
    const results = [];
    for (const sport of sports) {
      for (const date of dateStrings) {
        const result = await getMatchListForDate(date, sport);
        results.push(result);
        // Delay nhẹ 300ms giữa các request
        await delay(300);
      }
    }
    // results là mảng các mảng competition, flatten
    const allMatches = [].concat(...results);

    // Gộp kết quả từ các ngày và các sport
    const allCompetitions = [];
    const competitionMap = new Map();

    allMatches.forEach((competition) => {
      if (!competition || !competition._id) return;
      // key kết hợp id + sport để tránh trùng id giữa các sport khác nhau
      const compKey = `${competition._id}|${competition.sport}`;
      if (competitionMap.has(compKey)) {
        competitionMap.get(compKey).matches.push(...competition.matches);
      } else {
        competitionMap.set(compKey, { ...competition });
      }
    });

    // Chuyển Map thành Array và sort matches trong mỗi competition
    competitionMap.forEach((competition) => {
      competition.matches.sort((a, b) => a.match_time - b.match_time);
      allCompetitions.push(competition);
    });

    const totalMatches = allCompetitions.reduce(
      (sum, comp) => sum + (comp.matches ? comp.matches.length : 0),
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
    if (!competition.matches) return;
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

  // Lấy thời gian hiện tại theo Unix timestamp
  const now = Math.floor(Date.now() / 1000);

  // Duyệt qua từng trận đã sort
  for (const item of allMatches) {
    const { competition, match } = item;
    const homeTeam =
      match.home_team && (match.home_team.short_name || match.home_team.name);
    const awayTeam =
      match.away_team && (match.away_team.short_name || match.away_team.name);
    const matchDateTime = formatDateTime(match.match_time);

    let channelName = `${homeTeam} vs ${awayTeam} - ${matchDateTime}`;
    if (match.status_text === "live") {
      channelName = `🔴 | ${channelName}`;
    }

    // Bỏ qua trận đã qua và không còn live
    if (match.match_time < now && match.status_text !== "live") {
      console.log(`  ⚠️ Bỏ qua trận ${channelName} vì đã qua và không live`);
      continue;
    }

    const groupTitle = competition.short_name || competition.name;
    if (!match.rooms || (match.rooms && match.rooms.length == 0)) {
      console.log(
        `  ⚠️ Bỏ qua trận ${channelName} vì không có room (commentator)`,
      );
      continue;
    }
    const room = match.rooms[0];
    const commentator_id =
      (room.commentator_ids && room.commentator_ids[0]) || "";
    // Lấy sport từ competition (đã gắn khi gọi API)
    const sport = competition.sport || "football";
    // Sử dụng sport trong đường dẫn stream
    if (!commentator_id) {
      const bk_stream_url = `https://2988376792.global.cdnfastest.com/auto_hls/${match._id}_${sport}_fhd/index.m3u8`;
      m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${competition.logo}" group-title="${groupTitle}",${channelName}\n`;
      m3uContent += `${bk_stream_url}\n\n`;
    } else {
      // https://rblive.starxcdn.xyz/live/689c7d152eeb894ab75a5340_zp5rzghgz1k5q82_football_fhd.flv
      // const stream_url = `https://cr7.rbncdn.net/live/${commentator_id}_${match._id}_${sport}_fhd/playlist.m3u8`;
      const stream_url = `https://rblive.starxcdn.xyz/live/${commentator_id}_${match._id}_${sport}_fhd.flv`;
      m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${competition.logo}" group-title="${groupTitle}",${channelName}\n`;
      m3uContent += `${stream_url}\n\n`;
    }

    console.log(`  ✓ Đã thêm: ${channelName} (${sport})`);
    processedMatches++;
  }

  return m3uContent;
}

module.exports = { generateIPTVFile };
