const { generateIPTVFile } = require("../generate");

module.exports = async (req, res) => {
  try {
    const content = await generateIPTVFile();

    if (!content || content.trim() === "") {
      return res.status(404).send("No playlist available at this time xxxx.");
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=current_playlist.m3u",
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Tùy bạn muốn cache hay không — serverless có giới hạn execution và cold start
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    res.status(200).send(content);
  } catch (error) {
    console.error("Error generating playlist in serverless function:", error);
    res.status(500).send("Error generating playlist");
  }
};
