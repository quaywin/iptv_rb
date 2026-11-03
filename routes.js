const {
  generateStrmPlaylist,
  generatePpvPlaylist,
  generateTimLivePlaylist,
  generateTimChannelsPlaylist,
  generateSportsbitePlaylist,
  generateChannel3Playlist,
  generateGkPlaylist,
  generatePitPlaylist,
  generateCinePlaylist,
  generateCombinedPlaylist,
} = require("./generate");

const ROUTES = {
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

  "/pit": { filename: "pit.m3u", generator: generatePitPlaylist },
  "/pit.m3u": { filename: "pit.m3u", generator: generatePitPlaylist },

  "/cine": { filename: "cine.m3u", generator: generateCinePlaylist },
  "/cine.m3u": { filename: "cine.m3u", generator: generateCinePlaylist },
  "/cinevid": { filename: "cine.m3u", generator: generateCinePlaylist },
  "/cinevid.m3u": { filename: "cine.m3u", generator: generateCinePlaylist },

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
