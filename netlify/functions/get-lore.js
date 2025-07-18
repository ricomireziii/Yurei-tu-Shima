// netlify/functions/get-lore.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// We use the public ANONYMOUS key for safe, read-only access
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async function (event, context) {
    try {
        const { data, error } = await supabase
            .from('lore_documents')
            .select('title, content, image_url, category')
            .order('id', { ascending: true });

        if (error) {
            throw error;
        }
        
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