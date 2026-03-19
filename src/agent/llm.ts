import { ENV } from '../config.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

export type LLMMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    name?: string;
    tool_calls?: any[];
    tool_call_id?: string;
};

export async function generateResponse(
    messages: LLMMessage[],
    tools?: any[]
) {
    // PRIORIDAD: SI HAY GEMINI_API_KEY, USAR GEMINI (RECOMENDADO PARA CLOUD 24/7)
    if (ENV.GEMINI_API_KEY) {
        return generateGeminiResponse(messages, tools);
    }

    // FALLBACK: USAR OLLAMA (LOCAL)
    return generateOllamaResponse(messages, tools);
}

// Implementación de Google Gemini (Ideal para Render/Cloud)
async function generateGeminiResponse(messages: LLMMessage[], tools?: any[]) {
    console.log(`[LLM] Using Google Gemini 2.0 Flash...`);
    
    const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
             temperature: 0.1,
             topP: 0.95,
             topK: 64,
             maxOutputTokens: 2048,
        }
    });

    // Mapeo de herramientas al formato Gemini
    const googleTools: any = tools?.length ? [{
        functionDeclarations: tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
        }))
    }] : undefined;

    // Separar System Prompt del historial para Gemini
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    const history = messages
        .filter(m => m.role !== 'system')
        .map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'function' as any,
                    parts: [{ functionResponse: { name: m.name, response: { content: m.content } } }]
                };
            }
            if (m.role === 'assistant' && m.tool_calls) {
                return {
                    role: 'model' as any,
                    parts: [
                        { text: m.content || "" },
                        ...m.tool_calls.map(tc => ({
                            functionCall: {
                                name: tc.function.name,
                                args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
                            }
                        }))
                    ]
                };
            }
            return {
                role: m.role === 'assistant' ? 'model' : 'user' as any,
                parts: [{ text: m.content || "" }]
            };
        });

    const chat = model.startChat({
        systemInstruction: systemInstruction,
        history: history.slice(0, -1) as any, // Mapeo forzado para compatibilidad
        tools: googleTools
    });

    const lastMsg: any = history[history.length - 1];
    const lastUserMessage = lastMsg.parts[0].text || "";
    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;
    const responseText = response.text();
    const calls = response.functionCalls();

    if (calls && calls.length > 0) {
        return {
            role: 'assistant',
            content: responseText || null,
            tool_calls: calls.map(c => ({
                id: Math.random().toString(36).substr(2, 9),
                type: 'function',
                function: {
                    name: c.name,
                    arguments: JSON.stringify(c.args)
                }
            }))
        };
    }

    return {
        role: 'assistant',
        content: responseText
    };
}

// Implementación de Ollama (Actual)
async function generateOllamaResponse(messages: LLMMessage[], tools?: any[]) {
    console.log(`[LLM] Attempting request to Ollama (Llama)...`);
    const url = `http://127.0.0.1:11434/v1/chat/completions`;

    const body = {
        model: ENV.OLLAMA_MODEL || "llama3.1",
        messages: messages,
        tools: tools?.length ? tools : undefined,
        temperature: 0.1,
        stream: false
    };

    const timeoutSeconds = ENV.OLLAMA_TIMEOUT ? parseInt(ENV.OLLAMA_TIMEOUT, 10) : 120;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API Error (HTTP ${response.status}): ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error("Ollama returned no choices.");
        }

        return data.choices[0].message;

    } catch (error) {
        console.error('[LLM Error] Connection to Ollama failed.', error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}