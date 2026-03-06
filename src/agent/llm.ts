import OpenAI from 'openai';
import { ENV } from '../config.js';

console.log(`[LLM] API Key status: ${ENV.GEMINI_API_KEY ? 'CONECTADA (OK)' : 'FALTANTE (ERROR)'}`);
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
    console.log(`[LLM] Calling Gemini with Key: ${ENV.GEMINI_API_KEY ? 'Present' : 'MISSING'}`);
    if (ENV.GEMINI_API_KEY) {
        try {
            const model = 'gemini-1.5-flash';
            console.log(`[LLM] Using model: ${model}`);
            const response = await gemini.chat.completions.create({
                model: model,
                messages: messages as any,
                tools: tools?.length ? (tools as any) : undefined,
                temperature: 0.7,
            });
            return response.choices[0].message;
        } catch (error) {
            console.error('[Gemini Error]', error);
            throw error;
        }
    } else {
        throw new Error('No API key configured for Gemini');
    }
}
