/**
 * EPG (XMLTV) ID mapping for TimStreams 24/7 channels
 * Standardized primarily against iptv-org EPG repository identifiers (channel.country_code)
 */

const TIM_EPG_MAP = {
  // United States - Networks & Entertainment
  "abc": "ABC.us",
  "acc-network": "ACCNetwork.us",
  "ae-network": "AENetwork.us",
  "amc": "AMC.us",
  "american-heroes-channel": "AmericanHeroesChannel.us",
  "animal-planet": "AnimalPlanet.us",
  "axs-tv": "AXSTV.us",
  "bbc-america": "BBCAmerica.us",
  "big-ten-network": "BigTenNetwork.us",
  "boomerang": "Boomerang.us",
  "bravo": "Bravo.us",
  "cartoon-network": "CartoonNetwork.us",
  "cbs": "CBS.us",
  "cbs-sports-network": "CBSSportsNetwork.us",
  "cnbc": "CNBC.us",
  "cnn": "CNN.us",
  "comedy-central": "ComedyCentral.us",
  "cw": "TheCW.us",
  "discovery-channel": "DiscoveryChannel.us",
  "discovery-family": "DiscoveryFamily.us",
  "discovery-turbo": "DiscoveryTurbo.us",
  "disney-channel": "DisneyChannel.us",
  "disney-junior": "DisneyJunior.us",
  "disney-xd": "DisneyXD.us",
  "food-network": "FoodNetwork.us",
  "fox": "FOX.us",
  "fox-news": "FoxNewsChannel.us",
  "freeform": "Freeform.us",
  "fx": "FX.us",
  "fxm": "FXM.us",
  "fxx": "FXX.us",
  "hbo": "HBO.us",
  "hbo-comedy": "HBOComedy.us",
  "hbo-drama": "HBODrama.us",
  "hbo-latino": "HBOLatino.us",
  "hbo-movies": "HBOMovies.us",
  "hgtv": "HGTV.us",
  "mtv": "MTV.us",
  "nickelodeon": "Nickelodeon.us",
  "nick-jr": "NickJr.us",
  "nicktoons": "Nicktoons.us",
  "showtime": "Showtime.us",
  "showtime-2": "Showtime2.us",
  "showtime-extreme": "ShowtimeExtreme.us",
  "showtime-family-zone": "ShowtimeFamilyZone.us",
  "showtime-next": "ShowtimeNext.us",
  "showtime-women": "ShowtimeWomen.us",
  "starz": "Starz.us",
  "starz-cinema": "StarzCinema.us",
  "starz-comedy": "StarzComedy.us",
  "starz-kids-and-family": "StarzKidsFamily.us",
  "syfy": "Syfy.us",
  "tbs": "TBS.us",
  "teenick": "TeenNick.us",
  "telemundo": "Telemundo.us",
  "the-weather-channel": "TheWeatherChannel.us",
  "tnt": "TNT.us",
  "trutv": "truTV.us",
  "unimas": "UniMas.us",
  "univision": "Univision.us",
  "usa-network": "USANetwork.us",
  "wapa-america": "WAPAAmerica.us",
  "wapa-deportes": "WAPADeportes.us",

  // United States - Sports
  "bein-sports": "beINSPORTS.us",
  "dazn-1-usa": "DAZN1.us",
  "espn": "ESPN.us",
  "espn2": "ESPN2.us",
  "espnews": "ESPNews.us",
  "espnu": "ESPNU.us",
  "espn-deportes": "ESPNDeportes.us",
  "fox-sports-1": "FoxSports1.us",
  "fox-sports-2": "FoxSports2.us",
  "fox-deportes": "FoxDeportes.us",
  "golf-channel": "GolfChannel.us",
  "mlb-network": "MLBNetwork.us",
  "nba-tv": "NBATV.us",
  "nbc": "NBC.us",
  "nbc-sports-bay-area": "NBCSportsBayArea.us",
  "nbc-sports-philadelphia": "NBCSportsPhiladelphia.us",
  "nfl-network": "NFLNetwork.us",
  "nhl-network": "NHLNetwork.us",
  "sec-network": "SECNetwork.us",
  "tennis-channel": "TennisChannel.us",
  "tudn": "TUDN.us",
  "willow-cricket": "WillowCricket.us",
  "willow-cricket-2": "WillowCricketExtra.us",
  "dirtvision-now-24-7": "DirtvisionNow.us",
  "motogp-channel": "MotoGPChannel.us",
  "racer-network": "RacerNetwork.us",
  "ufc-fight-pass-24-7": "UFC24_7.us",

  // United Kingdom
  "bbc-one-london": "BBCOneLondon.uk",
  "bbc-two": "BBCTwoEngland.uk",
  "bbc-news": "BBCNews.uk",
  "cbeebies": "CBeebies.uk",
  "sky-arts": "SkyArts.uk",
  "sky-atlantic": "SkyAtlantic.uk",
  "sky-comedy": "SkyComedy.uk",
  "sky-crime": "SkyCrime.uk",
  "sky-documentaries": "SkyDocumentaries.uk",
  "sky-kids": "SkyKids.uk",
  "sky-nature": "SkyNature.uk",
  "sky-news": "SkyNews.uk",
  "sky-one": "SkyOne.uk",
  "sky-sci-fi": "SkySciFi.uk",
  "sky-witness": "SkyWitness.uk",
  "sky-sports-action": "SkySportsAction.uk",
  "sky-sports-cricket": "SkySportsCricket.uk",
  "sky-sports-f1": "SkySportsF1.uk",
  "sky-sports-football": "SkySportsFootball.uk",
  "sky-sports-golf": "SkySportsGolf.uk",
  "sky-sports-main-event": "SkySportsMainEvent.uk",
  "sky-sports-mix": "SkySportsMix.uk",
  "sky-sports-news": "SkySportsNews.uk",
  "sky-sports-premier-league": "SkySportsPremierLeague.uk",
  "sky-sports-racing": "SkySportsRacing.uk",
  "sky-sports-tennis": "SkySportsTennis.uk",
  "sky-sports-plus": "SkySportsPlus.uk",
  "tnt-sports-1": "TNTSports1.uk",
  "tnt-sports-2": "TNTSports2.uk",
  "tnt-sports-3": "TNTSports3.uk",
  "tnt-sports-4": "TNTSports4.uk",

  // France
  "bein-sports-francais-1": "beINSPORTS1.fr",
  "bein-sports-francais-2": "beINSPORTS2.fr",
  "bein-sports-francais-3": "beINSPORTS3.fr",
  "bein-max-4-francais": "beINSPORTSMAX4.fr",
  "bein-max-5-francais": "beINSPORTSMAX5.fr",
  "bein-max-6": "beINSPORTSMAX6.fr",
  "bein-max-7-francais": "beINSPORTSMAX7.fr",

  // Germany
  "dazn-1-germany": "DAZN1.de",
  "dazn-2-germany": "DAZN2.de",
  "sky-sport-bundesliga": "SkySportBundesliga1.de",
  "sportdigital-fussball": "SportdigitalFussball.de",

  // Spain
  "dazn-1-spain": "DAZN1.es",
  "dazn-2-spain": "DAZN2.es",
  "dazn-f1": "DAZNF1.es",
  "dazn-laliga": "DAZNLaLiga.es",
  "movistar-deportes": "MovistarDeportes.es",
  "movistar-deportes-2": "MovistarDeportes2.es",
  "movistar-deportes-3": "MovistarDeportes3.es",
  "movistar-laliga": "MovistarLaLiga.es",
  "movistar-plus": "MovistarPlus.es",

  // Italy
  "dazn-1-italia": "DAZN1.it",
  "sky-uno": "SkyUno.it",
  "sky-sport-24": "SkySport24.it",
  "sky-sport-uno": "SkySportUno.it",
  "sky-sport-calcio-it": "SkySportCalcio.it",
  "sky-sport-arena-it": "SkySportArena.it",
  "sky-sport-f1-italia": "SkySportF1.it",
  "sky-sport-max-it": "SkySportMax.it",
  "sky-sport-motogp-it": "SkySportMotoGP.it",
  "sky-sport-tennis-it": "SkySportTennis.it",

  // Portugal
  "dazn-1-portugal": "DAZN1.pt",
  "sport-tv1": "SportTV1.pt",
  "sport-tv2": "SportTV2.pt",
  "sport-tv3": "SportTV3.pt",
  "sport-tv4": "SportTV4.pt",
  "sport-tv5": "SportTV5.pt",

  // Poland
  "canal-extra-1": "CanalPlusExtra1.pl",
  "canal-extra-2": "CanalPlusExtra2.pl",
  "canal-sport-pl": "CanalPlusSport.pl",
  "canal-sport-2-pl": "CanalPlusSport2.pl",
  "canal-sport-3-pl": "CanalPlusSport3.pl",
  "canal-sport-4-pl": "CanalPlusSport4.pl",
  "canal-sport-5-pl": "CanalPlusSport5.pl",
  "canal-sport-6-pl": "CanalPlusSport6.pl",
  "eleven-sports-1": "ElevenSports1.pl",
  "eleven-sports-2": "ElevenSports2.pl",
  "eleven-sports-3": "ElevenSports3.pl",
  "eleven-sports-4": "ElevenSports4.pl",
  "polsat": "Polsat.pl",
  "polsat-sport-1": "PolsatSport1.pl",
  "polsat-sport-2": "PolsatSport2.pl",
  "polsat-sport-3": "PolsatSport3.pl",
  "polsat-sport-fight": "PolsatSportFight.pl",

  // Canada
  "tsn1": "TSN1.ca",

  // Australia
  "fox-sports-501-cricket": "FoxCricket.au",
  "fox-sports-502-league": "FoxLeague.au",
  "fox-sports-503": "FoxSports503.au",
  "fox-sports-504-footy": "FoxFooty.au",
  "fox-sports-505": "FoxSports505.au",
  "fox-sports-506": "FoxSports506.au",
  "fox-sports-507": "FoxSportsMore.au",

  // New Zealand
  "sky-sport-1-nz": "SkySport1.nz",
  "sky-sport-2-nz": "SkySport2.nz",
  "sky-sport-3-nz": "SkySport3.nz",
  "sky-sport-4-nz": "SkySport4.nz",
  "sky-sport-5-nz": "SkySport5.nz",
  "sky-sport-6-nz": "SkySport6.nz",
  "sky-sport-7-nz": "SkySport7.nz",
  "sky-sport-8-nz": "SkySport8.nz",
  "sky-sport-9-nz": "SkySport9.nz",
  "sky-sport-select-nz": "SkySportSelect.nz",

  // Ireland
  "premier-sports-1-ie": "PremierSports1.ie",
  "premier-sports-2-ie": "PremierSports2.ie",

  // Singapore
  "hub-sports-1-singapore": "HubSports1.sg",
  "hub-sports-2-singapore": "HubSports2.sg",
  "hub-sports-3-singapore": "HubSports3.sg",
  "hub-sports-4-singapore": "HubSports4.sg",
  "hub-sports-5-singapore": "HubSports5.sg",

  // India
  "sony-sports-network": "SonySportsTen1.in",
  "sony-sports-network-2": "SonySportsTen2.in",
  "sony-sports-network-3": "SonySportsTen3.in",
  "sony-sports-network-4": "SonySportsTen4.in",
  "sony-sports-network-5": "SonySportsTen5.in",

  // MENA (Qatar)
  "bein-sports-mena-1": "beINSPORTS1.qa",
  "bein-sports-mena-2": "beINSPORTS2.qa",
  "bein-sports-mena-3": "beINSPORTS3.qa",
  "bein-sports-mena-4": "beINSPORTS4.qa",
  "bein-sports-mena-5": "beINSPORTS5.qa",
  "bein-sports-mena-6": "beINSPORTS6.qa",
  "bein-sports-mena-7": "beINSPORTS7.qa",
  "bein-sports-mena-8": "beINSPORTS8.qa",
  "bein-sports-mena-9": "beINSPORTS9.qa",

  // Baltics
  "go3-sport-1": "Go3Sport1.lv",
  "go3-sport-2": "Go3Sport2.lv",
  "go3-sport-3": "Go3Sport3.lv",

  // Balkans
  "arena-sport-1-bih": "ArenaSport1.ba",

  // Latin America & Brazil
  "tyc-sports-internacional": "TyCSportsInternacional.ar",
  "premiere": "PremiereClubes.br",

  // India & Asia
  "unite8-sports-1-zee-caf": "ZeeCafe.in",
};

const TIM_LOGOS = require("./tim-logos.json");

/**
 * Clean and fix XML-escaped entities (&amp;) in logo URLs
 */
function cleanLogoUrl(url) {
  if (!url) return "";
  let clean = url.trim();
  while (clean.includes("&amp;")) {
    clean = clean.replace(/&amp;/g, "&");
  }
  return clean;
}

/**
 * Get standard/original TV logo for TimStreams channel
 * Prefers transparent/vector PNGs from tv-logo/tv-logos repo,
 * falling back to cleaned API logo.
 */
function getTimChannelLogo(ch) {
  if (!ch) return "";

  const url = (ch.url || "").trim().toLowerCase();
  if (url && TIM_LOGOS[url]) {
    return TIM_LOGOS[url];
  }

  return cleanLogoUrl(ch.logo || "");
}

/**
 * Get standard EPG tvg-id for a channel from TimStreams
 * Returns null if channel has no verified EPG identifier
 */
function getTimChannelEpgId(ch) {
  if (!ch) return null;

  const url = (ch.url || "").trim().toLowerCase();
  if (url && TIM_EPG_MAP[url]) {
    return TIM_EPG_MAP[url];
  }

  const nameKey = (ch.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (nameKey && TIM_EPG_MAP[nameKey]) {
    return TIM_EPG_MAP[nameKey];
  }

  return null;
}

module.exports = {
  TIM_EPG_MAP,
  TIM_LOGOS,
  cleanLogoUrl,
  getTimChannelLogo,
  getTimChannelEpgId,
};
