import { ENV } from '../config.js';

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
    const apiKey = ENV.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('No API key configured for Gemini');
    }

    // Log key presence and basic info
    console.log(`[LLM] Attempting request. Key starts with: ${apiKey.substring(0, 4)}...`);
    
    // Google OpenAI compatibility endpoint
    const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    
    const body = {
        model: 'gemini-2.0-flash',
        messages: messages,
        tools: tools?.length ? tools : undefined,
        temperature: 0.7,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[LLM Error] HTTP ${response.status}: ${errorText}`);
            throw new Error(`Gemini API Error (HTTP ${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log('[LLM] Request successful');
        return data.choices[0].message;
    } catch (error) {
        console.error('[LLM Error] Fetch failed:', error);
        throw error;
    }
}
