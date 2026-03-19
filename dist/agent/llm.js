import { ENV } from '../config.js';
export async function generateResponse(messages, tools) {
    console.log(`[LLM] Attempting request to Ollama (Llama)...`);
    // Endpoint local de Ollama compatible con OpenAI
    const url = `http://127.0.0.1:11434/v1/chat/completions`;
    const body = {
        model: ENV.OLLAMA_MODEL || "llama3.1", // Usa el modelo configurado o llama3.1 por defecto
        messages: messages,
        tools: tools?.length ? tools : undefined,
        temperature: 0.1, // Mantiene la precisión técnica de Lya
        stream: false
    };
    console.log('[LLM] Request Body (Ollama):', JSON.stringify(body, null, 2));
    // Timeout configurable para evitar que el bot se quede colgado indefinidamente.
    // El valor por defecto es 120 segundos. Modelos grandes pueden necesitar más tiempo.
    const timeoutSeconds = ENV.OLLAMA_TIMEOUT ? parseInt(ENV.OLLAMA_TIMEOUT, 10) : 120;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[LLM Error] Ollama HTTP ${response.status}: ${errorText}`);
            throw new Error(`Ollama API Error (HTTP ${response.status}): ${errorText}`);
        }
        const data = await response.json();
        console.log('[LLM] Request successful. Response from Ollama received.');
        console.log('[LLM] Raw Data:', JSON.stringify(data, null, 2));
        if (!data.choices || data.choices.length === 0) {
            throw new Error("Ollama returned no choices.");
        }
        return data.choices[0].message;
    }
    catch (error) {
        console.error('[LLM Error] Connection to Ollama failed. Make sure Ollama is running.', error);
        throw error;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
