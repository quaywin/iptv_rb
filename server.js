const fs = require("fs");
const path = require("path");
const config = require("./config");
const { generateIPTVFile } = require("./generate");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const PLAYLIST_FILE = path.join(DATA_DIR, "playlist.m3u");

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. Proxy Endpoint (/live)
    if (url.pathname === "/live") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) return new Response("Missing URL", { status: 400 });

      try {
        const headers = {
          "User-Agent": config.userAgent,
          "Referer": config.referer,
          "Origin": config.origin,
          "Connection": "keep-alive"
        };

        const range = req.headers.get("range");
        if (range) headers["Range"] = range;

        const response = await fetch(targetUrl, { headers });

        if (!response.ok) {
          return new Response(`Stream error: ${response.status}`, { status: 502 });
        }

        // Headers to forward
        const forwardHeaders = new Headers({
          "Access-Control-Allow-Origin": "*",
          "Cloudflare-CDN-Cache-Control": "no-store",
          "CDN-Cache-Control": "no-store",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        });

        const headersToCopy = [
          "content-type", "content-length", "content-range",
          "accept-ranges", "last-modified", "etag"
        ];

        for (const h of headersToCopy) {
          const val = response.headers.get(h);
          if (val) forwardHeaders.set(h, val);
        }

        const contentType = response.headers.get("content-type") || "";
        const isM3u8 = contentType.includes("mpegurl") || targetUrl.includes(".m3u8");

        // Handle M3U8 Rewrite
        if (isM3u8 && response.status === 200) {
          const text = await response.text();
          const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
          const host = req.headers.get("host");
          const protocol = url.protocol;

          const newText = text.split("\n").map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return trimmed;
            try {
              const absUrl = new URL(trimmed, baseUrl).href;
              return `${protocol}//${host}/live?url=${encodeURIComponent(absUrl)}`;
            } catch { return trimmed; }
          }).join("\n");

          forwardHeaders.delete("content-length");
          return new Response(newText, { headers: forwardHeaders });
        }

        // Direct stream pipe (native Bun optimization)
        return new Response(response.body, {
          status: response.status,
          headers: forwardHeaders
        });

      } catch (error) {
        console.error(`Proxy error [${targetUrl}]:`, error.message);
        return new Response("Bad Gateway", { status: 502 });
      }
    }

    // 2. Playlist Endpoint (/)
    if (url.pathname === "/") {
      try {
        const file = Bun.file(PLAYLIST_FILE);
        let content = "";

        if (await file.exists()) {
          content = await file.text();
        } else {
          console.log("Playlist not found. Generating...");
          content = await generateIPTVFile();
          if (content) await Bun.write(PLAYLIST_FILE, content);
        }

        if (!content?.trim()) return new Response("No playlist available", { status: 404 });

        const host = req.headers.get("host");
        const protocol = url.protocol;

        const proxiedContent = content.split("\n").map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith("PROXY://")) {
            const originalUrl = trimmed.replace("PROXY://", "");
            return `${protocol}//${host}/live?url=${encodeURIComponent(originalUrl)}`;
          }
          return line;
        }).join("\n");

        return new Response(proxiedContent, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Content-Disposition": 'attachment; filename="playlist.m3u"',
            "Cache-Control": "public, max-age=30",
            "Cloudflare-CDN-Cache-Control": "max-age=30"
          }
        });

      } catch (error) {
        console.error(error);
        return new Response("Error generating playlist", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
  // Idle timeout for connections (seconds). Default is 10.
  // Bun has a max limit for idleTimeout in some versions, setting to 30s.
  idleTimeout: 30,
});

console.log(`Listening on http://localhost:${server.port}`);
