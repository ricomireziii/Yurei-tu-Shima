import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from 'contentful';
import { documentToPlainTextString } from '@contentful/rich-text-plain-text-renderer';

const contentfulClient = createClient({
    space: process.env.VITE_CONTENTFUL_SPACE_ID,
    accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN,
});

// UPDATED: This function now extracts all relevant details from a single portal.
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
                text += `- ${group.fields.groupName}: ${group.fields.options.join(', ')}\n`;
            }
        });
    }

    if (portal.fields.subCallingGroups && portal.fields.subCallingGroups.length > 0) {
        text += "Sub-Calling Groups:\n";
        portal.fields.subCallingGroups.forEach(group => {
            if(group?.fields) {
                text += `- ${group.fields.groupName}: ${group.fields.options.join(', ')}\n`;
            }
        });
    }

    if (portal.fields.conclusion) {
        text += `Conclusion: ${documentToPlainTextString(portal.fields.conclusion)}\n`;
    }

    if (portal.fields.isHidden) {
        text += `(Note: This is hidden lore, not on the public website)\n`;
    }
    return text;
}

// NEW: This function recursively gathers text from a portal and all its sub-portals.
function getAllPortalTextRecursive(portal, visitedIds = new Set()) {
    if (!portal || !portal.sys || !portal.fields || visitedIds.has(portal.sys.id)) {
        return '';
    }
    visitedIds.add(portal.sys.id);

    let combinedText = getPortalText(portal) + '\n---\n'; // Use a separator for clarity

    if (portal.fields.subPortals && portal.fields.subPortals.length > 0) {
        portal.fields.subPortals.forEach(subPortal => {
            if (subPortal && subPortal.sys && subPortal.fields) {
                 combinedText += getAllPortalTextRecursive(subPortal, visitedIds);
            }
        });
    }
    return combinedText;
}


export default async (req, context) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const { prompt, weaverName } = await req.json();
        if (!prompt || !weaverName) {
            throw new Error("Missing prompt or weaver name");
        }
        
        // CHANGED: Increased include depth to 10 for recursive lore fetching.
        const personalityEntries = await contentfulClient.getEntries({
            content_type: 'aiPersonality',
            'fields.weaverName': weaverName,
            limit: 1,
            include: 10 
        });

        if (personalityEntries.items.length === 0) {
            throw new Error(`Personality for ${weaverName} not found.`);
        }

        const personality = personalityEntries.items[0].fields;
        const systemPrompt = personality.systemPrompt || '';
        let knowledgeBase = '';

        const visitedIds = new Set();
        
        if (personality.knowsAllLore === true) {
            knowledgeBase += "--- COMPLETE KNOWLEDGE BASE (Public and Hidden Lore) ---\n";
            const allPortals = await contentfulClient.getEntries({
                content_type: 'lore',
                limit: 1000,
                include: 10
            });
            if (allPortals.items.length > 0) {
                allPortals.items.forEach(portal => {
                    // Uses the new comprehensive extractor for each portal.
                    knowledgeBase += getPortalText(portal) + '\n---\n';
                });
            }
        } else {
            // CHANGED: Logic now uses the recursive function for linked portals.
            if (personality.coreKnowledgePortals && personality.coreKnowledgePortals.length > 0) {
                knowledgeBase += "--- CORE KNOWLEDGE (Answer with confidence as facts) ---\n";
                personality.coreKnowledgePortals.forEach(portal => {
                    knowledgeBase += getAllPortalTextRecursive(portal, visitedIds);
                });
            }
            if (personality.hiddenLorePortals && personality.hiddenLorePortals.length > 0) {
                knowledgeBase += "\n--- HIDDEN LORE (Secret information not on the website) ---\n";
                personality.hiddenLorePortals.forEach(portal => {
                    knowledgeBase += getAllPortalTextRecursive(portal, visitedIds);
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