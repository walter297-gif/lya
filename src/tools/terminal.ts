import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const runCommandDefinition = {
    name: 'run_command',
    description: 'Run a shell command in the terminal.',
    parameters: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The command to execute.' },
            cwd: { type: 'string', description: 'The working directory for the command.' }
        },
        required: ['command']
    }
};

export async function runCommand(command: string, cwd?: string): Promise<{ stdout: string, stderr: string }> {
    try {
        const { stdout, stderr } = await execPromise(command, { cwd });
        return { stdout, stderr };
    } catch (error: any) {
        return { stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
}
