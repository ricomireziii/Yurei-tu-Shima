// scripts/ingest-hidden-lore.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const HIDDEN_LORE_DOC_ID = '1QPPtvHyGdfo5rXT__HLFCH5SJ41LW8Fdp8lNqfpjI5Q';
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'google-credentials.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

/**
 * **REWRITTEN INGESTION LOGIC**
 * Ingests the entire document as one piece for better context.
 */
async function ingestHiddenLore() {
    try {
        console.log('Starting HIDDEN lore ingestion...');

        const auth = await authorize();
        const docs = google.docs({ version: 'v1', auth });

        console.log('Reading hidden lore from Google Doc...');
        const docRes = await docs.documents.get({ documentId: HIDDEN_LORE_DOC_ID });
        
        let fullText = '';
        if (docRes.data.body?.content) {
            // Join all text runs into a single string
            fullText = docRes.data.body.content.map(
                el => el.paragraph?.elements.map(
                    e => e.textRun?.content || ''
                ).join('')
            ).join('\n').trim();
        }
        
        if (fullText.length < 50) {
             return console.log("No substantial hidden lore content found. Exiting.");
        }
        console.log(`Hidden lore document is ${fullText.length} characters long.`);

        console.log('Clearing ALL existing hidden lore...');
        await supabase.from('hidden_lore_documents').delete().neq('id', 0);

        console.log('Generating embedding for the entire hidden lore document...');
        const embeddingResult = await embeddingModel.embedContent(fullText);
        
        const documentToInsert = {
            content: fullText,
            embedding: embeddingResult.embedding.values,
        };

        console.log('Inserting single hidden lore document into the database...');
        await supabase.from('hidden_lore_documents').insert(documentToInsert);

        console.log(`\n✅ Hidden lore ingestion complete!`);
    } catch (error) {
        console.error("\n❌ An error occurred during hidden lore ingestion:", error);
    }
}

ingestHiddenLore();