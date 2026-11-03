import { firebaseConfig } from "../firebase-config.js";

// Local development uses the emulators, so it counts as configured. A deployment is configured when
// firebase-config.js holds a real project ID instead of a REPLACE_WITH_ placeholder.
export const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
// Address of the shared Claude connector (a Cloudflare Worker, see connector/README.md). While it is a
// REPLACE_WITH_ placeholder the "Connect Claude" card stays hidden.
export const connectorUrl = "https://apprequest-connector.furst-itamar.workers.dev";
export const isConfigured = onLocalhost || !firebaseConfig.projectId.startsWith("REPLACE_WITH_");
