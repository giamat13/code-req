import {
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "../firebase-sdk.js";
import { auth, googleProvider } from "./firebase.js";

// Browsers that block popups, or that cannot open them, fall back to a full-page redirect.
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

export function watchSignIn(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}

// Developers sign in with Google or email and password. Anonymous sessions belong to requesters only.
export function isDeveloperAccount(user) {
  return Boolean(user) && !user.isAnonymous;
}

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (!REDIRECT_FALLBACK_CODES.has(error.code)) throw error;
    await signInWithRedirect(auth, googleProvider);
  }
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

// Requesters get an anonymous session when they submit a request. The uid is stored on the request,
// so the browser can list "my requests" later. Returns null when anonymous sign-in is unavailable.
export async function ensureRequesterSession() {
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  } catch {
    return null;
  }
}

// Call once on page load. Returns the user who finished a redirect sign-in, or null.
export async function finishRedirectSignIn() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

export function signOutUser() {
  return signOut(auth);
}

export function reauthenticate() {
  return reauthenticateWithPopup(auth.currentUser, googleProvider);
}

export function deleteAuthUser() {
  return deleteUser(auth.currentUser);
}
