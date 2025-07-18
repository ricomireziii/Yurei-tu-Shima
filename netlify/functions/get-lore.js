// netlify/functions/get-lore.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Using service key for read access

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async function (event, context) {
    try {
        // Fetch all documents from the public lore table
        const { data, error } = await supabase
            .from('lore_documents')
            .select('title, content, image_url')
            .order('id', { ascending: true });

        if (error) {
            throw error;
        }
        
        // This function will eventually need to be more complex to group
        // entries by type (kinship, pantheon, etc.), but for now, 
        // this gets the data flowing.
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Error fetching lore:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch lore." }),
        };
    }
};