const express = require("express");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { Readable } = require("stream");
const { generateIPTVFile } = require("./generate");

const app = express();
const PLAYLIST_FILE = path.join(__dirname, "playlist.m3u");

// Proxy endpoint
app.get("/live", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing URL");

    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://robong.me/",
            "Origin": "https://robong.me"
        };

        const controller = new AbortController();
        req.on("close", () => controller.abort());

        const response = await fetch(targetUrl, {
            headers,
            signal: controller.signal
        });

        if (!response.ok) throw new Error(`Stream error: ${response.status}`);

        res.setHeader("Access-Control-Allow-Origin", "*");
        
        const contentType = response.headers.get("content-type");
        res.setHeader("Content-Type", contentType || "application/octet-stream");

        // Xử lý rewrite M3U8
        if (contentType && (contentType.includes("mpegurl") || targetUrl.includes(".m3u8"))) {
            const text = await response.text();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
            
            const newText = text.split("\n").map(line => {
                line = line.trim();
                if (!line || line.startsWith("#")) return line;
                
                try {
                    const absoluteUrl = new url.URL(line, baseUrl).href;
                    return `${req.protocol}://${req.get("host")}/live?url=${encodeURIComponent(absoluteUrl)}`;
                } catch (e) {
                    return line;
                }
            }).join("\n");

            return res.send(newText);
        }

        // Pipe stream
        if (response.body) {
             Readable.fromWeb(response.body).pipe(res);
        } else {
             res.end();
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Proxy error:", error.message);
            if (!res.headersSent) res.status(502).send("Bad Gateway");
        }
    }
});

app.get("/playlist.m3u", async (req, res) => {
    try {
        let content = "";
        // Kiểm tra file playlist.m3u có tồn tại không
        if (fs.existsSync(PLAYLIST_FILE)) {
             content = fs.readFileSync(PLAYLIST_FILE, "utf-8");
        } else {
            console.log("Playlist file not found. Generating new one...");
            content = await generateIPTVFile();
            if (content) fs.writeFileSync(PLAYLIST_FILE, content);
        }

        if (!content || content.trim() === "") {
            return res.status(404).send("No playlist available.");
        }

        // Rewrite URL trong playlist thành Proxy URL NẾU có prefix PROXY://
        const host = req.get("host");
        const protocol = req.protocol;
        
        const proxiedContent = content.split("\n").map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith("PROXY://")) {
                // Xóa prefix và chuyển thành link proxy
                const originalUrl = trimmed.replace("PROXY://", "");
                return `${protocol}://${host}/live?url=${encodeURIComponent(originalUrl)}`;
            }
            // Nếu không có prefix, giữ nguyên (Direct Link)
            return line;
        }).join("\n");

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
        res.send(proxiedContent);

    } catch (error) {
        console.error(error);
        res.status(500).send("Error generating playlist");
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
