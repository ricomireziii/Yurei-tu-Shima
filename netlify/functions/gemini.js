import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from 'contentful';
import { documentToPlainTextString } from '@contentful/rich-text-plain-text-renderer';

const contentfulClient = createClient({
    space: process.env.VITE_CONTENTFUL_SPACE_ID,
    accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN,
});

function getPortalText(portal) {
    if (!portal || !portal.fields) return '';
    let text = `Title: ${portal.fields.title}\n`;
    if (portal.fields.introduction) {
        text += `Introduction: ${documentToPlainTextString(portal.fields.introduction)}\n`;
    }
    if (portal.fields.conclusion) {
        text += `Conclusion: ${documentToPlainTextString(portal.fields.conclusion)}\n`;
    }
    // Include hidden status in the knowledge base for context
    if (portal.fields.isHidden) {
        text += `(Note: This is hidden lore, not on the public website)\n`;
    }
    return text;
}

export default async (req, context) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const { prompt, weaverName } = await req.json();
        if (!prompt || !weaverName) {
            throw new Error("Missing prompt or weaver name");
        }
        
        const personalityEntries = await contentfulClient.getEntries({
            content_type: 'aiPersonality',
            'fields.weaverName': weaverName,
            limit: 1,
            include: 2 
        });

        if (personalityEntries.items.length === 0) {
            throw new Error(`Personality for ${weaverName} not found.`);
        }

        const personality = personalityEntries.items[0].fields;
        const systemPrompt = personality.systemPrompt || '';
        let knowledgeBase = '';

        // ** THIS IS THE NEW LOGIC **
        if (personality.knowsAllLore === true) {
            // If the switch is ON, fetch ALL portal entries
            knowledgeBase += "--- COMPLETE KNOWLEDGE BASE (Public and Hidden Lore) ---\n";
            const allPortals = await contentfulClient.getEntries({
                content_type: 'lore', // Use your portal's content type ID
                limit: 1000 // Fetch up to 1000 entries
            });
            if (allPortals.items.length > 0) {
                allPortals.items.forEach(portal => {
                    knowledgeBase += getPortalText(portal) + '\n';
                });
            }
        } else {
            // If the switch is OFF, use the existing logic for linked portals
            if (personality.coreKnowledgePortals && personality.coreKnowledgePortals.length > 0) {
                knowledgeBase += "--- CORE KNOWLEDGE (Answer with confidence as facts) ---\n";
                personality.coreKnowledgePortals.forEach(portal => {
                    knowledgeBase += getPortalText(portal) + '\n';
                });
            }
            if (personality.hiddenLorePortals && personality.hiddenLorePortals.length > 0) {
                knowledgeBase += "\n--- HIDDEN LORE (Secret information not on the website) ---\n";
                personality.hiddenLorePortals.forEach(portal => {
                    knowledgeBase += getPortalText(portal) + '\n';
                });
            }
        }
        
        const fullPrompt = `${systemPrompt}\n\n${knowledgeBase}\n\nUser Question: "${prompt}"`;
        
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