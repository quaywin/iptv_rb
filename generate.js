const { generateStrmPlaylist, fetchStrmStreamList } = require("./providers/strm");
const { generatePpvPlaylist, fetchPpvStreamList } = require("./providers/ppv");
const { generateTimChannelsPlaylist, fetchTimChannelsList, getChannelCountry } = require("./providers/tim-channels");
const { generateTimLivePlaylist, fetchTimStreamList, resolveTimEventStream } = require("./providers/tim-live");
const { generateGkPlaylist, fetchGkStreamList } = require("./providers/gk");
const { generateSportsbitePlaylist, fetchSportsbiteChannels } = require("./providers/channel2");
const { generatePitPlaylist, fetchPitStreamList } = require("./providers/pit");
const { generateCinePlaylist, fetchCineStreamList } = require("./providers/cine");
const { generateChannel3Playlist, fetchChannel3List, getVidcdnChannelCountry } = require("./providers/channel3");
const { generateDamPlaylist, fetchDamStreamList, generateOndemandPlaylist } = require("./providers/dam");
const { generateSports247Playlist, fetchSports247Events } = require("./providers/sports247");
const { generateChannel4Playlist, fetchSports247Channels, getSports247ChannelCountry } = require("./providers/channel4");
const { generateChannel5Playlist, fetchCdnChannelsList, getCdnChannelCountry } = require("./providers/channel5");
const { generateCdnPlaylist, fetchCdnEventsList } = require("./providers/cdn");

/**
 * Generate combined playlist from all providers
 * If getCachedPlaylist function is passed via customConfig, it reuses fresh cached data if available.
 */
async function generateCombinedPlaylist(customConfig = {}) {
  const getSub = (filename, generator) => {
    if (typeof customConfig.getCachedPlaylist === "function") {
      return customConfig.getCachedPlaylist(filename, () => generator(customConfig));
    }
    return generator(customConfig);
  };

  const [strm, ppv, timLive, timChannels, channel2, channel3, gk, pit, cine, dam, s247, channel4, channel5, cdn] = await Promise.all([
    getSub("strm.m3u", generateStrmPlaylist).catch(e => {
      console.error("STRM error in combined:", e.message);
      return "";
    }),
    getSub("ppv.m3u", generatePpvPlaylist).catch(e => {
      console.error("PPV error in combined:", e.message);
      return "";
    }),
    getSub("tim.m3u", generateTimLivePlaylist).catch(e => {
      console.error("Tim Live error in combined:", e.message);
      return "";
    }),
    getSub("channels.m3u", generateTimChannelsPlaylist).catch(e => {
      console.error("Tim Channels error in combined:", e.message);
      return "";
    }),
    getSub("channel2.m3u", generateSportsbitePlaylist).catch(e => {
      console.error("Channel2 error in combined:", e.message);
      return "";
    }),
    getSub("channel3.m3u", generateChannel3Playlist).catch(e => {
      console.error("Channel3 error in combined:", e.message);
      return "";
    }),
    getSub("gk.m3u", generateGkPlaylist).catch(e => {
      console.error("GK error in combined:", e.message);
      return "";
    }),
    getSub("pit.m3u", generatePitPlaylist).catch(e => {
      console.error("Pit error in combined:", e.message);
      return "";
    }),
    getSub("cine.m3u", generateCinePlaylist).catch(e => {
      console.error("Cine error in combined:", e.message);
      return "";
    }),
    getSub("dam.m3u", generateDamPlaylist).catch(e => {
      console.error("DAM error in combined:", e.message);
      return "";
    }),
    getSub("247.m3u", generateSports247Playlist).catch(e => {
      console.error("Sports247 error in combined:", e.message);
      return "";
    }),
    getSub("channel4.m3u", generateChannel4Playlist).catch(e => {
      console.error("Channel4 error in combined:", e.message);
      return "";
    }),
    getSub("channel5.m3u", generateChannel5Playlist).catch(e => {
      console.error("Channel5 error in combined:", e.message);
      return "";
    }),
    getSub("cdn.m3u", generateCdnPlaylist).catch(e => {
      console.error("CDN Events error in combined:", e.message);
      return "";
    }),
  ]);

  const parts = [strm, ppv, timLive, timChannels, channel2, channel3, gk, pit, cine, dam, s247, channel4, channel5, cdn]
    .map(p => (p || "").replace(/^#EXTM3U[^\n]*\n+/i, "").trim())
    .filter(Boolean);

  if (!parts.length) return "#EXTM3U tvg-shift=0 m3uautoload=1\n\n";

  return `#EXTM3U tvg-shift=0 m3uautoload=1\n\n${parts.join("\n\n")}\n`;
}

module.exports = {
  // Main Playlist Generators
  generateIPTVFile: generateStrmPlaylist,
  generateStrmPlaylist,
  generatePpvPlaylist,
  generateTimLivePlaylist,
  generateTimChannelsPlaylist,
  generateSportsbitePlaylist,
  generateChannel2Playlist: generateSportsbitePlaylist,
  generateChannel3Playlist,
  generateVidcdnPlaylist: generateChannel3Playlist,
  generateChannel4Playlist,
  generateSports247ChannelsPlaylist: generateChannel4Playlist,
  generateChannel5Playlist,
  generateCdnPlaylist,
  generateGkPlaylist,
  generatePitPlaylist,
  generateCinePlaylist,
  generateDamPlaylist,
  generateOndemandPlaylist,
  generateSports247Playlist,
  generateCombinedPlaylist,

  // Stream Fetchers
  fetchStrmStreamList,
  fetchPpvStreamList,
  fetchTimChannelsList,
  fetchSportsbiteChannels,
  fetchVidcdnChannelsList: fetchChannel3List,
  fetchChannel3List,
  fetchSports247Channels,
  fetchCdnChannelsList,
  fetchChannel5List: fetchCdnChannelsList,
  fetchCdnEventsList,
  fetchTimStreamList,
  resolveTimEventStream,
  fetchGkStreamList,
  fetchPitStreamList,
  fetchCineStreamList,
  fetchDamStreamList,
  fetchSports247Events,
  getChannelCountry,
  getVidcdnChannelCountry,
  getSports247ChannelCountry,
  getCdnChannelCountry,
};
