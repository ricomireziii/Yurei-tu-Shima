// netlify/functions/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async function (event, context) {
    // 1. Check if the API key is loaded correctly from Netlify's environment
    if (!process.env.GEMINI_API_KEY) {
        const errorMessage = "Server configuration error: GEMINI_API_KEY is not set.";
        console.error(errorMessage);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMessage }),
        };
    }

    try {
        // 2. Attempt to parse the incoming request
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Prompt is required in the request body.' }),
            };
        }

        // 3. Initialize the Google AI client
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // 4. Make the actual API call
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();

        // 5. Return the successful response
        return {
            statusCode: 200,
            body: JSON.stringify({ text }),
        };

    } catch (error) {
        // 6. If any step above fails, log the detailed error and return it
        console.error('Detailed error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Function execution failed: ${error.message}` }),
        };
    }
};