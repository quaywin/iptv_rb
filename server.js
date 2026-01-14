const express = require("express");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { Readable } = require("stream");
const { generateIPTVFile } = require("./generate");
const { setGlobalDispatcher, Agent, request } = require('undici');

// Cấu hình Global Agent để tối ưu kết nối (Keep-Alive)
// Tăng số lượng kết nối đồng thời để xử lý nhiều segments video
const agent = new Agent({
  connect: {
    keepAlive: true,      // Giữ kết nối
    keepAliveTimeout: 15000,
    timeout: 30000
  },
  connections: 500, // Tăng lên 500 kết nối song song (quan trọng cho streaming)
  pipelining: 1,    // Thử bật pipelining mức thấp
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
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://robong.me/",
            "Origin": "https://robong.me",
            "Connection": "keep-alive"
        };

        // Forward header 'Range' nếu client yêu cầu
        if (req.headers.range) {
            headers["Range"] = req.headers.range;
        }

        // 2. Gọi request tới nguồn bằng undici.request (nhanh hơn fetch native)
        const { statusCode, headers: responseHeaders, body } = await request(targetUrl, {
            method: 'GET',
            headers
        });

        if (statusCode >= 400) { 
             // Consume body để giải phóng socket
             try { await body.dump(); } catch {}
             throw new Error(`Stream error: ${statusCode}`);
        }

        // 3. Forward Headers trả về
        res.setHeader("Access-Control-Allow-Origin", "*");
        
        const headersToForward = [
            "content-type", "content-length", "content-range", 
            "accept-ranges", "last-modified", "etag"
        ];
        
        headersToForward.forEach(h => {
            const val = responseHeaders[h];
            if (val) res.setHeader(h, val);
        });

        const contentType = responseHeaders["content-type"];

        // 4. Xử lý rewrite M3U8
        // Kiểm tra contentType hoặc đuôi file
        const isM3u8 = (contentType && contentType.includes("mpegurl")) || targetUrl.includes(".m3u8");
        
        if (isM3u8 && statusCode === 200) {
            // Với m3u8, cần đọc text để rewrite
            // undici body là stream, ta gom lại thành string
            let text = await body.text();
            
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

            res.removeHeader("content-length");
            return res.send(newText);
        }

        // 5. Pipe stream dữ liệu gốc (TS, FLV...)
        // undici body là Node stream, pipe thẳng được luôn -> Hiệu năng cao
        res.status(statusCode);
        body.pipe(res);

        // Xử lý lỗi khi pipe đứt gánh
        body.on('error', (err) => {
            console.error('Body stream error:', err.message);
            res.end();
        });

        res.on('close', () => {
             // Khi client ngắt kết nối, hủy stream từ nguồn
             body.destroy();
        });

    } catch (error) {        if (error.name !== 'AbortError') {
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
const server = app.listen(port, () => console.log(`Listening on http://localhost:${port}`));

// Tối quan trọng: Tắt timeout mặc định của server
// Mặc định Node.js sẽ ngắt kết nối sau 2 phút nếu không có hoạt động,
// hoặc giới hạn thời gian request. Với Livestream (kéo dài hàng giờ), cần set về 0 (vô hạn).
server.timeout = 0;
server.keepAliveTimeout = 60000 * 60; // 1 tiếng
