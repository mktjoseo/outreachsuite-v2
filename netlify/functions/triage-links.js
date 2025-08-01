const axios = require('axios');
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

    const { authorization } = event.headers;
    if (!authorization) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    
    try {
        await checkUsage(user);

        const { urls, language } = JSON.parse(event.body);
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Error: "urls" array parameter is missing or empty.' }) };
        }

        const languageKeywords = {
            'en': ['contact', 'about', 'team', 'impressum'],
            'es': ['contacto', 'acerca', 'nosotros', 'quienes-somos', 'aviso-legal'],
            'pl': ['kontakt', 'o-nas', 'zespol'],
            'it': ['contatti', 'chi-siamo', 'team'],
            'de': ['kontakt', 'uber-uns', 'impressum', 'team'],
            'fr': ['contact', 'a-propos', 'equipe', 'mentions-legales']
        };
        const keywords = languageKeywords[language] || languageKeywords['en'];

        const prompt = `
            From the following list of URLs, which 2 are the most likely to contain direct contact information?
            Prioritize URLs containing words like '${keywords.join("', '")}'.
            Return ONLY a JSON object that strictly follows the provided schema.
            List of URLs to analyze: ${JSON.stringify(urls)}
        `;

        const schema = { type: "OBJECT", properties: { selectedUrls: { type: "ARRAY", items: { type: "STRING" } } }, required: ["selectedUrls"] };
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        const response = await axios.post(apiUrl, payload, { headers: { 'Content-Type': 'application/json' } });
        
        // Gemini ya devuelve un string JSON válido, así que lo pasamos directamente
        return { statusCode: 200, body: response.data.candidates[0].content.parts[0].text };
        
    } catch (error) {
        const errorMessage = error.response ? `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
        if (error.message === 'QUOTA_EXCEEDED') {
            return { statusCode: 429, body: JSON.stringify({ error: 'Monthly quota exceeded.' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: `Server function error: ${errorMessage}` }) };
    }
};