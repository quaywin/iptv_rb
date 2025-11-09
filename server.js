const express = require("express");
const playlistHandler = require("./api/playlist"); // path to your file

const app = express();

app.get("/playlist.m3u", playlistHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
