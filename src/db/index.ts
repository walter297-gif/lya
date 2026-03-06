import { db } from './firebase-setup.js';
import { FieldValue } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'messages';

export interface MessageRow {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    name?: string | null;
    tool_calls?: any | null;
    tool_call_id?: string | null;
    timestamp: any;
}

export async function saveMessage(msg: {
    role: string;
    content?: string | null;
    name?: string;
    tool_calls?: any;
    tool_call_id?: string;
}) {
    const docData: any = {
        role: msg.role,
        content: msg.content || null,
        timestamp: FieldValue.serverTimestamp(),
    };

    if (msg.name) docData.name = msg.name;
    if (msg.tool_calls) docData.tool_calls = JSON.stringify(msg.tool_calls);
    if (msg.tool_call_id) docData.tool_call_id = msg.tool_call_id;

    await db.collection(COLLECTION_NAME).add(docData);
}

export async function getHistory(limitCount = 20) {
    const snapshot = await db.collection(COLLECTION_NAME)
        .orderBy('timestamp', 'asc')
        .limitToLast(limitCount)
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const msg: any = { role: data.role };
        if (data.content !== null) msg.content = data.content;
        if (data.name) msg.name = data.name;
        if (data.tool_calls) msg.tool_calls = JSON.parse(data.tool_calls);
        if (data.tool_call_id) msg.tool_call_id = data.tool_call_id;
        return msg;
    });
}

export async function clearHistory() {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
}
