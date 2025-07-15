// netlify/functions/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async function (event, context) {
    // Get the API key from Netlify's environment variables
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();

        return { statusCode: 200, body: JSON.stringify({ text }) };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to call Gemini API' }) };
    }
};