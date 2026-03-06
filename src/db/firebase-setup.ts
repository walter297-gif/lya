import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ENV } from '../config.js';
import { readFileSync } from 'fs';
import path from 'path';

let serviceAccount: ServiceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
    serviceAccount = JSON.parse(
        readFileSync(path.resolve(process.cwd(), ENV.FIREBASE_CREDENTIALS_PATH), 'utf8')
    );
}

const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: ENV.FIREBASE_PROJECT_ID
});

export const db = getFirestore(app);
