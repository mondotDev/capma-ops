import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

let firebaseAppInstance: FirebaseApp | null | undefined;
let firestoreDbInstance: Firestore | null | undefined;

function getFirebaseConfigFromEnv(): FirebaseWebConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  };
}

export function isFirebaseConfigured() {
  return getFirebaseConfigFromEnv() !== null;
}

export function isDashboardReadsEnabled() {
  return process.env.NEXT_PUBLIC_FIREBASE_DASHBOARD_READS_ENABLED === "true";
}

export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseAppInstance !== undefined) {
    return firebaseAppInstance;
  }

  const firebaseConfig = getFirebaseConfigFromEnv();

  if (!firebaseConfig) {
    firebaseAppInstance = null;
    return firebaseAppInstance;
  }

  firebaseAppInstance = getApps()[0] ?? initializeApp(firebaseConfig);
  return firebaseAppInstance;
}

export function getFirestoreDb(): Firestore | null {
  if (firestoreDbInstance !== undefined) {
    return firestoreDbInstance;
  }

  const firebaseApp = getFirebaseApp();

  if (!firebaseApp) {
    firestoreDbInstance = null;
    return firestoreDbInstance;
  }

  firestoreDbInstance = getFirestore(firebaseApp);
  return firestoreDbInstance;
}

export const firebaseApp = getFirebaseApp();
export const firestoreDb = getFirestoreDb();
