// scripts/ingest-lore.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const LORE_FILE_PATH = path.resolve(__dirname, '../lore/Stories of Yurei-tu-Shima Volume 1.txt');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 100; // The API limit

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
    console.error("Missing required environment variables. Please double-check your .env file in the root directory.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// --- Helper Function to Chunk Text ---
function chunkText(text) {
    const paragraphs = text.split(/\n\s*\n/);
    const meaningfulChunks = paragraphs.filter(p => p.trim().length > 50);

    const finalChunks = [];
    meaningfulChunks.forEach(chunk => {
        if (chunk.length > 1800) {
            const subChunks = chunk.match(/[\s\S]{1,1800}/g) || [];
            finalChunks.push(...subChunks);
        } else {
            finalChunks.push(chunk);
        }
    });
    
    return finalChunks;
}

// --- Main Ingestion Function ---
async function ingestLore() {
    try {
        console.log('Starting lore ingestion...');

        // 1. Clear existing documents
        console.log('Clearing existing lore from the database...');
        const { error: deleteError } = await supabase.from('lore_documents').delete().neq('id', 0);
        if (deleteError) throw deleteError;

        // 2. Read and Chunk the Lore Document
        const loreText = fs.readFileSync(LORE_FILE_PATH, 'utf-8');
        const chunks = chunkText(loreText);
        console.log(`Lore split into ${chunks.length} chunks.`);

        if (chunks.length === 0) {
            console.log("No chunks to process. Exiting.");
            return;
        }

        console.log('Processing chunks in batches...');
        
        // 3. Process in batches
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batchChunks = chunks.slice(i, i + BATCH_SIZE);
            console.log(`- Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchChunks.length} chunks)`);

            // 4. Generate Embeddings for the current batch
            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: batchChunks.map(chunk => ({ content: { parts: [{ text: chunk }] } })),
            });
            const embeddings = embeddingResult.embeddings;

            if (embeddings.length !== batchChunks.length) {
                throw new Error("Mismatch between number of chunks and embeddings returned in a batch.");
            }

            // 5. Prepare Data for Supabase
            const documents = batchChunks.map((chunk, index) => ({
                content: chunk,
                embedding: embeddings[index].values,
            }));

            // 6. Store in Supabase
            const { error: insertError } = await supabase.from('lore_documents').insert(documents);
            if (insertError) throw insertError;
        }

        console.log(`\n✅ Ingestion complete! Successfully added ${chunks.length} documents to your Supabase database.`);

    } catch (error) {
        console.error("\n❌ An error occurred during the ingestion process:");
        console.error(error.message); // Log a cleaner error message
    }
}

ingestLore();