const express = require("express");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { Readable } = require("stream");
const { generateIPTVFile } = require("./generate");
const { setGlobalDispatcher, Agent } = require('undici');

// Cấu hình Global Agent để tối ưu kết nối (Keep-Alive)
const agent = new Agent({
  connect: {
    keepAlive: true,      // Giữ kết nối
    keepAliveTimeout: 10000,
    timeout: 30000
  },
  pipelining: 0,
});
setGlobalDispatcher(agent);

const app = express();
const PLAYLIST_FILE = path.join(__dirname, "playlist.m3u");

// Proxy endpoint
app.get("/live", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing URL");

    try {
        // 1. Chuẩn bị Headers gửi đi
        // Fake User-Agent để tránh bị chặn
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://robong.me/",
            "Origin": "https://robong.me"
        };

        // Forward header 'Range' nếu client yêu cầu (Quan trọng cho seek/buffering)
        if (req.headers.range) {
            headers["Range"] = req.headers.range;
        }

        const controller = new AbortController();
        req.on("close", () => controller.abort());

        // 2. Gọi request tới nguồn
        const response = await fetch(targetUrl, {
            headers,
            signal: controller.signal
        });

        if (!response.ok && response.status !== 206) { 
             throw new Error(`Stream error: ${response.status}`);
        }

        // 3. Forward Headers trả về
        res.setHeader("Access-Control-Allow-Origin", "*");
        
        // Forward các header quan trọng từ nguồn về client
        const headersToForward = [
            "content-type", "content-length", "content-range", 
            "accept-ranges", "last-modified", "etag"
        ];
        
        headersToForward.forEach(h => {
            const val = response.headers.get(h);
            if (val) res.setHeader(h, val);
        });

        const contentType = response.headers.get("content-type");

        // 4. Xử lý rewrite M3U8 (Chỉ khi không phải Range request một phần)
        // Nếu là request từng phần (Range), thường không phải là file m3u8 trọn vẹn
        if (contentType && (contentType.includes("mpegurl") || targetUrl.includes(".m3u8")) && response.status === 200) {
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

            // Cập nhật lại Content-Length vì nội dung đã thay đổi
            res.removeHeader("content-length");
            return res.send(newText);
        }

        // 5. Pipe stream dữ liệu gốc (TS, FLV...)
        if (response.body) {
             // Set status code đúng (200 hoặc 206 Partial Content)
             res.status(response.status);
             Readable.fromWeb(response.body).pipe(res);
        } else {
             res.end();
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error(`Proxy error [${targetUrl}]:`, error.message);
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
