// Archivo: functions/test-fetch.js
const fetch = require('node-fetch');

exports.handler = async function(event) {
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
        console.error("ERROR CRÍTICO: La variable SERPER_API_KEY no está llegando a la función.");
        return { statusCode: 500, body: "Error de configuración del servidor: SERPER_API_KEY no encontrada." };
    }

    console.log("--- INICIANDO test-fetch.js ---");
    console.log("Intentando llamar a la API de Serper con una consulta simple...");

    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: "capital of poland" }) // Una consulta simple y fija
        });

        console.log(`Respuesta de Serper recibida con status: ${response.status}`);
        const responseBody = await response.text();
        console.log("Cuerpo de la respuesta de Serper:", responseBody);

        if (!response.ok) {
            throw new Error(`La API de Serper falló con status ${response.status}`);
        }

        console.log("--- test-fetch.js completado con ÉXITO ---");
        return {
            statusCode: 200,
            body: `ÉXITO. Serper respondió: ${responseBody}`
        };

    } catch (error) {
        console.error("!!! ERROR DURANTE EL FETCH !!!", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};