import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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