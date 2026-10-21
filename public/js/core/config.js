import { firebaseConfig } from "../firebase-config.js";

// Local development uses the emulators, so it counts as configured. A deployment is configured when
// firebase-config.js holds a real project ID instead of a REPLACE_WITH_ placeholder.
export const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
export const isConfigured = onLocalhost || !firebaseConfig.projectId.startsWith("REPLACE_WITH_");
