// Archivo: netlify/functions/generate-keywords.js
const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

function cleanAndTruncateHtml(html, maxLength = 20000) {
    if (!html) return '';
    let text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text.substring(0, maxLength);
}

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!GEMINI_API_KEY || !SCRAPER_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error: API keys are not configured.', log: ['[ERROR] API keys not found.'] }) };
    }
    
    const diagnosticsLog = [];

    try {
        // CAMBIO: Ahora también leemos la opción 'render' que nos envía el frontend.
        const { projectUrl, render } = JSON.parse(event.body);
        if (!projectUrl) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No projectUrl provided.', log: ['[ERROR] projectUrl not found in request.'] }) };
        }

        const domain = new URL(projectUrl).hostname;
        diagnosticsLog.push(`[INFO] Starting keyword analysis for: ${domain}`);

        // CAMBIO: Construimos la URL de ScraperAPI dinámicamente.
        let scrapeUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(projectUrl)}`;
        if (render) {
            scrapeUrl += '&render=true';
            diagnosticsLog.push(`[INFO] JavaScript rendering has been enabled for this scrape.`);
        }

        diagnosticsLog.push(`[INFO] Fetching content via ScraperAPI...`);
        const scrapeResponse = await fetch(scrapeUrl);
        
        if (!scrapeResponse.ok) {
            diagnosticsLog.push(`[ERROR] ScraperAPI failed with status: ${scrapeResponse.status}.`);
            throw new Error(`Scraping failed. The site may be protected or the URL is invalid.`);
        }

        const htmlContent = await scrapeResponse.text();
        diagnosticsLog.push(`[SUCCESS] ScraperAPI returned content. Cleaning HTML...`);

        const textContent = cleanAndTruncateHtml(htmlContent);
        
        if (!textContent || textContent.length < 100) {
            diagnosticsLog.push(`[WARN] Extracted text content is very short (${textContent.length} chars). Results may be poor.`);
            if (textContent.length === 0) {
                 throw new Error('Could not extract any meaningful text from the URL. The page might be empty or rendered with JavaScript.');
            }
        }
        diagnosticsLog.push(`[SUCCESS] Content cleaned. Sending to Gemini for analysis...`);

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
            diagnosticsLog.push(`[ERROR] Gemini API failed. Status: ${geminiResponse.status}`);
            throw new Error(`Gemini API Error: ${errorDetail}`);
        }

        const geminiData = await geminiResponse.json();
        const resultText = geminiData.candidates[0].content.parts[0].text;
        const finalResult = JSON.parse(resultText);

        diagnosticsLog.push(`[SUCCESS] Gemini analysis complete. Keywords generated!`);
        
        return { 
            statusCode: 200, 
            body: JSON.stringify({
                ...finalResult,
                log: diagnosticsLog
            }) 
        };

    } catch (error) {
        diagnosticsLog.push(`[FATAL] ${error.message}`);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: error.message,
                log: diagnosticsLog 
            }) 
        };
    }
};