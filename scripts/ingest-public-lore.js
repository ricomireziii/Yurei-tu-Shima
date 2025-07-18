// scripts/ingest-public-lore.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs').promises;
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const PUBLIC_LORE_DOC_ID = '1ib-2MGBDQih86JwrwiOGUGn8V7BL-O81gVG5ld43NMQ'; // <-- PASTE YOUR PUBLIC DOC ID HERE
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'google-credentials.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 90;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function authorize() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        return google.auth.fromJSON(JSON.parse(content));
    } catch (e) {
        console.error("Error reading credentials file. Make sure 'google-credentials.json' is in your project root.", e);
        process.exit(1);
    }
}

function chunkText(text) {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
}

async function parseDocContent(doc) {
    if (!doc?.body?.content) return [];

    const entries = [];
    let currentCategory = 'Uncategorized';
    let currentEntry = null;

    for (const element of doc.body.content) {
        if (!element.paragraph) continue;

        const paragraphStyle = element.paragraph.paragraphStyle?.namedStyleType;
        if (paragraphStyle === 'TITLE' || paragraphStyle === 'SUBTITLE') continue;

        const isUnderlined = element.paragraph.elements.every(e => e.textRun?.textStyle?.underline);

        let textContent = '';
        for(const el of element.paragraph.elements) {
            textContent += el.textRun?.content || '';
        }
        textContent = textContent.trim();
        
        if (paragraphStyle === 'HEADING_1') {
            if (currentEntry) entries.push(currentEntry);
            currentCategory = textContent;
            currentEntry = null;
        } else if (paragraphStyle === 'HEADING_2') {
            if (currentEntry) entries.push(currentEntry);
            currentEntry = { title: textContent, text: '', imageUrl: null, category: currentCategory };
        } else if (currentEntry) {
            if (isUnderlined && textContent) {
                currentEntry.text += `<blockquote>${textContent}</blockquote>\n\n`;
            } else if (paragraphStyle === 'HEADING_3' && textContent) {
                currentEntry.text += `<h3>${textContent}</h3>\n`;
            } else if (paragraphStyle === 'HEADING_4' && textContent) {
                currentEntry.text += `<h4>${textContent}</h4>\n`;
            } else {
                currentEntry.text += textContent + '\n';
            }

            if (!currentEntry.imageUrl) {
                for (const el of element.paragraph.elements) {
                    if (el.inlineObjectElement) {
                        const objectId = el.inlineObjectElement.inlineObjectId;
                        const imageProps = doc.inlineObjects?.[objectId]?.inlineObjectProperties?.embeddedObject?.imageProperties;
                        if (imageProps?.contentUri) {
                            currentEntry.imageUrl = imageProps.contentUri;
                        }
                    }
                }
            }
        }
    }
    if (currentEntry) entries.push(currentEntry);
    
    const finalChunks = [];
    for (const entry of entries) {
        const textChunks = chunkText(entry.text);
        for (const contentChunk of textChunks) {
            finalChunks.push({
                content: `${entry.title}\n\n${contentChunk}`,
                image_url: entry.imageUrl,
                title: entry.title,
                category: entry.category,
            });
        }
    }
    return finalChunks;
}

async function ingestPublicLore() {
    try {
        console.log('Starting PUBLIC lore ingestion...');
        const auth = await authorize();
        const docs = google.docs({ version: 'v1', auth });

        console.log('Reading from Google Doc...');
        const docRes = await docs.documents.get({ documentId: PUBLIC_LORE_DOC_ID });
        
        const parsedChunks = await parseDocContent(docRes.data);
        console.log(`Parsed and chunked into ${parsedChunks.length} public lore documents.`);

        if (parsedChunks.length === 0) return console.log("No entries found to process. Exiting.");
        
        console.log('Clearing existing public lore from the database...');
        await supabase.from('lore_documents').delete().neq('id', 0);
        
        for (let i = 0; i < parsedChunks.length; i += BATCH_SIZE) {
            const batch = parsedChunks.slice(i, i + BATCH_SIZE);
            console.log(`- Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            
            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: batch.map(item => ({ content: { parts: [{ text: item.content }] } })),
            });

            const documentsToInsert = batch.map((item, index) => ({
                content: item.content,
                embedding: embeddingResult.embeddings[index].values,
                image_url: item.image_url,
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