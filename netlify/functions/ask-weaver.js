// Updated file: netlify/functions/ask-weaver.js
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseClient = createSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const config = {
  path: "/api/ask-weaver",
};

export default async (req, context) => {
    try {
        const { query, systemPrompt, searchQueryOverride, chatHistory = [] } = await req.json();

        if (!query) throw new Error("Missing query");
        if (!systemPrompt) throw new Error("Missing systemPrompt");

        const textToEmbed = searchQueryOverride || query;
        const embeddingResult = await embeddingModel.embedContent(textToEmbed);
        const queryEmbedding = embeddingResult.embedding.values;

        const { data: documents, error: matchError } = await supabaseClient.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 8,
        });

        if (matchError) throw new Error(`Error matching documents: ${matchError.message}`);
        
        const knowledgeBase = documents.map(doc => 
            `Source: ${doc.metadata?.source || 'General Lore'}\nContent: ${doc.content}`
        ).join('\n\n---\n\n');
        
        // NEW: Format the chat history for the prompt
        const historyText = chatHistory.map(turn => `${turn.role}: ${turn.text}`).join('\n');

        const fullPrompt = `${systemPrompt}
--- CHAT HISTORY ---
${historyText}
--- RELEVANT LORE ---
${knowledgeBase}
--- NEW USER QUESTION ---
${query}`;
        
        const result = await generativeModel.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        return new Response(JSON.stringify({ text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in ask-weaver function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};