import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ENV } from '../config.js';
import { readFileSync } from 'fs';
import path from 'path';

let serviceAccount: ServiceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
    try {
        const credPath = path.resolve(process.cwd(), ENV.FIREBASE_CREDENTIALS_PATH);
        serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
    } catch (error) {
        console.error(`[Firebase Error] Could not read service account file at ${ENV.FIREBASE_CREDENTIALS_PATH}.`);
        console.error("Please ensure the file exists OR set the FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
        throw error;
    }
}

const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: ENV.FIREBASE_PROJECT_ID
});

export const db = getFirestore(app);
