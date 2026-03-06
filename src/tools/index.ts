import { getCurrentTimeDefinition, getCurrentTime } from './getCurrentTime.js';

export const ALL_TOOLS = [
    getCurrentTimeDefinition
];

export async function executeTool(name: string, args: any): Promise<any> {
    if (name === 'get_current_time') {
        return getCurrentTime();
    }
    throw new Error(`Unknown tool: ${name}`);
}
