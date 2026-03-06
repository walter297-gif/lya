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
    console.log(`[Loop] Processing message: "${userContent.substring(0, 50)}..."`);
    
    try {
        // 1. Save user message
        console.log("[Loop] Saving user message to DB...");
        await saveMessage({ role: 'user', content: userContent });
    } catch (error) {
        console.error("[Loop Error] Failed to save user message:", error);
        throw error;
    }

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[Loop] Iteration ${iterations}`);

        try {
            // 2. Load context
            console.log("[Loop] Loading context...");
            const history = await getHistory();
            
            const messages: LLMMessage[] = [
                {
                    role: 'system',
                    content: `You are LyaGravity, a helpful, precise personal AI agent running locally. Always use the provided tools if needed. Answer concisely.`
                },
                ...formatContext(history)
            ];

            // 3. Call LLM
            console.log("[Loop] Calling LLM...");
            const response = await generateResponse(messages, ALL_TOOLS);

            // 4. Handle response
            const messageToSave: any = {
                role: response.role,
                content: response.content || null,
            };

            if (response.tool_calls && response.tool_calls.length > 0) {
                console.log(`[Loop] LLM requested ${response.tool_calls.length} tool calls`);
                messageToSave.tool_calls = response.tool_calls;
                await saveMessage(messageToSave);

                // Execute tools
                for (const toolCall of response.tool_calls) {
                    const functionName = toolCall.function.name;
                    console.log(`[Loop] Executing tool: ${functionName}`);
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
                        console.error(`[Loop Error] Tool ${functionName} failed:`, error);
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        await saveMessage({
                            role: 'tool',
                            content: JSON.stringify({ error: errorMsg }),
                            name: functionName,
                            tool_call_id: toolCall.id
                        });
                    }
                }
            } else {
                console.log("[Loop] LLM provided final answer");
                await saveMessage(messageToSave);
                return response.content || "(No response content)";
            }
        } catch (error) {
            console.error("[Loop Error] Error in iteration:", error);
            throw error;
        }
    }

    console.warn("[Loop] Reached max iterations");
    return "Error: Agent reached maximum iterations (loop guard).";
}
