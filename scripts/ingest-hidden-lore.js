// scripts/ingest-hidden-lore.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const HIDDEN_LORE_DOC_ID = '1QPPtvHyGdfo5rXT__HLFCH5SJ41LW8Fdp8lNqfpjI5Q'; // <-- PASTE YOUR HIDDEN DOC ID HERE
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'google-credentials.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 90;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function authorize() {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const scopes = ['https://www.googleapis.com/auth/documents.readonly'];
    const client = google.auth.fromJSON(keys);
    client.scopes = scopes;
    return client;
}

function chunkText(text) {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
}

async function ingestHiddenLore() {
    try {
        console.log('Starting HIDDEN lore ingestion...');

        const auth = await authorize();
        const docs = google.docs({ version: 'v1', auth });

        console.log('Reading hidden lore from Google Doc...');
        const docRes = await docs.documents.get({ documentId: HIDDEN_LORE_DOC_ID });
        let fullText = '';
        if (docRes.data.body?.content) {
            fullText = docRes.data.body.content.map(el => el.paragraph?.elements.map(e => e.textRun?.content || '').join('')).join('\n');
        }
        
        const chunks = chunkText(fullText);
        console.log(`Hidden lore split into ${chunks.length} chunks.`);

        if (chunks.length === 0) return console.log("No hidden chunks to process. Exiting.");
        
        console.log('Clearing existing hidden lore...');
        await supabase.from('hidden_lore_documents').delete().neq('id', 0);

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batchChunks = chunks.slice(i, i + BATCH_SIZE);
            console.log(`- Processing hidden batch ${Math.floor(i / BATCH_SIZE) + 1}`);

            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: batchChunks.map(chunk => ({ content: { parts: [{ text: chunk }] } })),
            });
            
            const documentsToInsert = batchChunks.map((chunk, index) => ({
                content: chunk,
                embedding: embeddingResult.embeddings[index].values,
            }));

            await supabase.from('hidden_lore_documents').insert(documentsToInsert);
        }

        console.log(`\n✅ Hidden lore ingestion complete!`);
    } catch (error) {
        console.error("\n❌ An error occurred during hidden lore ingestion:", error);
    }
}

ingestHiddenLore();