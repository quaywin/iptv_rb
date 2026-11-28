const fs = require("fs");
const path = require("path");
const config = require("../config");
const { buildFullVodCatalog, buildFullSeriesCatalog } = require("../providers/tmdb");

async function main() {
  const startedAt = Date.now();
  const outDir = path.join(__dirname, "..", "public", "catalog");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("Building static TMDB VOD & Series catalogs...");

  const [vodCatalog, seriesCatalog] = await Promise.all([
    buildFullVodCatalog(config.tmdbApiKey),
    buildFullSeriesCatalog(config.tmdbApiKey),
  ]);

  if (!vodCatalog?.items?.length || !seriesCatalog?.items?.length) {
    throw new Error(
      `Empty catalog generated (VOD: ${vodCatalog?.items?.length || 0}, Series: ${seriesCatalog?.items?.length || 0})`
    );
  }

  const writeCatalog = (filename, catalog) => {
    const { itemById: _ignored, ...serializable } = catalog;
    const json = JSON.stringify(serializable);
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, json, "utf8");
    return (Buffer.byteLength(json, "utf8") / 1024).toFixed(1);
  };

  const vodSizeKb = writeCatalog("vod.json", vodCatalog);
  const seriesSizeKb = writeCatalog("series.json", seriesCatalog);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);

  console.log(
    `VOD catalog: ${vodCatalog.items.length} unique movies across ${vodCatalog.categoriesCount} categories (${vodSizeKb} KB)`
  );
  console.log(
    `Series catalog: ${seriesCatalog.items.length} unique shows across ${seriesCatalog.categoriesCount} categories (${seriesSizeKb} KB)`
  );
  console.log(`Static catalogs built in ${elapsedSec}s.`);
}

main().catch((err) => {
  console.error("Failed to build catalogs:", err);
  process.exit(1);
});
