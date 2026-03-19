import fs from 'fs';
import path from 'path';
export const readFileDefinition = {
    name: 'read_file',
    description: 'Read the contents of a file.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The absolute path to the file.' }
        },
        required: ['path']
    }
};
export const writeFileDefinition = {
    name: 'write_file',
    description: 'Write content to a file.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The absolute path to the file.' },
            content: { type: 'string', description: 'The content to write.' }
        },
        required: ['path', 'content']
    }
};
export const listDirDefinition = {
    name: 'list_dir',
    description: 'List the contents of a directory.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The absolute path to the directory.' }
        },
        required: ['path']
    }
};
export async function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}
export async function writeFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return `File written successfully to ${filePath}`;
}
export async function listDir(dirPath) {
    return fs.readdirSync(dirPath);
}
