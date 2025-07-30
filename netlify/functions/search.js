import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize only the clients needed for searching
const supabaseClient = createSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export default async (req, context) => {
    try {
        const { searchQuery } = await req.json();
        if (!searchQuery) {
            throw new Error("Missing search query");
        }

        // Step 1: Convert the search query into an embedding
        const embeddingResult = await embeddingModel.embedContent(searchQuery);
        const queryEmbedding = embeddingResult.embedding.values;

        // Step 2: Use the embedding to search for relevant documents in Supabase
        const { data: documents, error: matchError } = await supabaseClient.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.75,
            match_count: 9,
        });

        if (matchError) {
            throw new Error(`Error matching documents: ${matchError.message}`);
        }

        // Step 3: Return the found documents as a JSON response
        return new Response(JSON.stringify({ documents }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in search function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};