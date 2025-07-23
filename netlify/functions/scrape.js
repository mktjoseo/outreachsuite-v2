// Archivo: netlify/functions/scrape.js
const fetch = require('node-fetch');

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

exports.handler = async function(event) {
    if (!SCRAPER_API_KEY) {
        return { statusCode: 500, body: 'Server function error: SCRAPER_API_KEY is not configured.' };
    }

    const urlToScrape = event.queryStringParameters.url;
    if (!urlToScrape) {
        return { statusCode: 400, body: 'Error: URL parameter is missing.' };
    }

    // CORRECCIÓN DEFINITIVA: La URL que llega como parámetro ya está decodificada.
    // Debemos volver a codificarla para que la llamada a ScraperAPI sea válida.
    const renderJs = event.queryStringParameters.render === 'true';
    let apiUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(urlToScrape)}`;
    if (renderJs) {
        apiUrl += '&render=true';
    }

    try {
        const response = await fetch(apiUrl);
        const data = await response.text();

        if (!response.ok) {
            // Devuelve el status y el mensaje de error de la API de scraping
            return { statusCode: response.status, body: data };
        }
        return { statusCode: 200, body: data };

    } catch (error) {
        return { statusCode: 500, body: `Server function error: ${error.message}` };
    }
};