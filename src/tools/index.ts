import { getCurrentTimeDefinition, getCurrentTime } from './getCurrentTime.js';
import { readFileDefinition, writeFileDefinition, listDirDefinition, readFile, writeFile, listDir } from './fs.js';
import { runCommandDefinition, runCommand } from './terminal.js';
import { executeSqlQueryDefinition, executeSqlQuery } from './sql.js';

export const ALL_TOOLS = [
    // { type: 'function', function: getCurrentTimeDefinition },
    // { type: 'function', function: readFileDefinition },
    // { type: 'function', function: writeFileDefinition },
    // { type: 'function', function: listDirDefinition },
    // { type: 'function', function: runCommandDefinition },
    { type: 'function', function: executeSqlQueryDefinition }
];

export async function executeTool(name: string, args: any): Promise<any> {
    switch (name) {
        // case 'get_current_time':
        //     return getCurrentTime();
        // case 'read_file':
        //     return readFile(args.path);
        // case 'write_file':
        //     return writeFile(args.path, args.content);
        // case 'list_dir':
        //     return listDir(args.path);
        // case 'run_command':
        //     return runCommand(args.command, args.cwd);
        case 'execute_sql_query':
            return executeSqlQuery(args.query);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}