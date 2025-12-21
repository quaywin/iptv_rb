const express = require("express");
const { generateIPTVFile } = require("./generate");

const app = express();

app.get("/playlist.m3u", async (req, res) => {
    try {
        const content = await generateIPTVFile();
        if (!content || content.trim() === "") {
            return res.status(404).send("No playlist available.");
        }
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
        res.send(content);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error generating playlist");
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
