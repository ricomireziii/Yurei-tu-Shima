// netlify/functions/gemini.js

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize clients once
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// --- RAG Retrieval Function ---
async function retrieveRelevantLore(query) {
    try {
        // Create an embedding of the user's query
        const embeddingResult = await embeddingModel.embedContent({ content: { parts: [{ text: query }] } });
        const queryEmbedding = embeddingResult.embedding.values;

        // Query Supabase to find the most similar chunks
        const { data: documents, error } = await supabase.rpc('match_lore_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5, // Adjust this threshold as needed (0.7 is a good starting point)
            match_count: 5,       // Get the top 5 most relevant chunks
        });

        if (error) {
            console.error('Error querying Supabase for matches:', error);
            return ""; // Return empty context on error
        }

        // Format the retrieved chunks into a single context string
        return documents.map(doc => doc.content).join('\n\n---\n\n');
    } catch (e) {
        console.error("Error in retrieveRelevantLore:", e);
        return ""; // Return empty context on error
    }
}

// --- Prompt Building Function ---
function buildFinalPrompt(weaver, userInput, context) {
    const loreContext = `CONTEXT FROM LORE:\n"""\n${context}\n"""\n\n`;

    switch (weaver) {
        case 'Thread Weaver':
            return `${loreContext}You are Professor Thistlewhip Widdersnap III, a precise and knowledgeable archivist. Using ONLY the provided context, answer the user's question. If the context is insufficient, state that the information is not in your records.\n\nUSER QUESTION: "${userInput}"`;

        case 'Breath Weaver':
            return `${loreContext}You are the Breath Weaver. Using the provided context about the world's kinships and the user's request, generate a thematically consistent D&D character concept for the world of Yurei-tu-Shima. Provide a name, a short personality description, and a plot hook. Use <b> tags for headers.\n\nUSER REQUEST: "${userInput}"`;

        case 'Ink Weaver':
            return `${loreContext}You are the Ink Weaver, an expert image prompt engineer. Your task is to translate the user's concept into a detailed prompt for an AI image generator. Use the provided context to replace any specific lore terms with generic, descriptive phrases that an external image generator can understand. The output should be a single, comma-separated list of keywords focusing on a 'Studio Ghibli inspired, fantasy, anime concept art' style. Do not use any conversational text, only the prompt itself.\n\nUSER CONCEPT: "${userInput}"`;

        case 'Whisper Weaver':
            return `${loreContext}You are a Whisper-Spirit from the Wandering Veil. Do NOT answer the user's question directly. Instead, inspired by the provided context, give a short, poetic, and mysterious response. It should be a riddle, an omen, or a cryptic fragment of a forgotten story.\n\nUSER QUESTION: "${userInput}"`;
            
        default:
            // A fallback for the original functionality if no weaver is specified
            return userInput;
    }
}

// --- Main Handler ---
exports.handler = async function (event) {
    // Check for API keys on startup
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: Missing environment variables.'}) };
    }
    
    try {
        const { weaver, userInput } = JSON.parse(event.body);

        if (!userInput) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing userInput.' }) };
        }

        // If no weaver is specified, handle it as a simple prompt
        if (!weaver) {
            const result = await generativeModel.generateContent(userInput);
            const response = await result.response;
            const text = await response.text();
            return { statusCode: 200, body: JSON.stringify({ text }) };
        }

        // 1. Retrieve relevant lore from Supabase
        const context = await retrieveRelevantLore(userInput);

        // 2. Build the specific meta-prompt for the chosen Weaver
        const finalPrompt = buildFinalPrompt(weaver, userInput, context);

        // 3. Generate the response from Gemini
        const result = await generativeModel.generateContent(finalPrompt);
        const response = await result.response;
        const text = await response.text();

        return { statusCode: 200, body: JSON.stringify({ text }) };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `Function execution failed: ${error.message}` }) };
    }
};