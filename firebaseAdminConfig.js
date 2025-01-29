import admin from 'firebase-admin';
import 'dotenv/config'; 

const { DB_CREDENTIALS_PATH } = process.env;
import { readFile } from 'fs/promises';

let db; // Оголошуємо змінну для db

async function initializeFirebase() {
  try {
    const serviceAccount = JSON.parse(await readFile(new URL(DB_CREDENTIALS_PATH, import.meta.url), 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    });

    db = admin.firestore(); 

    return { admin, db };
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error; 
  }
}

export { initializeFirebase, db }; 
