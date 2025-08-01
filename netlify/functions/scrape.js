// Archivo: netlify/functions/scrape.js
const fetch = require('node-fetch');
const { checkUsage } = require('./usage-helper');
const { createClient } = require('@supabase/supabase-js');

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async function(event) {
    if (!SCRAPER_API_KEY) {
        return { statusCode: 500, body: 'Server function error: SCRAPER_API_KEY is not configured.' };
    }

    // --- Autenticación y Control de Cuota ---
    const { authorization } = event.headers;
    if (!authorization) return { statusCode: 401, body: 'Unauthorized' };
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) return { statusCode: 401, body: 'Unauthorized' };
    
    try {
        await checkUsage(user);
        
        // --- Lógica Original de la Función ---
        const urlToScrape = event.queryStringParameters.url;
        if (!urlToScrape) {
            return { statusCode: 400, body: 'Error: URL parameter is missing.' };
        }

        const renderJs = event.queryStringParameters.render === 'true';
        let apiUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(urlToScrape)}`;
        if (renderJs) {
            apiUrl += '&render=true';
        }
        
        const response = await fetch(apiUrl);
        const data = await response.text();

        if (!response.ok) {
            return { statusCode: response.status, body: data };
        }
        return { statusCode: 200, body: data };

    } catch (error) {
        if (error.message === 'QUOTA_EXCEEDED') {
            return { statusCode: 429, body: 'Monthly quota exceeded.' };
        }
        return { statusCode: 500, body: `Server function error: ${error.message}` };
    }
};