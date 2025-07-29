import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient as createContentfulClient } from 'contentful';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Initialize all necessary clients
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
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


export default async (req, context) => {
    try {
        const { prompt, weaverName, selections } = await req.json();
        if (!prompt || !weaverName) {
            throw new Error("Missing prompt or weaver name");
        }
        
        const personalityEntries = await contentfulClient.getEntries({
            content_type: 'aiPersonality',
            'fields.weaverName': weaverName,
            limit: 1,
        });

        if (personalityEntries.items.length === 0) {
            throw new Error(`Personality for ${weaverName} not found.`);
        }
        const personality = personalityEntries.items[0].fields;
        const systemPrompt = personality.systemPrompt || '';
        let knowledgeBase = '';

        if (personality.knowsAllLore === true) {
            const searchQuery = selections ? Object.values(selections).join(' ') + ' Yurei-tu-Shima' : prompt;

            const embeddingResult = await embeddingModel.embedContent(searchQuery);
            const queryEmbedding = embeddingResult.embedding.values;

            const { data: documents, error: matchError } = await supabaseClient.rpc('match_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.75,
                match_count: 9,
            });

            if (matchError) {
                throw new Error(`Error matching documents: ${matchError.message}`);
            }

            knowledgeBase = "--- RELEVANT LORE ---\n" + documents.map(doc => doc.content).join('\n\n---\n\n');
        }
        
        const fullPrompt = `${systemPrompt}\n\n${knowledgeBase}\n\nUser Question: "${prompt}"`;
        
        const result = await generativeModel.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        return new Response(JSON.stringify({ text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in Gemini function:", error);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};