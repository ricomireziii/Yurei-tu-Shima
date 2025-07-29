import { createClient as createContentfulClient } from 'contentful';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { documentToPlainTextString } from '@contentful/rich-text-plain-text-renderer';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Clients with VITE_ prefix for Contentful variables
const contentfulClient = createContentfulClient({
    space: process.env.VITE_CONTENTFUL_SPACE_ID,
    accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN,
});

const supabaseClient = createSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Function to break down large texts into smaller, overlapping chunks
function chunkText(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

async function main() {
    console.log("Starting lore indexing process...");

    // 1. Clear existing documents from the table to avoid duplicates
    console.log("Clearing existing documents from Supabase...");
    const { error: deleteError } = await supabaseClient.from('documents').delete().neq('id', 0);
    if (deleteError) {
        console.error("Error clearing documents:", deleteError);
        return;
    }
    console.log("Existing documents cleared.");

    // 2. Fetch all lore from Contentful
    console.log("Fetching all lore entries from Contentful...");
    const allPortals = await contentfulClient.getEntries({
        content_type: 'lore',
        limit: 1000,
    });
    console.log(`Found ${allPortals.items.length} portal entries.`);

    const documentsToInsert = [];

    // 3. Process each portal into chunks
    for (const portal of allPortals.items) {
        if (!portal.fields.title) continue;

        let portalText = `Title: ${portal.fields.title}\n`;
        if (portal.fields.introduction) {
            portalText += documentToPlainTextString(portal.fields.introduction);
        }
        if (portal.fields.conclusion) {
            portalText += '\n' + documentToPlainTextString(portal.fields.conclusion);
        }

        const textChunks = chunkText(portalText);
        
        for (const chunk of textChunks) {
            documentsToInsert.push({ content: chunk });
        }
    }
    console.log(`Created ${documentsToInsert.length} text chunks to be embedded.`);

    // 4. Generate embeddings and insert into Supabase in batches
    const batchSize = 50; // Process in batches to avoid overwhelming the API
    for (let i = 0; i < documentsToInsert.length; i += batchSize) {
        const batch = documentsToInsert.slice(i, i + batchSize);
        const contentBatch = batch.map(doc => doc.content);
        
        console.log(`Generating embeddings for batch ${Math.floor(i / batchSize) + 1}...`);
        const result = await embeddingModel.batchEmbedContents({
            requests: contentBatch.map(text => ({ model: "models/text-embedding-004", content: { parts: [{ text }] } })),
        });

        const embeddings = result.embeddings;
        for (let j = 0; j < embeddings.length; j++) {
            batch[j].embedding = embeddings[j].values;
        }

        console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} into Supabase...`);
        const { error } = await supabaseClient.from('documents').insert(batch);
        if (error) {
            console.error("Error inserting batch:", error);
        }
    }

    console.log("Lore indexing process completed successfully!");
}

main();