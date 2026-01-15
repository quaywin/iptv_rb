const fs = require("fs");
const path = require("path");
const { generateIPTVFile } = require("./generate");

// Cấu hình
const PLAYLIST_FILE = path.join(__dirname, "playlist.m3u");
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 phút
const TIMEOUT = 2000; // Timeout cho mỗi request (2s)
const PROXY_THRESHOLD = 500; // Nếu ping > 500ms thì dùng Proxy

// Hàm delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm check stream health (HEAD request)
async function checkStream(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      method: "HEAD", // Chỉ lấy header để check nhanh
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const latency = Date.now() - start;

    if (response.ok) {
      return { alive: true, latency };
    } else {
      return { alive: false, latency: 0, error: response.status };
    }
  } catch (error) {
    return { alive: false, latency: 0, error: "timeout/error" };
  }
}

// Hàm xử lý chính
async function runWorker() {
  console.log(`[${new Date().toISOString()}] Bắt đầu chu trình tạo và kiểm tra playlist...`);

  try {
    // 1. Generate nội dung gốc
    let originalContent = await generateIPTVFile();
    if (!originalContent) {
      console.log("⚠️ Không tạo được nội dung playlist.");
      return;
    }

    // 2. Parse M3U để lấy danh sách cần check
    // Tách thành các dòng
    const lines = originalContent.split("\n");
    const newLines = [];
    
    // Buffer để giữ thông tin entry hiện tại
    let currentEntry = []; 
    let isLive = false;

    // Duyệt qua từng dòng để xử lý
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith("#EXTINF")) {
        // Bắt đầu 1 entry mới
        currentEntry = [line];
        // Check xem có phải live không (có icon 🔴)
        isLive = line.includes("🔴");
      } else if (line.startsWith("http") || line.startsWith("PROXY://")) {
        // Đây là dòng URL (có thể đã có prefix từ lần run trước nếu đọc file cũ, nhưng đây là generate mới nên ok)
        let url = line;
        
        // Nếu là Live -> Check stream
        if (isLive) {
          const checkResult = await checkStream(line);
          
          let infLine = currentEntry[0];
          let statusIcon = "";
          let latencyText = "";
          let useProxy = false;

          if (checkResult.alive) {
            // Ping màu xanh/vàng/đỏ tùy tốc độ
            if (checkResult.latency < 500) statusIcon = "🟢";
            else if (checkResult.latency < 1500) statusIcon = "🟡";
            else statusIcon = "🟠";
            
            latencyText = ` | ${checkResult.latency}ms ${statusIcon}`;

            // Quyết định dùng Proxy hay không cho luồng chính
            // Logic mới: Check domain
            if (line.includes("rblive.starxcdn.xyz")) {
                useProxy = true;
            } else if (line.includes("cdnfastest")) {
                useProxy = false;
            } else if (checkResult.latency > PROXY_THRESHOLD) {
                // Fallback: Nếu không thuộc rule trên thì check ping
                useProxy = true;
            }
          } else {
            statusIcon = "❌"; // Chết
            latencyText = ` | OFF ${statusIcon}`;
            // Nếu chết cũng thử qua proxy xem sao (hoặc giữ nguyên)
            useProxy = true; 
          }

          // 1. XỬ LÝ LUỒNG CHÍNH (MAIN STREAM)
          // Cập nhật thông tin Ping vào Title
          const lastCommaIndex = infLine.lastIndexOf(",");
          let mainTitlePart = "";
          let metaPart = "";
          
          if (lastCommaIndex !== -1) {
             metaPart = infLine.substring(0, lastCommaIndex);
             const rawTitle = infLine.substring(lastCommaIndex + 1);
             // Xóa thông tin cũ nếu có để tránh duplicate khi update
             mainTitlePart = rawTitle.replace(/ \| \d+ms .| \| OFF ./, "");
             
             // Gán title mới cho entry chính
             currentEntry[0] = `${metaPart},${mainTitlePart}${latencyText}`;
          }

          // Cập nhật URL chính (Thêm prefix PROXY:// nếu cần)
          if (useProxy) {
              currentEntry.push(`PROXY://${line}`); // line là url gốc
          } else {
              currentEntry.push(line);
          }

          // Đẩy luồng chính vào danh sách
          newLines.push(...currentEntry);
          newLines.push(""); 

          // 2. XỬ LÝ LUỒNG PHỤ (BACKUP STREAM - FORCE PROXY)
          // Chỉ tạo backup nếu link còn sống (alive) VÀ luồng chính chưa dùng proxy
          // (Nếu luồng chính đã proxy rồi thì không cần hiện thêm 1 dòng proxy nữa)
          if (checkResult.alive && !useProxy) {
              const backupTitle = `${mainTitlePart} [Proxy]`;
              const backupEntry = [
                  `${metaPart},${backupTitle}`, // Title sạch + [Proxy] (không cần ping)
                  `PROXY://${line}`             // Luôn luôn dùng Proxy
              ];
              newLines.push(...backupEntry);
              newLines.push("");
          }

          currentEntry = []; // Reset buffer
        } else {
            // Không phải live, giữ nguyên URL
            currentEntry.push(url);
            newLines.push(...currentEntry);
            newLines.push("");
            currentEntry = [];
        }
      } else if (line.startsWith("#EXTM3U")) {
        newLines.push(line);
        newLines.push("");
      }
    }

    // 3. Ghi file
    const finalContent = newLines.join("\n");
    fs.writeFileSync(PLAYLIST_FILE, finalContent);
    console.log(`✅ Đã cập nhật playlist.m3u (${(finalContent.match(/#EXTINF/g) || []).length} kênh)`);

  } catch (error) {
    console.error("❌ Lỗi trong worker:", error);
  }
}

// Chạy ngay lần đầu
runWorker();

// Lặp lại mỗi 5 phút
setInterval(runWorker, CHECK_INTERVAL);
