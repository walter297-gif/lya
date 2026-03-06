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
    const apiKey = ENV.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('No API key configured for OpenRouter');
    }

    // Log key presence and basic info
    console.log(`[LLM] Attempting request. Key starts with: ${apiKey.substring(0, 4)}...`);
    
    // OpenRouter endpoint
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    const body = {
        model: 'google/gemini-2.0-flash-exp:free', // Using reliable free model
        messages: messages,
        tools: tools?.length ? tools : undefined,
        temperature: 0.7,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/walter297-gif/lya', // Required by OpenRouter
                'X-Title': 'LyaGravity Bot'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[LLM Error] HTTP ${response.status}: ${errorText}`);
            throw new Error(`OpenRouter API Error (HTTP ${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log('[LLM] Request successful');
        return data.choices[0].message;
    } catch (error) {
        console.error('[LLM Error] Fetch failed:', error);
        throw error;
    }
}
