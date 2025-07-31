// new file: /api/ask-weaver.js
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize clients
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
        const { query, systemPrompt, searchQueryOverride } = await req.json();

        if (!query) throw new Error("Missing query");
        if (!systemPrompt) throw new Error("Missing systemPrompt");

        // Use searchQueryOverride for the search if it exists, otherwise use the main query.
        // This allows the character generator to search for "Kinship X" while generating an answer for a much larger prompt.
        const textToEmbed = searchQueryOverride || query;

        // 1. Create an embedding of the search query
        const embeddingResult = await embeddingModel.embedContent(textToEmbed);
        const queryEmbedding = embeddingResult.embedding.values;

        // 2. Query Supabase for relevant lore documents
        const { data: documents, error: matchError } = await supabaseClient.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.75,
            match_count: 10,
        });

        if (matchError) throw new Error(`Error matching documents: ${matchError.message}`);
        
        // 3. Construct the knowledge base for the prompt
        const knowledgeBase = documents.map(doc => 
            `Source: ${doc.metadata?.source || 'General Lore'}\nContent: ${doc.content}`
        ).join('\n\n---\n\n');

        // 4. Construct the full prompt using the ORIGINAL query meant for generation
        const fullPrompt = `${systemPrompt}\n\n--- RELEVANT LORE ---\n${knowledgeBase}\n\nUser Question: "${query}"`;
        
        // 5. Call the generative model
        const result = await generativeModel.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        // 6. Return the final answer
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