const axios = require('axios');
const { checkUsage } = require('./usage-helper');
const { createClient } = require('@supabase/supabase-js');

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async function(event) {
    if (!SCRAPER_API_KEY) {
        return { statusCode: 500, body: 'Server function error: SCRAPER_API_KEY is not configured.' };
    }

    const { authorization } = event.headers;
    if (!authorization) return { statusCode: 401, body: 'Unauthorized' };
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) return { statusCode: 401, body: 'Unauthorized' };
    
    try {
        await checkUsage(user);
        
        const urlToScrape = event.queryStringParameters.url;
        if (!urlToScrape) {
            return { statusCode: 400, body: 'Error: URL parameter is missing.' };
        }

        const renderJs = event.queryStringParameters.render === 'true';
        let apiUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(urlToScrape)}`;
        if (renderJs) {
            apiUrl += '&render=true';
        }
        
        const response = await axios.get(apiUrl);
        return { statusCode: 200, body: response.data };

    } catch (error) {
        if (error.response) {
            return { statusCode: error.response.status, body: error.response.data };
        }
        if (error.message === 'QUOTA_EXCEEDED') {
            return { statusCode: 429, body: 'Monthly quota exceeded.' };
        }
        return { statusCode: 500, body: `Server function error: ${error.message}` };
    }
};