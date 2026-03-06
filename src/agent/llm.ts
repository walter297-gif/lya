import OpenAI from 'openai';
import { ENV } from '../config.js';

const gemini = new OpenAI({
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: ENV.GEMINI_API_KEY,
});

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
    if (ENV.GEMINI_API_KEY) {
        try {
            const response = await gemini.chat.completions.create({
                model: 'gemini-2.0-flash',
                messages: messages as any,
                tools: tools?.length ? (tools as any) : undefined,
                temperature: 0.7,
            });
            // Google's endpoint returns valid OpenAI-like responses
            return response.choices[0].message;
        } catch (error) {
            console.error('[Gemini Error]', error instanceof Error ? error.message : error);
            throw error;
        }
    } else {
        throw new Error('No API key configured for Gemini');
    }
}
