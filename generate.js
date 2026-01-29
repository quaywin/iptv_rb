const fs = require("fs");
const path = require("path");
const config = require("./config");

// Helper to format time (VN timezone)
function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to get date string (dd-mm-yyyy) with offset
function getFormattedDate(daysOffset = 0) {
  const date = new Date();
  date.setHours(date.getHours() + 7); // VN Offset
  date.setDate(date.getDate() + daysOffset);

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}-${month}-${year}`;
}

// Fetch matches for a specific date and sport
async function getMatchListForDate(dateString, sport) {
  try {
    const url = `${config.apiBaseUrl}/match/list?sport_type=${sport}&date=${dateString}&type=schedule`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent,
        "Referer": config.referer,
        "Origin": config.origin,
      },
    });

    console.log(`Fetched: ${sport} - ${dateString}`);
    const data = await response.json();

    if (!data.status) throw new Error(`API Error: ${data.msg}`);

    return (data.result || []).map(comp => ({ ...comp, sport }));
  } catch (error) {
    console.error(`Error fetching ${sport} for ${dateString}:`, error.message);
    return [];
  }
}

// Fetch matches across multiple days and sports
async function getMatchList() {
  const { hoursBack, hoursAhead } = config;

  const vnNow = new Date();
  vnNow.setHours(vnNow.getHours() + 7);

  const startLimit = new Date(vnNow.getTime() - hoursBack * 3600000);
  const endLimit = new Date(vnNow.getTime() + hoursAhead * 3600000);

  const vnMidnight = new Date(vnNow);
  vnMidnight.setUTCHours(0, 0, 0, 0);
  const vnMidnightNext = new Date(vnMidnight.getTime() + 86400000);

  const startOffset = startLimit < vnMidnight ? -1 : 0;
  const endOffset = endLimit >= vnMidnightNext ? 1 : 0;

  const dateStrings = Array.from(
    { length: endOffset - startOffset + 1 },
    (_, i) => getFormattedDate(startOffset + i)
  );

  const sports = ["volleyball", "tennis", "football"];
  console.log(`Fetching from -${hoursBack}h to +${hoursAhead}h. Days: ${dateStrings.join(", ")}`);

  try {
    const results = [];
    for (const sport of sports) {
      for (const date of dateStrings) {
        results.push(await getMatchListForDate(date, sport));
        await delay(200);
      }
    }

    const allMatches = results.flat();
    const competitionMap = new Map();

    for (const comp of allMatches) {
      if (!comp?._id) continue;
      const key = `${comp._id}|${comp.sport}`;
      if (competitionMap.has(key)) {
        competitionMap.get(key).matches.push(...comp.matches);
      } else {
        competitionMap.set(key, { ...comp });
      }
    }

    const allCompetitions = Array.from(competitionMap.values()).map(comp => {
      comp.matches.sort((a, b) => a.match_time - b.match_time);
      return comp;
    });

    const totalMatches = allCompetitions.reduce((sum, c) => sum + (c.matches?.length || 0), 0);
    console.log(`Total: ${allCompetitions.length} leagues, ${totalMatches} matches`);

    return allCompetitions;
  } catch (error) {
    console.error("Error fetching match lists:", error);
    return [];
  }
}

// Generate IPTV M3U content
async function generateIPTVFile() {
  console.log("Starting playlist generation...");
  const competitions = await getMatchList();

  if (!competitions.length) {
    console.log("No matches found.");
    return "";
  }

  let m3uContent = "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  const matchMap = new Map();
  for (const comp of competitions) {
    if (!comp.matches) continue;
    for (const match of comp.matches) {
      if (!matchMap.has(match._id)) {
        matchMap.set(match._id, { competition: comp, match });
      }
    }
  }

  const allMatchesSorted = Array.from(matchMap.values())
    .sort((a, b) => a.match.match_time - b.match.match_time);

  console.log(`Processing ${allMatchesSorted.length} sorted matches.`);

  const now = Math.floor(Date.now() / 1000);
  const { hoursLookingAhead } = config;
  const sportIcons = { football: "⚽", volleyball: "🏐", tennis: "🎾" };

  for (const { competition, match } of allMatchesSorted) {
    const sport = competition.sport || "football";

    if (match.match_time < now) {
      if (match.status_text !== "live") continue;
    } else if (match.match_time > now + hoursLookingAhead * 3600) {
      continue;
    }

    if (!match.rooms?.length) continue;

    const homeTeam = match.home_team?.short_name || match.home_team?.name || "Home";
    const awayTeam = match.away_team?.short_name || match.away_team?.name || "Away";
    const matchTime = formatTime(match.match_time);
    const sportIcon = sportIcons[sport] || "";

    let channelName = `${homeTeam} vs ${awayTeam} | ${matchTime} ${sportIcon}`;
    const isStartingSoon = match.match_time > now && match.match_time <= now + 1800;

    if (match.status_text === "live" || isStartingSoon) {
      channelName = `🔴 ${channelName}`;
    }

    const groupTitle = competition.short_name || competition.name;
    const room = match.rooms[0];
    const commId = room.commentator_ids?.[0] || "";

    const streamUrl = commId
      ? `${config.primaryStreamBase}/live/${commId}_${match._id}_${sport}_fhd.flv`
      : `${config.backupStreamBase}/auto_hls/${match._id}_${sport}_fhd/index.m3u8`;

    m3uContent += `#EXTINF:-1 tvg-name="${channelName}" tvg-logo="${competition.logo}" group-title="${groupTitle}",${channelName}\n`;
    m3uContent += `${streamUrl}\n\n`;
  }

  return m3uContent;
}

module.exports = { generateIPTVFile };
