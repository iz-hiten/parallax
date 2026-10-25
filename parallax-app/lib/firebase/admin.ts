import "server-only";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { Auth, getAuth } from "firebase-admin/auth";

// Server credentials come from one env var holding the service-account JSON, base64-encoded
// (FIREBASE_SERVICE_ACCOUNT_BASE64), or from the three separate fields.
function credentials() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    const j = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key };
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return { projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\n/g, "\n") };
  }
  return null;
}

// Local development against the Firebase emulators needs no credentials.
const emulated = () => Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);

let app: App | null = null;
function adminApp(): App | null {
  if (app) return app;
  const c = credentials();
  if (c) app = getApps()[0] ?? initializeApp({ credential: cert(c), projectId: c.projectId });
  else if (emulated()) app = getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-parallax" });
  return app;
}

export const adminEnabled = () => credentials() !== null || emulated();
export const adminDb = (): Firestore | null => {
  const a = adminApp();
  return a ? getFirestore(a) : null;
};
export const adminAuth = (): Auth | null => {
  const a = adminApp();
  return a ? getAuth(a) : null;
};

/** Verifies the Firebase ID token in an Authorization: Bearer header. */
export async function userFromRequest(req: Request) {
  const auth = adminAuth();
  const h = req.headers.get("authorization") ?? "";
  if (!auth || !h.startsWith("Bearer ")) return null;
  try {
    return await auth.verifyIdToken(h.slice(7));
  } catch {
    return null;
  }
}
