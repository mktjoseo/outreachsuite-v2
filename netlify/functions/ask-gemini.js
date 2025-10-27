// Archivo: netlify/functions/ask-gemini.js
const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async function(event) {
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error: GEMINI_API_KEY is not configured.' }) };
    }

    const domain = event.queryStringParameters.domain;
    if (!domain) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Error: Domain parameter is missing.' }) };
    }

    const prompt = `
        Based on your training data, what is the most likely public contact email address for the website "${domain}"?
        The email should be a general contact address like "contact@", "info@", "press@", "support@", etc.
        If no likely email is found, the email field should be an empty string.
        Return ONLY a JSON object that strictly follows the provided schema.
    `;

    const schema = {
        type: "OBJECT",
        properties: {
            email: {
                type: "STRING",
                description: "The most likely contact email address for the domain, or an empty string if none is found."
            }
        },
        required: ["email"]
    };

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('You have exceeded your Gemini API free quota for today.');
            }
            const errorDetail = await response.text();
            throw new Error(`Gemini API Error: ${errorDetail}`);
        }

        const data = await response.json();

        if (data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0]) {
            const resultText = data.candidates[0].content.parts[0].text;
            return { statusCode: 200, body: resultText }; // Gemini already returns a valid JSON string here
        } else {
             throw new Error("Received an invalid response structure from Gemini API.");
        }
    } catch (error) {
        // CORRECCIÓN: Devolver siempre un objeto JSON en caso de error.
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: `Server function error: ${error.message}` })
        };
    }
};