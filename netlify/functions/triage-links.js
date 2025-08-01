// Archivo: netlify/functions/triage-links.js
const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error: GEMINI_API_KEY is not configured.' }) };
    }

    try {
        const { urls, language } = JSON.parse(event.body);
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Error: "urls" array parameter is missing or empty.' }) };
        }

        // --- LÓGICA MULTILINGÜE ---
        const languageKeywords = {
            'en': ['contact', 'about', 'team', 'impressum'],
            'es': ['contacto', 'acerca', 'nosotros', 'quienes-somos', 'aviso-legal'],
            'pl': ['kontakt', 'o-nas', 'zespol'],
            'it': ['contatti', 'chi-siamo', 'team'],
            'de': ['kontakt', 'uber-uns', 'impressum', 'team'],
            'fr': ['contact', 'a-propos', 'equipe', 'mentions-legales']
        };
        const keywords = languageKeywords[language] || languageKeywords['en']; // Default to English if language not found

        const prompt = `
            From the following list of URLs, which 2 are the most likely to contain direct contact information like an email address or a contact form?
            Prioritize URLs containing words like '${keywords.join("', '")}'.
            Return ONLY a JSON object that strictly follows the provided schema, containing an array of the top 2 most promising URLs. If the list has 2 or fewer URLs, return them all.

            List of URLs to analyze:
            ${JSON.stringify(urls)}
        `;

        const schema = {
            type: "OBJECT",
            properties: {
                selectedUrls: {
                    type: "ARRAY",
                    description: "An array of the most promising URLs for finding contact information.",
                    items: { type: "STRING" }
                }
            },
            required: ["selectedUrls"]
        };

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            throw new Error(`Gemini API Error: ${errorDetail}`);
        }

        const data = await response.json();

        if (data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0]) {
            const resultText = data.candidates[0].content.parts[0].text;
            return { statusCode: 200, body: resultText };
        } else {
             throw new Error("Received an invalid response structure from Gemini API.");
        }
    } catch (error) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: `Server function error: ${error.message}` })
        };
    }
};