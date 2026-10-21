import { emulatorConfig, firebaseConfig } from "../firebase-config.js";
import { onLocalhost } from "../core/config.js";

// Reads one public document through the Firestore REST API. This is plain HTTPS, with no streaming connection and no
// sign-in state, so it answers even when the SDK's connection stalls. The SDK stays the normal path for everything else.
const BASE = onLocalhost
  ? `http://${emulatorConfig.host}:${emulatorConfig.firestorePort}/v1/projects/${emulatorConfig.projectId}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Firestore encodes every value with a type tag. This turns them back into plain values.
function decodeValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

// Returns the document's fields, or null when it does not exist. A denied read throws with code "permission-denied".
export async function readDocument(path) {
  const key = onLocalhost ? "" : `?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const response = await fetch(`${BASE}/${path}${key}`);
  if (response.status === 404) return null;
  if (response.status === 403) {
    const error = new Error("permission-denied");
    error.code = "permission-denied";
    throw error;
  }
  if (!response.ok) throw new Error(`Firestore REST answered ${response.status}`);
  const body = await response.json();
  return decodeFields(body.fields ?? {});
}
