// Vercel Serverless Function acting as a Proxy to your VPS
const config = require("../config");

module.exports = async (req, res) => {
  const VPS_URL = config.vpsUrl;

  try {
    const response = await fetch(VPS_URL);

    if (!response.ok) {
      return res
        .status(response.status)
        .send(`Failed to fetch from VPS: ${response.statusText}`);
    }

    const content = await response.text();

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=current_playlist.m3u",
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    res.status(200).send(content);
  } catch (error) {
    console.error("Error fetching from VPS:", error);
    res.status(500).send("Error generating playlist proxy");
  }
};
