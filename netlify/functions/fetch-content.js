const axios = require('axios');
const { checkUsage } = require('./usage-helper');
const { createClient } = require('@supabase/supabase-js');

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function cleanAndTruncateHtml(html, maxLength = 25000) {
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
    if (!SCRAPER_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error: SCRAPER_API_KEY is not configured.' }) };
    }
    
    const { authorization } = event.headers;
    if (!authorization) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        await checkUsage(user);

        const { projectUrl, render } = JSON.parse(event.body);
        if (!projectUrl) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No projectUrl provided.' }) };
        }

        let scrapeUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(projectUrl)}`;
        if (render) {
            scrapeUrl += '&render=true';
        }

        const scrapeResponse = await axios.get(scrapeUrl);
        const htmlContent = scrapeResponse.data;
        const textContent = cleanAndTruncateHtml(htmlContent);

        if (!textContent || textContent.length < 100) {
            throw new Error('Could not extract any meaningful text from the URL.');
        }

        return { 
            statusCode: 200, 
            body: JSON.stringify({ textContent: textContent, characters: textContent.length }) 
        };

    } catch (error) {
        const errorMessage = error.response ? `Scraping failed with status ${error.response.status}` : error.message;
        if (error.message === 'QUOTA_EXCEEDED') {
            return { statusCode: 429, body: JSON.stringify({ error: 'Monthly quota exceeded.' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: errorMessage }) };
    }
};