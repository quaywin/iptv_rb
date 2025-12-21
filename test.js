const { generateIPTVFile } = require("./generate");
const fs = require("fs");

async function runTest() {
    try {
        console.log("Starting test: Generate IPTV File...");
        const content = await generateIPTVFile();

        if (content) {
            console.log("Successfully generated IPTV content.");
            fs.writeFileSync("test.m3u", content);
            console.log("Saved content to test.m3u");
        } else {
            console.warn("No content generated.");
        }
    } catch (error) {
        console.error("Test failed with error:", error);
    }
}

runTest();
