// new file: scripts/export-lore-json.js

import { createClient as createContentfulClient } from 'contentful';
import dotenv from 'dotenv';
import fs from 'fs'; // Import the Node.js File System module

dotenv.config();

// Initialize Contentful Client
const contentfulClient = createContentfulClient({
    space: process.env.VITE_CONTENTFUL_SPACE_ID,
    accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN,
});

async function main() {
    console.log("Starting lore export to JSON...");

    try {
        console.log("Fetching all lore entries from Contentful...");
        const allPortals = await contentfulClient.getEntries({
            content_type: 'lore',
            limit: 1000,
            include: 10, // This includes linked entries
        });
        console.log(`Found ${allPortals.items.length} portal entries to export.`);

        // Convert the array of entries into a formatted JSON string
        const jsonContent = JSON.stringify(allPortals.items, null, 2);

        // Write the JSON string to a file
        fs.writeFileSync('lore-export.json', jsonContent);
        console.log("\n✅ Success! All lore has been exported to 'lore-export.json'");

    } catch (err) {
        console.error("\n❌ Error during export:", err);
    }

    console.log("\nLore export process finished.");
}

main();