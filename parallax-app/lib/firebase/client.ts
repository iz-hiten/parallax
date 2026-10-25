"use client";
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, GoogleAuthProvider, connectAuthEmulator, getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
export function clientAuth(): Auth | null {
  if (!firebaseEnabled) return null;
  if (auth) return auth;
  app ??= getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  const emu = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR; // e.g. http://127.0.0.1:9099, local development only
  if (emu) connectAuthEmulator(auth, emu, { disableWarnings: true });
  return auth;
}
export const googleProvider = () => new GoogleAuthProvider();
