import Database from 'better-sqlite3';
import { ENV } from '../config.js';
const db = new Database(ENV.DB_PATH);
console.log(`[DB] SQLite initialized at: ${ENV.DB_PATH}`);
db.pragma('journal_mode = WAL'); // Optimización: Write-Ahead Logging para mejor concurrencia
// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artefacts (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        type TEXT NOT NULL, -- 'code', 'document', 'design'
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL DEFAULT 'default',
        project_id TEXT,
        role TEXT NOT NULL,
        content TEXT,
        name TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
`);
// Migrations
const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
if (!tableInfo.some(col => col.name === 'project_id')) {
    db.exec("ALTER TABLE messages ADD COLUMN project_id TEXT");
}
/* Projects */
export function createProject(id, name, description) {
    db.prepare("INSERT INTO projects (id, name, description) VALUES (?, ?, ?)").run(id, name, description || null);
}
export function getProjects() {
    return db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
}
/* Artefacts */
export function saveArtefact(project_id, type, title, content) {
    const id = Math.random().toString(36).substring(7);
    db.prepare("INSERT INTO artefacts (id, project_id, type, title, content) VALUES (?, ?, ?, ?, ?)")
        .run(id, project_id, type, title, content);
    return id;
}
export function getArtefacts(project_id) {
    if (project_id) {
        return db.prepare("SELECT * FROM artefacts WHERE project_id = ? ORDER BY created_at DESC").all(project_id);
    }
    return db.prepare("SELECT * FROM artefacts ORDER BY created_at DESC").all();
}
/* Messages */
export function saveMessage(chat_id, msg, project_id) {
    const stmt = db.prepare(`
        INSERT INTO messages (chat_id, project_id, role, content, name, tool_calls, tool_call_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(chat_id, project_id || null, msg.role, msg.content || null, msg.name || null, msg.tool_calls ? JSON.stringify(msg.tool_calls) : null, msg.tool_call_id || null);
}
export function getHistory(chat_id, project_id, limit = 20) {
    const cid = String(chat_id || 'default');
    // Consulta directa sin parámetros complejos para evitar el error de SQLite
    let query = `SELECT role, content, name, tool_calls, tool_call_id FROM messages WHERE chat_id = ?`;
    const params = [cid];
    if (project_id) {
        query += " AND project_id = ?";
        params.push(project_id);
    }
    else {
        query += " AND project_id IS NULL";
    }
    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);
    const rows = db.prepare(query).all(...params);
    return rows.reverse().map(row => ({
        role: row.role,
        content: row.content || null,
        name: row.name || undefined,
        tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
        tool_call_id: row.tool_call_id || undefined
    }));
}
export function clearHistory(chat_id) {
    if (chat_id) {
        db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chat_id);
    }
    else {
        db.prepare('DELETE FROM messages').run();
    }
}
// Settings table for persistence (e.g., active skill)
db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        chat_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (chat_id, key)
    );
`);
export function setSetting(chat_id, key, value) {
    db.prepare("INSERT OR REPLACE INTO settings (chat_id, key, value) VALUES (?, ?, ?)").run(chat_id, key, value);
}
export function getSetting(chat_id, key) {
    const row = db.prepare("SELECT value FROM settings WHERE chat_id = ? AND key = ?").get(chat_id, key);
    return row ? row.value : null;
}
