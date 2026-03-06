import { getHistory, saveMessage, MessageRow } from '../db/index.js';
import { generateResponse, LLMMessage } from './llm.js';
import { ALL_TOOLS, executeTool } from '../tools/index.js';

const MAX_ITERATIONS = 5;

// Convert DB rows to LLM format
function formatContext(rows: any[]): LLMMessage[] {
    return rows.map(row => {
        const msg: LLMMessage = {
            role: row.role as any,
            content: row.content,
        };
        if (row.name) msg.name = row.name;
        if (row.tool_calls) msg.tool_calls = row.tool_calls;
        if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
        return msg;
    });
}

export async function processUserMessage(userContent: string): Promise<string> {
    // 1. Save user message
    await saveMessage({ role: 'user', content: userContent });

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // 2. Load context
        const history = await getHistory();
        
        const messages: LLMMessage[] = [
            {
                role: 'system',
                content: `You are LyaGravity, a helpful, precise personal AI agent running locally. Always use the provided tools if needed. Answer concisely.`
            },
            ...formatContext(history)
        ];

        // 3. Call LLM
        const response = await generateResponse(messages, ALL_TOOLS);

        // 4. Handle response
        const messageToSave: any = {
            role: response.role,
            content: response.content || null,
        };

        if (response.tool_calls && response.tool_calls.length > 0) {
            messageToSave.tool_calls = response.tool_calls;
            // Save assistant's request to call tools
            await saveMessage(messageToSave);

            // Execute tools
            for (const toolCall of response.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || '{}');
                
                try {
                    const result = await executeTool(functionName, args);
                    await saveMessage({
                        role: 'tool',
                        content: typeof result === 'string' ? result : JSON.stringify(result),
                        name: functionName,
                        tool_call_id: toolCall.id
                    });
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    await saveMessage({
                        role: 'tool',
                        content: JSON.stringify({ error: errorMsg }),
                        name: functionName,
                        tool_call_id: toolCall.id
                    });
                }
            }
            // Loop continues to feed tool responses back to the LLM
        } else {
            // No tool calls, we have the final answer
            await saveMessage(messageToSave);
            return response.content || "(No response content)";
        }
    }

    return "Error: Agent reached maximum iterations (loop guard).";
}
