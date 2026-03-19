import { db } from './firebase-setup.js';
import { FieldValue } from 'firebase-admin/firestore';
import { ENV } from '../config.js';

console.log(`[DB] Firebase Firestore initialized for Project ID: ${ENV.FIREBASE_PROJECT_ID}`);

// Firestore handles tables as collections automatically.

/* Projects */
export async function createProject(id: string, name: string, description?: string) {
    await db.collection('projects').doc(id).set({
        name,
        description: description || null,
        created_at: FieldValue.serverTimestamp()
    });
}

export async function getProjects() {
    const snapshot = await db.collection('projects').orderBy('created_at', 'desc').get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

/* Artefacts */
export async function saveArtefact(project_id: string, type: string, title: string, content: string) {
    const id = Math.random().toString(36).substring(7);
    await db.collection('artefacts').doc(id).set({
        project_id,
        type,
        title,
        content,
        created_at: FieldValue.serverTimestamp()
    });
    return id;
}

export async function getArtefacts(project_id?: string) {
    let query: any = db.collection('artefacts');
    if (project_id) {
        query = query.where('project_id', '==', project_id);
    }
    const snapshot = await query.orderBy('created_at', 'desc').get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

/* Messages */
export async function saveMessage(chat_id: string, msg: {
    role: string;
    content?: string | null;
    name?: string;
    tool_calls?: any;
    tool_call_id?: string;
}, project_id?: string) {
    const data: any = {
        role: msg.role,
        content: msg.content || null,
        timestamp: FieldValue.serverTimestamp()
    };

    if (msg.name) data.name = msg.name;
    if (msg.tool_calls) data.tool_calls = JSON.stringify(msg.tool_calls);
    if (msg.tool_call_id) data.tool_call_id = msg.tool_call_id;
    if (project_id) data.project_id = project_id;

    await db.collection('chats').doc(chat_id).collection('messages').add(data);
}

export async function getHistory(chat_id: string, project_id?: string, limit: number = 20) {
    const cid = String(chat_id || 'default');
    let query: any = db.collection('chats').doc(cid).collection('messages');

    if (project_id) {
        query = query.where('project_id', '==', project_id);
    }

    const snapshot = await query.orderBy('timestamp', 'desc').limit(limit).get();
    const messages = snapshot.docs.map((doc: any) => {
        const row = doc.data();
        return {
            role: row.role,
            content: row.content || null,
            name: row.name || undefined,
            tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
            tool_call_id: row.tool_call_id || undefined,
            timestamp: row.timestamp
        };
    });

    return messages.reverse();
}

export async function clearHistory(chat_id?: string) {
    if (chat_id) {
        // En Firestore, borrar subcolecciones requiere borrar cada documento
        const snapshot = await db.collection('chats').doc(chat_id).collection('messages').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        // También borrar settings de ese chat
        await db.collection('chats').doc(chat_id).delete();
    }
}

/* Settings / Persistencia de Estado */
export async function setSetting(chat_id: string, key: string, value: string) {
    await db.collection('chats').doc(chat_id).set({
        [key]: value
    }, { merge: true });
}

export async function getSetting(chat_id: string, key: string): Promise<string | null> {
    const doc = await db.collection('chats').doc(chat_id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return data ? data[key] || null : null;
}
