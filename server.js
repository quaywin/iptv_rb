const express = require("express");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { Readable } = require("stream");
const config = require("./config");
const { generateIPTVFile } = require("./generate");
const { setGlobalDispatcher, Agent, request } = require('undici');

// Optimized Global Agent (Keep-Alive)
const agent = new Agent({
  connect: {
    keepAlive: true,
    keepAliveTimeout: 15000,
    timeout: 30000
  },
  connections: 500, // Important for streaming
  pipelining: 1,
});
setGlobalDispatcher(agent);

const app = express();
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const PLAYLIST_FILE = path.join(DATA_DIR, "playlist.m3u");

// Proxy endpoint
app.get("/live", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing URL");

  try {
    const headers = {
      "User-Agent": config.userAgent,
      "Referer": config.referer,
      "Origin": config.origin,
      "Connection": "keep-alive"
    };

    if (req.headers.range) headers["Range"] = req.headers.range;

    const { statusCode, headers: respHeaders, body } = await request(targetUrl, {
      method: 'GET',
      headers
    });

    if (statusCode >= 400) {
      try { await body.dump(); } catch {}
      throw new Error(`Stream error: ${statusCode}`);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const forwardHeaders = [
      "content-type", "content-length", "content-range",
      "accept-ranges", "last-modified", "etag"
    ];

    forwardHeaders.forEach(h => {
      if (respHeaders[h]) res.setHeader(h, respHeaders[h]);
    });

    const isM3u8 = respHeaders["content-type"]?.includes("mpegurl") || targetUrl.includes(".m3u8");

    if (isM3u8 && statusCode === 200) {
      const text = await body.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

      const newText = text.split("\n").map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return trimmed;
        try {
          const absUrl = new URL(trimmed, baseUrl).href;
          return `${req.protocol}://${req.get("host")}/live?url=${encodeURIComponent(absUrl)}`;
        } catch { return trimmed; }
      }).join("\n");

      res.removeHeader("content-length");
      return res.send(newText);
    }

    if (res.socket) res.socket.setNoDelay(true);
    res.status(statusCode);
    body.pipe(res);

    body.on('error', (err) => {
      console.error('Body stream error:', err.message);
      res.end();
    });

    res.on('close', () => body.destroy());

  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(`Proxy error [${targetUrl}]:`, error.message);
      if (!res.headersSent) res.status(502).send("Bad Gateway");
    }
  }
});

app.get("/", async (req, res) => {
  try {
    let content = "";
    if (fs.existsSync(PLAYLIST_FILE)) {
      content = fs.readFileSync(PLAYLIST_FILE, "utf-8");
    } else {
      console.log("Playlist not found. Generating...");
      content = await generateIPTVFile();
      if (content) fs.writeFileSync(PLAYLIST_FILE, content);
    }

    if (!content?.trim()) return res.status(404).send("No playlist available.");

    const host = req.get("host");
    const protocol = req.protocol;

    const proxiedContent = content.split("\n").map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("PROXY://")) {
        const url = trimmed.replace("PROXY://", "");
        return `${protocol}://${host}/live?url=${encodeURIComponent(url)}`;
      }
      return line;
    }).join("\n");

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
    res.setHeader("Cache-Control", "public, max-age=30");
    res.setHeader("Cloudflare-CDN-Cache-Control", "max-age=30");

    res.send(proxiedContent);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating playlist");
  }
});

const port = config.port;
const server = app.listen(port, () => console.log(`Listening on http://localhost:${port}`));

server.timeout = 0;
server.keepAliveTimeout = 3600000; // 1 hour
