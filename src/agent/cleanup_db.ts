import Database from 'better-sqlite3';
import { ENV } from '../config.js';

// Inicializar conexión (ENV.DB_PATH es relativo a la raíz del proyecto)
const db = new Database(ENV.DB_PATH);

console.log(`[Cleanup] 🧹 Iniciando mantenimiento de base de datos: ${ENV.DB_PATH}`);

try {
    // 1. Eliminar duplicados exactos (mismo contenido, rol y timestamp)
    // Esto corrige inserciones dobles accidentales
    const dedupe = db.prepare(`
        DELETE FROM messages
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM messages
            GROUP BY chat_id, role, content, timestamp
        )
    `);
    const dedupeRes = dedupe.run();
    console.log(`[Cleanup] ✂️  Eliminados ${dedupeRes.changes} mensajes duplicados exactos.`);

    // 2. Mantener ligera la DB: Conservar solo los últimos 50 mensajes por chat
    // Esto asegura que el contexto no crezca infinitamente y las consultas sean rápidas
    const prune = db.prepare(`
        DELETE FROM messages
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY id DESC) as rn
                FROM messages
            )
            WHERE rn <= 50
        )
    `);
    const pruneRes = prune.run();
    console.log(`[Cleanup] 🗑️  Eliminados ${pruneRes.changes} mensajes antiguos (se conservaron los últimos 50 por chat).`);

    // 3. Optimizar archivo (VACUUM)
    db.exec('VACUUM');
    console.log(`[Cleanup] 🗜️  Base de datos optimizada (VACUUM completado).`);

} catch (error) {
    console.error("[Cleanup] ❌ Error durante el mantenimiento:", error);
} finally {
    db.close();
    console.log("[Cleanup] ✅ Mantenimiento finalizado.");
}