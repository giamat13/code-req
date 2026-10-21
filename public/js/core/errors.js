import { t } from "./i18n.js";

// Turns a Firebase error into a message a person can act on. The raw code is never shown.
export function describeError(error) {
  if (error?.code === "permission-denied") return t("errors.permission");
  if (error?.code === "unavailable" || error?.code === "deadline-exceeded")
    return t("errors.network");
  return t("errors.generic");
}

const AUTH_MESSAGES = {
  "auth/invalid-email": "auth.invalidEmail",
  "auth/missing-password": "auth.weakPassword",
  "auth/weak-password": "auth.weakPassword",
  "auth/email-already-in-use": "auth.emailInUse",
  "auth/invalid-credential": "auth.invalidCredential",
  "auth/wrong-password": "auth.invalidCredential",
  "auth/user-not-found": "auth.invalidCredential",
  "auth/too-many-requests": "auth.tooMany",
  "auth/user-disabled": "auth.disabled",
  "auth/network-request-failed": "errors.network",
};

// Sign-in and sign-up errors have their own messages, because the next step differs for each one.
export function describeAuthError(error) {
  const key = AUTH_MESSAGES[error?.code];
  return t(key ?? "auth.failed");
}
