/**
 * EPG and Logo helpers for SportsBite (/channel2) 24/7 channels
 */

const { TIM_EPG_MAP, cleanLogoUrl } = require("./epg-tim");

// Common manual EPG ID overrides for major sports networks across countries
const SPORTSBITE_EPG_OVERRIDES = {
  // Greece
  "cosmote-sport-1-gr": "CosmoteSport1.gr",
  "cosmote-sport-2-gr": "CosmoteSport2.gr",
  "cosmote-sport-3-gr": "CosmoteSport3.gr",
  "cosmote-sport-4-gr": "CosmoteSport4.gr",
  "cosmote-sport-5-gr": "CosmoteSport5.gr",
  "cosmote-sport-6-gr": "CosmoteSport6.gr",
  "cosmote-sport-7-gr": "CosmoteSport7.gr",
  "cosmote-sport-8-gr": "CosmoteSport8.gr",
  "cosmote-sport-9-gr": "CosmoteSport9.gr",
  "nova-sports-1-gr": "NovaSports1.gr",
  "nova-sports-2-gr": "NovaSports2.gr",
  "nova-sports-3-gr": "NovaSports3.gr",
  "nova-sports-4-gr": "NovaSports4.gr",
  "nova-sports-5-gr": "NovaSports5.gr",
  "nova-sports-6-gr": "NovaSports6.gr",
  "nova-sports-prime-gr": "NovaSportsPrime.gr",
  "nova-sports-news-gr": "NovaSportsNews.gr",
  "nova-sports-start-gr": "NovaSportsStart.gr",

  // France
  "rmc-sport-1-fr": "RMCSport1.fr",
  "rmc-sport-2-fr": "RMCSport2.fr",
  "canal-plus-sport-fr": "CanalPlusSport.fr",
  "canal-plus-foot-fr": "CanalPlusFoot.fr",

  // Turkey
  "ssport-tr": "SSport.tr",
  "ssport-2-tr": "SSport2.tr",
  "tivibu-spor-1-tr": "TivibuSpor1.tr",
  "tivibu-spor-2-tr": "TivibuSpor2.tr",
  "tivibu-spor-3-tr": "TivibuSpor3.tr",
  "tivibu-spor-4-tr": "TivibuSpor4.tr",

  // Netherlands
  "ziggo-sport-nl": "ZiggoSport.nl",
  "ziggo-sport-select-nl": "ZiggoSportSelect.nl",
  "ziggo-sport-voetbal-nl": "ZiggoSportVoetbal.nl",
  "ziggo-sport-racing-nl": "ZiggoSportRacing.nl",
  "ziggo-sport-golf-nl": "ZiggoSportGolf.nl",
  "ziggo-sport-docu-nl": "ZiggoSportDocu.nl",
  "espn-1-nl": "ESPN1.nl",
  "espn-2-nl": "ESPN2.nl",
  "espn-3-nl": "ESPN3.nl",
  "espn-4-nl": "ESPN4.nl",

  // Australia
  "optus-sport-1-au": "OptusSport1.au",
  "optus-sport-2-au": "OptusSport2.au",
  "stan-sport-au": "StanSport.au",

  // South Africa / Africa
  "supersport-grandstand-za": "SuperSportGrandstand.za",
  "supersport-premier-league-za": "SuperSportPremierLeague.za",
  "supersport-football-za": "SuperSportFootball.za",
  "supersport-psl-za": "SuperSportPSL.za",
  "supersport-la-liga-za": "SuperSportLaLiga.za",
  "supersport-variety-1-za": "SuperSportVariety1.za",
  "supersport-variety-2-za": "SuperSportVariety2.za",
  "supersport-variety-3-za": "SuperSportVariety3.za",
  "supersport-variety-4-za": "SuperSportVariety4.za",
  "supersport-action-za": "SuperSportAction.za",
  "supersport-rugby-za": "SuperSportRugby.za",
  "supersport-cricket-za": "SuperSportCricket.za",
  "supersport-golf-za": "SuperSportGolf.za",
  "supersport-tennis-za": "SuperSportTennis.za",
  "supersport-motorsport-za": "SuperSportMotorsport.za",

  // Major US Sports
  "bein-sports-usa": "beINSPORTS.us",
  "bein-sports-es": "beINSPORTS.us",
  "usa-network": "USANetwork.us",
  "acc-network": "ACCNetwork.us",
  "big-ten-network": "BigTenNetwork.us",
  "cbs-sports-network": "CBSSportsNetwork.us",
  "dazn-1-usa": "DAZN1.us",
  "espn": "ESPN.us",
  "espn-2": "ESPN2.us",
  "espn2": "ESPN2.us",
  "espn-news": "ESPNews.us",
  "espnu": "ESPNU.us",
  "espn-deportes": "ESPNDeportes.us",
  "fox-sports-1": "FoxSports1.us",
  "fox-sports-2": "FoxSports2.us",
  "fox-deportes": "FoxDeportes.us",
  "golf-channel": "GolfChannel.us",
  "mlb-network": "MLBNetwork.us",
  "nba-tv": "NBATV.us",
  "nfl-network": "NFLNetwork.us",
  "nhl-network": "NHLNetwork.us",
  "sec-network": "SECNetwork.us",
  "tennis-channel": "TennisChannel.us",
  "tudn": "TUDN.us",
  "willow-cricket": "WillowCricket.us",

  // UK Sports
  "sky-sports-main-event": "SkySportsMainEvent.uk",
  "sky-sports-premier-league": "SkySportsPremierLeague.uk",
  "sky-sports-football": "SkySportsFootball.uk",
  "sky-sports-cricket": "SkySportsCricket.uk",
  "sky-sports-f1": "SkySportsF1.uk",
  "sky-sports-golf": "SkySportsGolf.uk",
  "sky-sports-action": "SkySportsAction.uk",
  "sky-sports-news": "SkySportsNews.uk",
  "sky-sports-tennis": "SkySportsTennis.uk",
  "sky-sports-racing": "SkySportsRacing.uk",
  "sky-sports-mix": "SkySportsMix.uk",
  "tnt-sports-1": "TNTSports1.uk",
  "tnt-sports-2": "TNTSports2.uk",
  "tnt-sports-3": "TNTSports3.uk",
  "tnt-sports-4": "TNTSports4.uk",

  // France Sports
  "bein-sports-1-france": "beINSPORTS1.fr",
  "bein-sports-2-france": "beINSPORTS2.fr",
  "bein-sports-3-france": "beINSPORTS3.fr",
  "bein-max-4-france": "beINSPORTSMAX4.fr",
  "bein-max-5-france": "beINSPORTSMAX5.fr",
  "bein-max-6-france": "beINSPORTSMAX6.fr",
  "bein-max-7-france": "beINSPORTSMAX7.fr",

  // Portugal
  "sport-tv-1": "SportTV1.pt",
  "sport-tv-2": "SportTV2.pt",
  "sport-tv-3": "SportTV3.pt",
  "sport-tv-4": "SportTV4.pt",
  "sport-tv-5": "SportTV5.pt",
  "sport-tv-6": "SportTV6.pt",

  // Poland
  "canal-plus-sport-pl": "CanalPlusSport.pl",
  "canal-plus-sport-2-pl": "CanalPlusSport2.pl",
  "canal-plus-sport-3-pl": "CanalPlusSport3.pl",
  "canal-plus-sport-4-pl": "CanalPlusSport4.pl",
  "canal-plus-sport-5-pl": "CanalPlusSport5.pl",
  "eleven-sports-1": "ElevenSports1.pl",
  "eleven-sports-2": "ElevenSports2.pl",
  "eleven-sports-3": "ElevenSports3.pl",
  "eleven-sports-4": "ElevenSports4.pl",
  "polsat-sport-1": "PolsatSport1.pl",
  "polsat-sport-2": "PolsatSport2.pl",
  "polsat-sport-3": "PolsatSport3.pl",
  "polsat-sport-fight": "PolsatSportFight.pl",
};

// Fallback logos for channels with missing logos
const SPORTSBITE_FALLBACK_LOGOS = {
  "cv-abu-dhabi-sports-1-premium-uae": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/abu-dhabi-sports-1-ae.png",
  "cv-abu-dhabi-sports-2-premium-uae": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/abu-dhabi-sports-2-ae.png",
  "cv-arena-sport-1-serbia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/serbia/arena-sport-1-rs.png",
  "cv-arena-sport-2-serbia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/serbia/arena-sport-2-rs.png",
  "cv-arena-sport-3-serbia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/serbia/arena-sport-3-rs.png",
  "cv-arena-sport-4-serbia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/serbia/arena-sport-4-rs.png",
  "cv-arena-sport-5-serbia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/serbia/arena-sport-5-rs.png",
  "cv-arena-sport-1-croatia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/croatia/arena-sport-1-hr.png",
  "cv-arena-sport-2-croatia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/croatia/arena-sport-2-hr.png",
  "cv-arena-sport-3-croatia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/croatia/arena-sport-3-hr.png",
  "cv-arena-sport-4-croatia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/croatia/arena-sport-4-hr.png",
  "cv-arena-sport-5-croatia": "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/croatia/arena-sport-5-hr.png",
};

/**
 * Get standard EPG tvg-id for a SportsBite channel
 * If not verified in dictionary, returns null to allow IPTV app to match by tvg-name.
 */
function getSportsbiteChannelEpgId(ch) {
  if (!ch) return null;

  const rawId = (ch.id || "").toLowerCase().replace(/^247-/, "").replace(/^cv-/, "");
  if (SPORTSBITE_EPG_OVERRIDES[rawId]) {
    return SPORTSBITE_EPG_OVERRIDES[rawId];
  }

  // Check from tv-logo filename if applicable
  const logo = ch.logo_url || ch.image || "";
  const match = logo.match(/tv-logos\/(?:refs\/heads\/main|main)\/countries\/[^/]+\/([^/]+)\.png/);
  if (match) {
    const filename = match[1];
    if (SPORTSBITE_EPG_OVERRIDES[filename]) {
      return SPORTSBITE_EPG_OVERRIDES[filename];
    }
  }

  // Match against standard TimStreams EPG map
  if (TIM_EPG_MAP[rawId]) {
    return TIM_EPG_MAP[rawId];
  }

  // Match by normalized channel name
  const nameKey = (ch.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (SPORTSBITE_EPG_OVERRIDES[nameKey]) {
    return SPORTSBITE_EPG_OVERRIDES[nameKey];
  }
  if (TIM_EPG_MAP[nameKey]) {
    return TIM_EPG_MAP[nameKey];
  }

  return null;
}

/**
 * Get cleaned and fallback logo for SportsBite channel
 */
function getSportsbiteChannelLogo(ch) {
  if (!ch) return "";

  const id = (ch.id || "").toLowerCase();
  if (SPORTSBITE_FALLBACK_LOGOS[id]) {
    return SPORTSBITE_FALLBACK_LOGOS[id];
  }

  const logo = ch.logo_url || ch.image || "";
  return cleanLogoUrl(logo);
}

module.exports = {
  getSportsbiteChannelEpgId,
  getSportsbiteChannelLogo,
};
