// scripts/ingest-public-lore.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs').promises;
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const PUBLIC_LORE_DOC_ID = '1ib-2MGBDQih86JwrwiOGUGn8V7BL-O81gVG5ld43NMQ';
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'google-credentials.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 50;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function authorize() {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const client = google.auth.fromJSON(keys);
    client.scopes = ['https://www.googleapis.com/auth/documents.readonly'];
    return client;
}

async function parseDocContent(doc) {
    if (!doc?.body?.content) return [];

    const entries = [];
    let currentCategory = 'Uncategorized';
    let currentEntry = null;

    const commitCurrentEntry = () => {
        if (currentEntry) entries.push(currentEntry);
    };

    for (const element of doc.body.content) {
        if (!element.paragraph) continue;

        const style = element.paragraph.paragraphStyle?.namedStyleType;
        const text = (element.paragraph.elements.map(e => e.textRun?.content || '').join('')).trim();
        if (!text) continue;

        if (style === 'HEADING_1') {
            commitCurrentEntry();
            currentCategory = text;
            currentEntry = null;

            // **THE FIX IS HERE**
            // If this H1 is The Weaver's Loom, create a special entry for it.
            if (currentCategory.toLowerCase().includes("the weaver's loom")) {
                 entries.push({
                    title: "The Weaver's Loom",
                    content: "The gateway to the four weavers.",
                    imageUrl: null, // No image needed
                    category: "The Weaver's Loom" // Self-categorized
                 });
            }
            continue;
        }

        if (style === 'HEADING_2') {
            commitCurrentEntry();
            currentEntry = {
                title: text,
                content: '',
                imageUrl: null,
                category: currentCategory
            };
            // Check for image on the same line as the H2
            for (const el of element.paragraph.elements) {
                if (el.inlineObjectElement) {
                    const objectId = el.inlineObjectElement.inlineObjectId;
                    const imageUri = doc.inlineObjects?.[objectId]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                    if (imageUri) currentEntry.imageUrl = imageUri;
                }
            }
            continue;
        }
        
        if (currentEntry) {
            const htmlContent = element.paragraph.elements.map(e => e.textRun?.content || '').join('');
            if (style === 'HEADING_3') currentEntry.content += `<h3>${htmlContent}</h3>`;
            else if (style === 'HEADING_4') currentEntry.content += `<h4>${htmlContent}</h4>`;
            else currentEntry.content += `<p>${htmlContent}</p>`;
            
            if (!currentEntry.imageUrl) {
                 for (const el of element.paragraph.elements) {
                     if (el.inlineObjectElement) {
                        const objectId = el.inlineObjectElement.inlineObjectId;
                        const imageUri = doc.inlineObjects?.[objectId]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                        if (imageUri) currentEntry.imageUrl = imageUri;
                    }
                }
            }
        }
    }
    commitCurrentEntry();
    return entries;
}

async function ingestPublicLore() {
    try {
        console.log('Starting PUBLIC lore ingestion...');
        const auth = await authorize();
        const docs = google.docs({ version: 'v1', auth });
        const docRes = await docs.documents.get({ documentId: PUBLIC_LORE_DOC_ID });
        const parsedEntries = await parseDocContent(docRes.data);
        
        console.log(`Parsed into ${parsedEntries.length} public lore documents.`);
        if (parsedEntries.length === 0) return console.log("No entries found to process.");
        
        console.log('Clearing existing public lore from the database...');
        await supabase.from('lore_documents').delete().neq('id', 0);
        
        for (let i = 0; i < parsedEntries.length; i += BATCH_SIZE) {
            const batch = parsedEntries.slice(i, i + BATCH_SIZE);
            console.log(`- Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            
            const embeddingContent = batch.map(item => `${item.title}\n\n${item.content.replace(/<[^>]*>?/gm, '')}`);
            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: embeddingContent.map(text => ({ content: { parts: [{ text }] } })),
            });
            const documentsToInsert = batch.map((item, index) => ({
                content: item.content,
                embedding: embeddingResult.embeddings[index].values,
                image_url: item.imageUrl,
                title: item.title,
                category: item.category,
            }));
            const { error: insertError } = await supabase.from('lore_documents').insert(documentsToInsert);
            if (insertError) throw insertError;
        }
        console.log(`\n✅ Public lore ingestion complete!`);
    } catch (error) {
        console.error("\n❌ An error occurred during public lore ingestion:", error);
    }
}

ingestPublicLore();