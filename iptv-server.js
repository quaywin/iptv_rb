const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

const PORT = 4444;
const { generateIPTVFile } = require("./generate");

// Route serve file M3U
app.get("/play", async (req, res) => {
  try {
    // Gọi hàm lấy nội dung M3U trực tiếp
    const content = await generateIPTVFile();

    if (!content || content.trim() === "") {
      return res.status(404).send("No playlist available at this time.");
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=current_playlist.m3u",
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    res.send(content);

    console.log(`Served playlist (dynamic) - ${new Date().toISOString()}`);
  } catch (error) {
    console.error("Error serving playlist:", error);
    res.status(500).send("Error generating playlist");
  }
});

// Route kiểm tra status
// app.get("/status", (req, res) => {
//   try {
//     if (fs.existsSync(M3U_FILE_PATH)) {
//       const stats = fs.statSync(M3U_FILE_PATH);
//       const content = fs.readFileSync(M3U_FILE_PATH, "utf8");
//       const channelCount = content
//         .split("\n")
//         .filter((line) => line.startsWith("#EXTINF")).length;

//       res.json({
//         status: "ok",
//         file_exists: true,
//         last_updated: stats.mtime,
//         file_size: stats.size,
//         total_channels: channelCount,
//       });
//     } else {
//       res.json({
//         status: "waiting",
//         file_exists: false,
//         message: "Playlist file not found",
//       });
//     }
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       message: error.message,
//     });
//   }
// });

// // Route trang chủ
// app.get("/", (req, res) => {
//   res.send(`
//     <html>
//     <head>
//         <title>IPTV Football Server</title>
//         <style>
//             body { font-family: Arial, sans-serif; margin: 40px; }
//             .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
//             .online { background-color: #d4edda; color: #155724; }
//             .offline { background-color: #f8d7da; color: #721c24; }
//         </style>
//     </head>
//     <body>
//         <h1>🏈 IPTV Football Server</h1>

//         <div id="status" class="status">Checking status...</div>

//         <h2>📺 Playlist URL:</h2>
//         <p><a href="/playlist.m3u"><strong>http://your-domain.com/playlist.m3u</strong></a></p>

//         <h2>ℹ️ Information:</h2>
//         <ul>
//             <li>Playlist updates every 3 hours automatically</li>
//             <li>Contains matches for today and tomorrow</li>
//             <li>Direct download link for M3U file</li>
//         </ul>

//         <h2>🔗 Other Links:</h2>
//         <ul>
//             <li><a href="/status">Server Status (JSON)</a></li>
//             <li><a href="/playlist.m3u">Download Playlist</a></li>
//         </ul>

//         <script>
//             fetch('/status')
//                 .then(response => response.json())
//                 .then(data => {
//                     const statusDiv = document.getElementById('status');
//                     if (data.file_exists) {
//                         statusDiv.className = 'status online';
//                         statusDiv.innerHTML = \`
//                             ✅ <strong>Online</strong><br>
//                             Last Updated: \${new Date(data.last_updated).toLocaleString()}<br>
//                             Total Channels: \${data.total_channels}<br>
//                             File Size: \${(data.file_size/1024).toFixed(1)} KB
//                         \`;
//                     } else {
//                         statusDiv.className = 'status offline';
//                         statusDiv.innerHTML = '❌ <strong>Playlist not available</strong><br>Please wait for next update.';
//                     }
//                 })
//                 .catch(error => {
//                     document.getElementById('status').innerHTML = '⚠️ Error checking status';
//                 });
//         </script>
//     </body>
//     </html>
//     `);
// });

app.listen(PORT, () => {
  console.log(`🚀 IPTV Server running on port ${PORT}`);
  console.log(`📺 Playlist URL: http://localhost:${PORT}/play`);
});
