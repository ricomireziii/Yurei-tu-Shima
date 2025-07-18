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
const BATCH_SIZE = 50; // Smaller batch size for larger content

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
 * **REWRITTEN PARSING LOGIC**
 * This function now correctly structures the document.
 */
async function parseDocContent(doc) {
    if (!doc?.body?.content) return [];

    const entries = [];
    let currentCategory = 'Uncategorized';
    let currentEntry = null;

    // Helper to commit the current entry to the list
    const commitCurrentEntry = () => {
        if (currentEntry) {
            entries.push(currentEntry);
        }
    };

    for (const element of doc.body.content) {
        if (!element.paragraph) continue;

        const paragraphStyle = element.paragraph.paragraphStyle?.namedStyleType;
        const textContent = (element.paragraph.elements.map(e => e.textRun?.content || '').join('')).trim();

        if (paragraphStyle === 'TITLE' || paragraphStyle === 'SUBTITLE' || !textContent) continue;

        if (paragraphStyle === 'HEADING_1') {
            commitCurrentEntry(); // Save the previous entry before starting a new category
            currentCategory = textContent;
            currentEntry = null; // Reset entry for the new category
        } else if (paragraphStyle === 'HEADING_2') {
            commitCurrentEntry(); // Save the previous entry
            // Start a new entry for the H2
            currentEntry = {
                title: textContent,
                content: '', // Content will be built from subsequent elements
                imageUrl: null,
                category: currentCategory,
            };
        } else if (currentEntry) {
            // Append content to the current entry
            let fullLineHtml = '';
            for (const el of element.paragraph.elements) {
                if(el.textRun) {
                    fullLineHtml += el.textRun.content;
                }
            }

            if(paragraphStyle === 'HEADING_3') {
                 currentEntry.content += `<h3>${fullLineHtml}</h3>\n`;
            } else if (paragraphStyle === 'HEADING_4') {
                 currentEntry.content += `<h4>${fullLineHtml}</h4>\n`;
            } else {
                 currentEntry.content += `<p>${fullLineHtml}</p>\n`;
            }

            // Find an image for the current entry if it doesn't have one
            if (!currentEntry.imageUrl) {
                 for (const el of element.paragraph.elements) {
                    if (el.inlineObjectElement) {
                        const objectId = el.inlineObjectElement.inlineObjectId;
                        const imageUri = doc.inlineObjects?.[objectId]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                        if (imageUri) {
                            currentEntry.imageUrl = imageUri;
                        }
                    }
                }
            }
        }
    }
    commitCurrentEntry(); // Add the last entry
    
    return entries;
}


async function ingestPublicLore() {
    try {
        console.log('Starting PUBLIC lore ingestion...');
        const auth = await authorize();
        const docs = google.docs({ version: 'v1', auth });

        console.log('Reading from Google Doc...');
        const docRes = await docs.documents.get({ documentId: PUBLIC_LORE_DOC_ID });
        
        const parsedEntries = await parseDocContent(docRes.data);
        console.log(`Parsed into ${parsedEntries.length} public lore documents.`);

        if (parsedEntries.length === 0) return console.log("No entries found to process. Please check Heading styles (H1, H2) in your Google Doc.");
        
        console.log('Clearing existing public lore from the database...');
        await supabase.from('lore_documents').delete().neq('id', 0);
        
        for (let i = 0; i < parsedEntries.length; i += BATCH_SIZE) {
            const batch = parsedEntries.slice(i, i + BATCH_SIZE);
            console.log(`- Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(parsedEntries.length/BATCH_SIZE)}`);
            
            // Create a text representation for embedding (title + content)
            const embeddingContent = batch.map(item => `${item.title}\n\n${item.content.replace(/<[^>]*>?/gm, '')}`); // Strip HTML for embedding

            const embeddingResult = await embeddingModel.batchEmbedContents({
                requests: embeddingContent.map(text => ({ content: { parts: [{ text }] } })),
            });

            const documentsToInsert = batch.map((item, index) => ({
                content: item.content, // This keeps the HTML for the frontend
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