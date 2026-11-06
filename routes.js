const {
  generateStrmPlaylist,
  generatePpvPlaylist,
  generateTimLivePlaylist,
  generateTimChannelsPlaylist,
  generateSportsbitePlaylist,
  generateChannel3Playlist,
  generateChannel4Playlist,
  generateChannel5Playlist,
  generateCdnPlaylist,
  generateGkPlaylist,
  generatePitPlaylist,
  generateCinePlaylist,
  generateDamPlaylist,
  generateSports247Playlist,
  generateCombinedPlaylist,
} = require("./generate");

const ROUTES = {
  "/dam": { filename: "dam.m3u", generator: generateDamPlaylist },
  "/dam.m3u": { filename: "dam.m3u", generator: generateDamPlaylist },
  "/ondemand": { filename: "dam.m3u", generator: generateDamPlaylist },
  "/ondemand.m3u": { filename: "dam.m3u", generator: generateDamPlaylist },
  "/damitv": { filename: "dam.m3u", generator: generateDamPlaylist },
  "/damitv.m3u": { filename: "dam.m3u", generator: generateDamPlaylist },

  "/strm": { filename: "strm.m3u", generator: generateStrmPlaylist },
  "/strm.m3u": { filename: "strm.m3u", generator: generateStrmPlaylist },
  "/stream": { filename: "strm.m3u", generator: generateStrmPlaylist },
  "/stream.m3u": { filename: "strm.m3u", generator: generateStrmPlaylist },

  "/ppv": { filename: "ppv.m3u", generator: generatePpvPlaylist },
  "/ppv.m3u": { filename: "ppv.m3u", generator: generatePpvPlaylist },

  "/gk": { filename: "gk.m3u", generator: generateGkPlaylist },
  "/gk.m3u": { filename: "gk.m3u", generator: generateGkPlaylist },

  "/tim": { filename: "tim.m3u", generator: generateTimLivePlaylist },
  "/tim.m3u": { filename: "tim.m3u", generator: generateTimLivePlaylist },

  "/channel": { filename: "channels.m3u", generator: generateTimChannelsPlaylist },
  "/channel.m3u": { filename: "channels.m3u", generator: generateTimChannelsPlaylist },
  "/channels": { filename: "channels.m3u", generator: generateTimChannelsPlaylist },
  "/channels.m3u": { filename: "channels.m3u", generator: generateTimChannelsPlaylist },

  "/channel2": { filename: "channel2.m3u", generator: generateSportsbitePlaylist },
  "/channel2.m3u": { filename: "channel2.m3u", generator: generateSportsbitePlaylist },

  "/channel3": { filename: "channel3.m3u", generator: generateChannel3Playlist },
  "/channel3.m3u": { filename: "channel3.m3u", generator: generateChannel3Playlist },
  "/vidcdn": { filename: "channel3.m3u", generator: generateChannel3Playlist },
  "/vidcdn.m3u": { filename: "channel3.m3u", generator: generateChannel3Playlist },

  "/channel4": { filename: "channel4.m3u", generator: generateChannel4Playlist },
  "/channel4.m3u": { filename: "channel4.m3u", generator: generateChannel4Playlist },
  "/sports247-channels": { filename: "channel4.m3u", generator: generateChannel4Playlist },
  "/sports247-channels.m3u": { filename: "channel4.m3u", generator: generateChannel4Playlist },

  "/channel5": { filename: "channel5.m3u", generator: generateChannel5Playlist },
  "/channel5.m3u": { filename: "channel5.m3u", generator: generateChannel5Playlist },
  "/cdn": { filename: "cdn.m3u", generator: generateCdnPlaylist },
  "/cdn.m3u": { filename: "cdn.m3u", generator: generateCdnPlaylist },
  "/cdnlivetv": { filename: "cdn.m3u", generator: generateCdnPlaylist },
  "/cdnlivetv.m3u": { filename: "cdn.m3u", generator: generateCdnPlaylist },

  "/pit": { filename: "pit.m3u", generator: generatePitPlaylist },
  "/pit.m3u": { filename: "pit.m3u", generator: generatePitPlaylist },

  "/cine": { filename: "cine.m3u", generator: generateCinePlaylist },
  "/cine.m3u": { filename: "cine.m3u", generator: generateCinePlaylist },
  "/cinevid": { filename: "cine.m3u", generator: generateCinePlaylist },
  "/cinevid.m3u": { filename: "cine.m3u", generator: generateCinePlaylist },

  "/247": { filename: "247.m3u", generator: generateSports247Playlist },
  "/247.m3u": { filename: "247.m3u", generator: generateSports247Playlist },
  "/sports247": { filename: "247.m3u", generator: generateSports247Playlist },
  "/sports247.m3u": { filename: "247.m3u", generator: generateSports247Playlist },

  "/all": { filename: "all.m3u", generator: generateCombinedPlaylist },
  "/all.m3u": { filename: "all.m3u", generator: generateCombinedPlaylist },
};

function getRouteHandler(pathname) {
  if (!pathname) return null;
  const normalized = pathname.toLowerCase();
  return ROUTES[normalized] || null;
}

module.exports = {
  ROUTES,
  getRouteHandler,
};
