// This is the content for netlify/functions/gemini.js

// Using the official Google Generative AI SDK for Node.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from 'contentful';

// Initialize the Contentful client to fetch AI personalities
const contentfulClient = createClient({
    space: process.env.VITE_CONTENTFUL_SPACE_ID,
    accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN,
});

export default async (req, context) => {
    try {
        // Get the Google API key from the secure environment variables
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Get the user's prompt and the requested weaver from the front-end request
        const { prompt, weaverName } = await req.json();

        if (!prompt || !weaverName) {
            return new Response(JSON.stringify({ error: "Missing prompt or weaver name" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Fetch the correct AI personality from Contentful
        const personalityEntries = await contentfulClient.getEntries({
            content_type: 'aiPersonality',
            'fields.weaverName': weaverName,
            limit: 1
        });

        if (personalityEntries.items.length === 0) {
            return new Response(JSON.stringify({ error: `Personality for ${weaverName} not found.` }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const systemPrompt = personalityEntries.items[0].fields.systemPrompt;
        
        // Construct the full prompt with the system instructions
        const fullPrompt = `${systemPrompt}\n\nUser Question: "${prompt}"`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        return new Response(JSON.stringify({ text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in Gemini function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};