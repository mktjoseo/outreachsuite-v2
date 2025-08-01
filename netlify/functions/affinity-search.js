const axios = require('axios');
const { checkUsage } = require('./usage-helper');
const { createClient } = require('@supabase/supabase-js');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async function(event) {
    if (!GEMINI_API_KEY || !SERPER_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error: One or more API keys are not configured.' }) };
    }
    
    const { authorization } = event.headers;
    if (!authorization) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const diagnosticsLog = [];
    try {
        await checkUsage(user);

        const { keyword, country, language, searchType } = event.queryStringParameters;
        if (!keyword || !country || !language || !searchType) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Error: Missing required parameters.' }) };
        }

        let page = 1;
        if (searchType === 'established') page = 2;
        if (searchType === 'rising_stars') page = 4; 

        diagnosticsLog.push(`[INFO] Searching on Google for keyword: "${keyword}"...`);
        
        const serperResponse = await axios.post('https://google.serper.dev/search', 
            { q: keyword, gl: country.toLowerCase(), hl: language.toLowerCase(), page: page, num: 10 },
            { headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' } }
        );
        const organicResults = serperResponse.data.organic || [];
        
        if (organicResults.length === 0) {
            diagnosticsLog.push(`[WARN] No potential sites found via Google for "${keyword}".`);
            return { statusCode: 200, body: JSON.stringify({ directResults: [], log: diagnosticsLog }) };
        }
        
        diagnosticsLog.push(`[SUCCESS] Found ${organicResults.length} potential sites for "${keyword}". Preparing for analysis...`);
        const sitesToAnalyze = organicResults.map(res => ({ title: res.title, url: res.link, snippet: res.snippet }));

        const prompt = `
            As an SEO and outreach expert, analyze this list of websites found for the keyword "${keyword}".
            For each website in the provided JSON list, evaluate it and return a corresponding JSON object with the following keys:
            - "name": Use the provided title.
            - "url": Use the provided URL.
            - "description": Based on the title and snippet, write a one-sentence summary of the site's main purpose.
            - "reason": In one sentence, explain why this site could be a relevant match for the keyword "${keyword}".
            - "relevanceScore": An integer from 1 to 10 indicating how relevant the site is to the keyword. A news aggregator or a generic site should have a low score (1-4). A specialized blog directly on the topic should have a high score (7-10).
            - "category": Classify the site into one of the following three English categories: "Major Authority" (for massive sites like Wikipedia), "Specialist Media" (for blogs, magazines, or sites highly focused on the keyword's topic), or "Other" (for sites that don't fit the other categories).

            CRITICAL RULE: Your final output must only contain content-based websites, blogs, and digital magazines suitable for link building. Actively exclude results from:
            - Social media domains (linkedin.com, facebook.com, twitter.com, instagram.com, etc.).
            - Forums and community sites (reddit.com, quora.com, etc.).
            - Government domains (any URL ending in .gov).
            - User-generated content platforms like YouTube.

            Analyze the following list of sites:
            ${JSON.stringify(sitesToAnalyze, null, 2)}
        `;

        const schema = { type: "OBJECT", properties: { analyzedResults: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, url: { type: "STRING" }, description: { type: "STRING" }, reason: { type: "STRING" }, relevanceScore: { type: "NUMBER" }, category: { type: "STRING" } }, required: ["name", "url", "description", "reason", "relevanceScore", "category"] } } }, required: ["analyzedResults"] };
        const geminiPayload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
        
        diagnosticsLog.push(`[INFO] Sending list of ${sitesToAnalyze.length} sites to Gemini for batch analysis...`);
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        const geminiResponse = await axios.post(geminiApiUrl, geminiPayload, { headers: { 'Content-Type': 'application/json' } });
        const parsedResult = JSON.parse(geminiResponse.data.candidates[0].content.parts[0].text);

        const analyzedResults = parsedResult.analyzedResults || [];
        diagnosticsLog.push(`[SUCCESS] Analysis complete for "${keyword}". Found ${analyzedResults.length} valid media outlets.`);
        return { statusCode: 200, body: JSON.stringify({ directResults: analyzedResults, log: diagnosticsLog }) };

    } catch (error) {
        const errorMessage = error.response ? `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
        diagnosticsLog.push(`[FATAL ERROR] ${errorMessage}`);

        if (error.message === 'QUOTA_EXCEEDED') {
            return { statusCode: 429, body: JSON.stringify({ error: 'Monthly quota exceeded.' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: errorMessage, log: diagnosticsLog }) };
    }
};