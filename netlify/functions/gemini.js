// netlify/functions/gemini.js

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// --- RAG Retrieval Function ---
async function retrieveRelevantLore(query) {
    try {
        const embeddingResult = await embeddingModel.embedContent({ content: { parts: [{ text: query }] } });
        const queryEmbedding = embeddingResult.embedding.values;

        // Query both tables in parallel
        const [publicResult, hiddenResult] = await Promise.all([
            supabase.rpc('match_lore_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: 3,
            }),
            supabase.rpc('match_hidden_lore_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: 2,
            })
        ]);

        let context = "";
        if (publicResult.data && publicResult.data.length > 0) {
            context += "PUBLIC LORE:\n" + publicResult.data.map(doc => doc.content).join('\n\n---\n\n');
        }
        if (hiddenResult.data && hiddenResult.data.length > 0) {
            context += "\n\nHIDDEN LORE (SECRETS):\n" + hiddenResult.data.map(doc => doc.content).join('\n\n---\n\n');
        }
        
        return context.trim();
    } catch (e) {
        console.error("Error retrieving lore:", e);
        return "";
    }
}

// --- Prompt Building Function ---
function buildFinalPrompt(weaver, userInput, context) {
    const loreContext = `Use the following context to inform your answer. Public lore is common knowledge, while hidden lore is secret information you possess.\n\nCONTEXT:\n"""\n${context}\n"""\n\n`;

    switch (weaver) {
        case 'Thread Weaver':
            return `${loreContext}You are Professor Thistlewhip Widdersnap III, a precise and knowledgeable archivist. Using ONLY the provided context, answer the user's question. If the context is insufficient, state that the information is not in your records.\n\nUSER QUESTION: "${userInput}"`;
        case 'Breath Weaver':
            return `${loreContext}You are the Breath Weaver. Using the provided context, generate a D&D character concept for Yurei-tu-Shima. Provide a name, personality, and plot hook. Use <b> tags for headers.\n\nUSER REQUEST: "${userInput}"`;
        case 'Ink Weaver':
            return `${loreContext}You are the Ink Weaver. Translate the user's concept into a detailed prompt for an AI image generator. Use the context to replace lore terms with descriptive phrases. The output must be a single, comma-separated list of keywords in a 'Studio Ghibli inspired, fantasy, anime concept art' style.\n\nUSER CONCEPT: "${userInput}"`;
        case 'Whisper Weaver':
            return `${loreContext}You are a Whisper-Spirit. Do NOT answer directly. Inspired by the context, give a short, poetic, and mysterious response (a riddle, omen, or cryptic fragment).\n\nUSER QUESTION: "${userInput}"`;
        default:
            return userInput;
    }
}

// --- Main Handler ---
exports.handler = async function (event) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }
    
    try {
        const { weaver, userInput } = JSON.parse(event.body);
        if (!userInput) return { statusCode: 400, body: JSON.stringify({ error: 'Missing userInput.' }) };

        const context = await retrieveRelevantLore(userInput);
        const finalPrompt = buildFinalPrompt(weaver, userInput, context);
        
        const result = await generativeModel.generateContent(finalPrompt);
        const response = await result.response;
        const text = await response.text();

        return { statusCode: 200, body: JSON.stringify({ text }) };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `Function execution failed.` }) };
    }
};