import { emulatorConfig, firebaseConfig } from "../firebase-config.js";
import {
  connectAuthEmulator,
  connectFirestoreEmulator,
  getAuth,
  getFirestore,
  GoogleAuthProvider,
  initializeApp,
  initializeFirestore,
} from "../firebase-sdk.js";

// Local development uses the Emulator Suite, so no real project or billing account is needed.
const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);

const demoConfig = {
  apiKey: "demo-api-key",
  authDomain: "localhost",
  projectId: emulatorConfig.projectId,
  appId: "demo-app",
};

export const isConfigured = onLocalhost || !firebaseConfig.projectId.startsWith("REPLACE_WITH_");

const app = initializeApp(onLocalhost ? demoConfig : firebaseConfig);
export const auth = getAuth(app);
// On localhost, Firestore falls back to long polling when the streaming connection is blocked or stalls. Some local
// proxies and security filters stall streams, and without the fallback every read waits until the page gives up.
export const db = onLocalhost
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

if (onLocalhost) {
  connectAuthEmulator(auth, emulatorConfig.authUrl, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorConfig.host, emulatorConfig.firestorePort);
}
