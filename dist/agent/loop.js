import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getHistory, saveMessage } from '../db/index.js';
import { generateResponse } from './llm.js';
import { ALL_TOOLS, executeTool } from '../tools/index.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_ITERATIONS = 10;
// Simple LRU Cache for SQL queries
class SimpleLRUCache {
    capacity;
    map;
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map();
    }
    get(key) {
        const val = this.map.get(key);
        if (val !== undefined) {
            this.map.delete(key);
            this.map.set(key, val);
        }
        return val;
    }
    set(key, value) {
        if (this.map.has(key))
            this.map.delete(key);
        else if (this.map.size >= this.capacity) {
            const first = this.map.keys().next().value;
            if (first !== undefined)
                this.map.delete(first);
        }
        this.map.set(key, value);
    }
}
const sqlCache = new SimpleLRUCache(50);
// Helper to merge consecutive messages of the same role (fixes Gemini HTTP 400 errors)
function consolidateMessages(messages) {
    if (messages.length === 0)
        return [];
    const consolidated = [];
    let lastMsg = messages[0];
    for (let i = 1; i < messages.length; i++) {
        const currentMsg = messages[i];
        // Merge consecutive User messages
        if (lastMsg.role === 'user' && currentMsg.role === 'user') {
            lastMsg = {
                ...lastMsg,
                content: (lastMsg.content || '') + '\n\n' + (currentMsg.content || '')
            };
        }
        else {
            consolidated.push(lastMsg);
            lastMsg = currentMsg;
        }
    }
    consolidated.push(lastMsg);
    return consolidated;
}
// Convert DB rows to LLM format
function formatContext(rows) {
    return rows.map(row => {
        const msg = {
            role: row.role,
            content: row.content,
        };
        if (row.name)
            msg.name = row.name;
        // Fix for Gemini: Tool messages must have a name
        if (msg.role === 'tool' && !msg.name) {
            msg.name = 'unknown_tool';
        }
        if (row.tool_calls) {
            try {
                msg.tool_calls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls;
            }
            catch (e) {
                console.error("[Loop] Error parsing tool_calls from DB:", e);
                msg.tool_calls = undefined;
            }
        }
        if (row.tool_call_id)
            msg.tool_call_id = row.tool_call_id;
        return msg;
    });
}
async function getSystemPrompt(skill) {
    const skillPath = path.join(__dirname, 'skills', `${skill}.md`);
    if (fs.existsSync(skillPath)) {
        return fs.readFileSync(skillPath, 'utf8');
    }
    // Fallback to internal prompts for legacy support
    const legacyPrompts = {
        'personal': 'Eres Lya, una asistente útil y amable. Responde siempre en español de forma breve.',
        'codigo': 'Eres Lya en modo Desarrollador. Eres una experta en programación y arquitectura. Proporciona código limpio, documentado y optimizado.',
        'sql': 'Eres Lya, una experta en SQL y optimización de bases de datos.'
    };
    return legacyPrompts[skill] || legacyPrompts['personal'];
}
export async function processUserMessage(userContent, chat_id = 'default', project_id, skill = 'personal') {
    console.log(`[Loop] Processing for chat ${chat_id} (Project: ${project_id || 'none'}, Skill: ${skill})`);
    try {
        await saveMessage(chat_id, { role: 'user', content: userContent }, project_id);
    }
    catch (error) {
        console.error("[Loop Error] Failed to save user message:", error);
        throw error;
    }
    let iterations = 0;
    const systemPrompt = await getSystemPrompt(skill);
    while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[Loop] Iteration ${iterations}`);
        try {
            let history = await getHistory(chat_id, project_id);
            // Sanitize history: Ensure it doesn't start with a tool or assistant message,
            // which would be an invalid turn sequence for the LLM.
            while (history.length > 0 && (history[0].role === 'tool' || history[0].role === 'assistant')) {
                console.warn(`[Loop] History starts with a '${history[0].role}' message. Trimming it to prevent API errors.`);
                history.shift(); // Remove the first element
            }
            let messages = [
                { role: 'system', content: systemPrompt },
                ...formatContext(history)
            ];
            // Consolidate messages to satisfy Gemini's strict turn-taking (User -> Model -> User)
            messages = consolidateMessages(messages);
            // Enable tools for coding and superpowers skills
            const engineeringSkills = ['codigo', 'brainstorming', 'planning', 'tdd', 'subagent_execution', 'sistema'];
            const useTools = engineeringSkills.includes(skill) ? ALL_TOOLS : undefined;
            console.log(`[Loop] skill=${skill}, useTools count=${useTools?.length || 0}`);
            const response = await generateResponse(messages, useTools);
            const messageToSave = {
                role: response.role,
                content: response.content || null,
            };
            if (response.tool_calls && response.tool_calls.length > 0) {
                console.log(`[Loop] LLM requested ${response.tool_calls.length} tool calls`);
                messageToSave.tool_calls = response.tool_calls;
                await saveMessage(chat_id, messageToSave, project_id);
                for (const toolCall of response.tool_calls) {
                    let functionName = toolCall.function.name;
                    // Fallback for empty tool names (common with some local models)
                    if (!functionName) {
                        if (skill === 'sistema') {
                            functionName = 'execute_sql_query';
                            console.warn("[Loop] Tool name was empty, inferred 'execute_sql_query' based on skill");
                        }
                        else {
                            console.error("[Loop] Tool name is empty and cannot be inferred.");
                            continue;
                        }
                    }
                    console.log(`[Loop] Executing: ${functionName}`);
                    let args = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments || '{}');
                        // Heuristic for execute_sql_query if the model missed the 'query' property
                        if (functionName === 'execute_sql_query') {
                            // 1. Normalize arguments to 'query' first
                            if (typeof args === 'string') {
                                args = { query: args };
                            }
                            else if (args && !args.query) {
                                // Map common hallucinations to 'query'
                                if (args.sql)
                                    args.query = args.sql;
                                else if (args.consulta)
                                    args.query = args.consulta;
                                else if (Object.keys(args).length === 1 && typeof Object.values(args)[0] === 'string') {
                                    const val = Object.values(args)[0];
                                    // If it looks like a model code or they sent {"modelo": "..."}, transform to SP call
                                    if (val.includes('-') || val.length > 3) {
                                        console.log(`[Loop] Transforming generic arg '${val}' to Stored Procedure call`);
                                        args.query = `EXEC [dbo].[Sp_Busca_Control_de_Stock] 'L1', '${val}'`;
                                    }
                                    else {
                                        args.query = val;
                                    }
                                }
                            }
                            // 2. Safety catch: LLM sometimes uses literal placeholders from instructions
                            const queryUpper = args.query ? args.query.toUpperCase() : "";
                            const hasPlaceholder = queryUpper.includes("[CODIGO]") || queryUpper.includes("MODELO");
                            if (hasPlaceholder) {
                                console.warn("[Loop] Model used literal placeholder. Attempting to fix...");
                                // Look for anything that looks like a product code: Alphanumeric-Alphanumeric [Optional Space/Hyphen Alphanumeric]
                                // Example matches: C-21 21-3, B-10, 123-ABC-45
                                const modelMatch = userContent.match(/[A-Z0-9]+-[A-Z0-9- ]+/i);
                                if (modelMatch) {
                                    const captured = modelMatch[0].trim();
                                    console.log(`[Loop] Captured model from content: "${captured}"`);
                                    // Replace placeholders intelligently
                                    // Replace quoted placeholders first to avoid double quoting
                                    args.query = args.query.replace(/'\[CODIGO\]'/gi, `'${captured}'`);
                                    args.query = args.query.replace(/'MODELO'/gi, `'${captured}'`);
                                    // Replace unquoted placeholders
                                    args.query = args.query.replace(/\[CODIGO\]/gi, `'${captured}'`);
                                    args.query = args.query.replace(/MODELO/gi, `'${captured}'`);
                                    console.log(`[Loop] Fixed query: ${args.query}`);
                                }
                            }
                            // 3. NEW Safety catch: LLM sometimes wraps the extracted code in brackets, e.g., '[H-012345]'
                            if (args.query && /'\[.*\]'/.test(args.query)) {
                                console.warn(`[Loop] Detected bracket-wrapped code. Fixing it.`);
                                // This regex finds a quoted string that contains another string inside brackets, and removes the brackets.
                                // e.g., 'L1', '[H-013410031 26]' -> 'L1', 'H-013410031 26'
                                args.query = args.query.replace(/'\[(.*?)\]'/g, "'$1'");
                                console.log(`[Loop] Fixed query (bracket removal): ${args.query}`);
                            }
                            // 4. NEW Safety catch: LLM sometimes adds a trailing period.
                            if (args.query && args.query.trim().endsWith('.')) {
                                console.warn(`[Loop] Detected trailing period in query. Fixing it.`);
                                args.query = args.query.trim().slice(0, -1);
                                console.log(`[Loop] Fixed query (period removal): ${args.query}`);
                            }
                            // Safety catch: Transform hallucinated SELECT to the required EXEC format
                            const queryStr = args.query ? String(args.query) : "";
                            if (queryStr.toUpperCase().includes('SELECT') && !queryStr.toUpperCase().includes('EXEC')) {
                                console.warn("[Loop] Model hallucinated a SELECT query. Transforming to EXEC...");
                                const codeMatch = queryStr.match(/'([^']+)'/);
                                if (codeMatch) {
                                    const captured = codeMatch[1].trim();
                                    args.query = `EXEC [dbo].[Sp_Busca_Control_de_Stock] 'L1', '${captured}'`;
                                    console.log(`[Loop] Transformed SELECT to: ${args.query}`);
                                }
                            }
                            console.log(`[Loop] Final SQL Args:`, JSON.stringify(args));
                        }
                    }
                    catch (e) {
                        console.error("[Loop] Error parsing tool arguments:", e);
                    }
                    try {
                        let result;
                        let isCached = false;
                        if (functionName === 'execute_sql_query' && args.query) {
                            const cached = sqlCache.get(args.query);
                            if (cached) {
                                result = cached;
                                isCached = true;
                                console.log(`[Loop] SQL Cache HIT`);
                            }
                        }
                        if (!isCached) {
                            result = await executeTool(functionName, args);
                            console.log(`[Loop] Tool ${functionName} success`);
                            if (functionName === 'execute_sql_query' && args.query) {
                                sqlCache.set(args.query, result);
                            }
                        }
                        await saveMessage(chat_id, {
                            role: 'tool',
                            content: typeof result === 'string' ? result : JSON.stringify(result),
                            name: functionName,
                            tool_call_id: toolCall.id
                        }, project_id);
                    }
                    catch (error) {
                        console.error(`[Loop Error] Tool ${functionName} failed:`, error);
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        await saveMessage(chat_id, {
                            role: 'tool',
                            content: JSON.stringify({ error: errorMsg }),
                            name: functionName,
                            tool_call_id: toolCall.id
                        }, project_id);
                    }
                }
                console.log(`[Loop] Finished executing all ${response.tool_calls.length} tool calls`);
            }
            else {
                console.log("[Loop] Final answer received");
                console.log(`[Loop] Final content (${response.content?.length || 0} chars): "${(response.content || '').substring(0, 100)}..."`);
                await saveMessage(chat_id, messageToSave, project_id);
                return response.content || "(No response content)";
            }
        }
        catch (error) {
            console.error("[Loop Error] Error in iteration:", error);
            throw error;
        }
    }
    return "Error: Agent reached maximum iterations.";
}
