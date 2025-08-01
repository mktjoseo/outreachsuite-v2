// Archivo: netlify/functions/analyze-text.js
const fetch = require('node-fetch');
const { checkUsage } = require('./usage-helper');
const { createClient } = require('@supabase/supabase-js');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error: GEMINI_API_KEY is not configured.' }) };
    }

    // --- Autenticación y Control de Cuota ---
    const { authorization } = event.headers;
    if (!authorization) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        await checkUsage(user);
        
        // --- Lógica Original de la Función ---
        const { textContent, domain } = JSON.parse(event.body);
        if (!textContent) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No textContent provided.' }) };
        }

        const prompt = `
            Act as an expert SEO strategist. I have provided the content from the website "${domain}".
            Based on this content, perform two tasks and return the result as a single JSON object.
            1.  **Analyze Existing Strength**: Identify the 5 most important and specific keywords this website seems to be focused on. Call this list "existingKeywords".
            2.  **Identify Opportunities**: Suggest 7 new, related "long-tail" keywords that are excellent targets for a new content marketing campaign. Call this list "opportunityKeywords".
            Here is the content to analyze:
            ${textContent}
        `;

        const schema = {
            type: "OBJECT",
            properties: {
                existingKeywords: { type: "ARRAY", items: { type: "STRING" } },
                opportunityKeywords: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["existingKeywords", "opportunityKeywords"]
        };

        const geminiPayload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema },
        };
        
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!geminiResponse.ok) {
            const errorDetail = await geminiResponse.text();
            throw new Error(`Gemini API Error: ${errorDetail}`);
        }

        const geminiData = await geminiResponse.json();
        const resultText = geminiData.candidates[0].content.parts[0].text;
        const finalResult = JSON.parse(resultText);

        return { 
            statusCode: 200, 
            body: JSON.stringify(finalResult)
        };

    } catch (error) {
        if (error.message === 'QUOTA_EXCEEDED') {
            return {
                statusCode: 429,
                body: JSON.stringify({ error: 'Monthly quota exceeded.' })
            };
        }
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};