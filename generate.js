const fs = require("fs");
const path = require("path");

// Hàm lấy giờ:phút từ timestamp (theo giờ Việt Nam)
function formatTime(timestamp) {
  const srcDate = new Date(timestamp * 1000);
  const vDate = new Date(
    srcDate.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  const hours = vDate.getHours().toString().padStart(2, "0");
  const minutes = vDate.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
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
  const hoursBack = 6;    // Lấy dữ liệu từ 6h trước
  const hoursAhead = 24;  // Đến 24h sau

  // Lấy thời gian hiện tại và chuyển sang giờ VN để tính toán ngày
  const nowUtc = new Date();
  const vnTimeOffset = 7 * 60; // UTC+7
  const vnNow = new Date(nowUtc.getTime() + vnTimeOffset * 60 * 1000);

  // Tính mốc thời gian bắt đầu và kết thúc (theo giờ VN giả lập)
  const startLimit = new Date(vnNow.getTime() - hoursBack * 60 * 60 * 1000);
  const endLimit = new Date(vnNow.getTime() + hoursAhead * 60 * 60 * 1000);

  // Xác định mốc 0h00 hôm nay (theo giờ VN)
  const vnMidnight = new Date(vnNow);
  vnMidnight.setUTCHours(0, 0, 0, 0);

  // Xác định mốc 0h00 ngày mai
  const vnMidnightNext = new Date(vnMidnight.getTime() + 24 * 60 * 60 * 1000);

  let startOffset = 0;
  let endOffset = 0;

  // Nếu startLimit nhỏ hơn 0h00 hôm nay -> cần lấy ngày hôm qua
  if (startLimit.getTime() < vnMidnight.getTime()) {
    startOffset = -1;
  }

  // Nếu endLimit lớn hơn hoặc bằng 0h00 ngày mai -> cần lấy ngày mai
  if (endLimit.getTime() >= vnMidnightNext.getTime()) {
    endOffset = 1;
  }

  const dateStrings = [];
  for (let i = startOffset; i <= endOffset; i++) {
    dateStrings.push(getFormattedDate(i));
  }

  const sports = ["volleyball", "tennis", "football"];
  console.log(
    `Đang lấy dữ liệu từ -${hoursBack}h đến +${hoursAhead}h. Các ngày cần fetch: ${dateStrings.join(", ")}`,
  );

  try {
    // Gọi song song tất cả request cùng lúc để tối ưu tốc độ
    const promises = [];
    for (const sport of sports) {
      for (const date of dateStrings) {
        promises.push(getMatchListForDate(date, sport));
      }
    }
    const results = await Promise.all(promises);
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
  const hoursLookingAhead = 24;

  // Đưa sportIcons ra ngoài vòng lặp để tránh tạo lại object
  const sportIcons = {
    football: "⚽",
    volleyball: "🏐",
    tennis: "🎾",
  };

  // Duyệt qua từng trận đã sort
  for (const item of allMatches) {
    const { competition, match } = item;
    // Lấy sport từ competition (đã gắn khi gọi API)
    const sport = competition.sport || "football";

    // Logic lọc trận đấu (kiểm tra sớm để tránh xử lý không cần thiết):
    // 1. Quá khứ (< now): Chỉ giữ nếu đang LIVE
    // 2. Tương lai (>= now): Giữ nếu trong khoảng 12h tới

    // Nếu là quá khứ (match_time < now)
    if (match.match_time < now) {
      if (match.status_text !== "live") {
        continue; // Bỏ qua trận đã qua và không live
      }
      // Nếu live thì giữ lại, không cần check gì thêm
    } else {
      // Nếu là tương lai - Bỏ qua trận xa hơn 12 giờ tới
      if (match.match_time > now + hoursLookingAhead * 3600) {
        continue;
      }
    }

    // Kiểm tra có room không (filter sớm)
    if (!match.rooms || match.rooms.length === 0) {
      continue;
    }

    const homeTeam =
      match.home_team && (match.home_team.short_name || match.home_team.name);
    const awayTeam =
      match.away_team && (match.away_team.short_name || match.away_team.name);
    const matchTime = formatTime(match.match_time);
    const sportIcon = sportIcons[sport] || "";

    let channelName = `${homeTeam} vs ${awayTeam} | ${matchTime} ${sportIcon}`;
    if (match.status_text === "live") {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = competition.short_name || competition.name;
    const room = match.rooms[0];
    const commentator_id =
      (room.commentator_ids && room.commentator_ids[0]) || "";
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
      m3uContent += `PROXY://${stream_url}\n\n`;
    }
  }

  return m3uContent;
}

module.exports = { generateIPTVFile };
