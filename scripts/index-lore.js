// updated: index-lore.js
import { createClient as createContentfulClient } from 'contentful';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { documentToPlainTextString } from '@contentful/rich-text-plain-text-renderer';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Clients
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

// This comprehensive function extracts all relevant details from a single portal.
function getPortalText(portal) {
    if (!portal || !portal.fields) return '';
    let text = `Title: ${portal.fields.title}\n`;

    if (portal.fields.introduction) {
        text += `Introduction: ${documentToPlainTextString(portal.fields.introduction)}\n`;
    }

    if (portal.fields.portalImage?.fields) {
        const imgTitle = portal.fields.portalImage.fields.title || '';
        const imgDesc = portal.fields.portalImage.fields.description || '';
        if (imgTitle || imgDesc) {
            text += `Image Description: ${imgTitle}${imgTitle && imgDesc ? ' - ' : ''}${imgDesc}\n`;
        }
    }
    
    if (portal.fields.subKinshipGroups && portal.fields.subKinshipGroups.length > 0) {
        text += "Sub-Kinship Groups:\n";
        portal.fields.subKinshipGroups.forEach(group => {
            if(group?.fields) {
                const optionsText = Array.isArray(group.fields.options) ? group.fields.options.join(', ') : '';
                text += `- ${group.fields.groupName}: ${optionsText}\n`;
            }
        });
    }

    if (portal.fields.subCallingGroups && portal.fields.subCallingGroups.length > 0) {
        text += "Sub-Calling Groups:\n";
        portal.fields.subCallingGroups.forEach(group => {
            if(group?.fields) {
                const optionsText = Array.isArray(group.fields.options) ? group.fields.options.join(', ') : '';
                text += `- ${group.fields.groupName}: ${optionsText}\n`;
            }
        });
    }

    if (portal.fields.conclusion) {
        text += `Conclusion: ${documentToPlainTextString(portal.fields.conclusion)}\n`;
    }
    return text;
}

// Function to break down large texts into smaller, overlapping chunks
function chunkText(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    if (!text) return chunks;
    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

async function main() {
    console.log("Starting lore indexing process...");

    console.log("Clearing existing documents from Supabase...");
    const { error: deleteError } = await supabaseClient.from('documents').delete().neq('id', 0);
    if (deleteError) {
        console.error("Error clearing documents:", deleteError);
        return;
    }
    console.log("Existing documents cleared.");

    console.log("Fetching all lore entries from Contentful...");
    const allPortals = await contentfulClient.getEntries({
        content_type: 'lore',
        limit: 1000,
        include: 10,
    });
    console.log(`Found ${allPortals.items.length} portal entries.`);

    const documentsToInsert = [];

    for (const portal of allPortals.items) {
        const portalText = getPortalText(portal);
        const textChunks = chunkText(portalText);
        
        // **NEW**: Add metadata to each chunk
        const portalMetadata = {
            source: portal.fields.title || 'Untitled Document'
        };

        for (const chunk of textChunks) {
            documentsToInsert.push({ 
                content: chunk,
                metadata: portalMetadata 
            });
        }
    }
    console.log(`Created ${documentsToInsert.length} text chunks to be embedded.`);

    // Generate embeddings and insert into Supabase in batches
    const batchSize = 50;
    for (let i = 0; i < documentsToInsert.length; i += batchSize) {
        const batch = documentsToInsert.slice(i, i + batchSize);
        const contentBatch = batch.map(doc => doc.content);
        
        console.log(`Generating embeddings for batch ${Math.floor(i / batchSize) + 1}...`);
        try {
            const result = await embeddingModel.batchEmbedContents({
                requests: contentBatch.map(text => ({ model: "models/text-embedding-004", content: { parts: [{ text }] } })),
            });

            const embeddings = result.embeddings;
            if (embeddings.length !== batch.length) {
                console.error(`Mismatch in batch size and embeddings returned. Batch: ${batch.length}, Embeddings: ${embeddings.length}`);
                continue;
            }

            for (let j = 0; j < embeddings.length; j++) {
                // Ensure embedding is attached to the correct object in the batch
                const doc = batch[j];
                doc.embedding = embeddings[j].values;
            }

            console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} into Supabase...`);
            const { error } = await supabaseClient.from('documents').insert(batch);
            if (error) {
                console.error("Error inserting batch:", error);
            }
        } catch (e) {
            console.error("Error generating embeddings for batch:", e);
        }
    }

    console.log("Lore indexing process completed successfully!");
}

main();