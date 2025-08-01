// Archivo: netlify/functions/fetch-content.js
const fetch = require('node-fetch');
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

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
    
    try {
        const { projectUrl, render } = JSON.parse(event.body);
        if (!projectUrl) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No projectUrl provided.' }) };
        }

        let scrapeUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(projectUrl)}`;
        if (render) {
            scrapeUrl += '&render=true';
        }

        const scrapeResponse = await fetch(scrapeUrl);
        if (!scrapeResponse.ok) {
            throw new Error(`Scraping failed with status ${scrapeResponse.status}. The site may be protected or invalid.`);
        }

        const htmlContent = await scrapeResponse.text();
        const textContent = cleanAndTruncateHtml(htmlContent);

        if (!textContent || textContent.length < 100) {
            throw new Error('Could not extract any meaningful text from the URL.');
        }

        return { 
            statusCode: 200, 
            body: JSON.stringify({ textContent: textContent, characters: textContent.length }) 
        };

    } catch (error) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};