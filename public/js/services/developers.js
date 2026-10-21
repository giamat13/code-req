import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "../firebase-sdk.js";
import { LIMITS } from "../domain/constants.js";
import { withTimeout } from "../core/timeout.js";
import { db } from "./firebase.js";
import { readDocument } from "./restDocs.js";

const REST_LOOKUP_MS = 6000;
const SDK_LOOKUP_MS = 6000;

// Returns the developer's public profile for a username, or null. A suspended developer
// returns { unavailable: true } because Firestore denies the read to anonymous visitors.
// The lookup is public, so it goes over the REST API first. REST opens no streaming connection. The SDK's reads do,
// and stalled streams can use up the browser's few connections to Firestore and hold up every later request.
export async function findDeveloper(username) {
  try {
    return await withTimeout(findDeveloperWithRest(username), REST_LOOKUP_MS);
  } catch {
    return withTimeout(findDeveloperWithSdk(username), SDK_LOOKUP_MS);
  }
}

async function findDeveloperWithSdk(username) {
  const claim = await getDoc(doc(db, "usernames", username));
  if (!claim.exists()) return null;
  const uid = claim.data().uid;
  try {
    const snapshot = await getDoc(doc(db, "developers", uid));
    return snapshot.exists() ? { uid, ...snapshot.data() } : null;
  } catch (error) {
    if (error.code === "permission-denied") return { uid, username, unavailable: true };
    throw error;
  }
}

async function findDeveloperWithRest(username) {
  const claim = await readDocument(`usernames/${username}`);
  if (!claim) return null;
  const uid = claim.uid;
  try {
    const profile = await readDocument(`developers/${uid}`);
    return profile ? { uid, ...profile } : null;
  } catch (error) {
    if (error.code === "permission-denied") return { uid, username, unavailable: true };
    throw error;
  }
}

export async function getDeveloper(uid) {
  const snapshot = await getDoc(doc(db, "developers", uid));
  return snapshot.exists() ? { uid, ...snapshot.data() } : null;
}

export async function isUsernameTaken(username) {
  const snapshot = await getDoc(doc(db, "usernames", username));
  return snapshot.exists();
}

// Claims the username first. Firestore rejects a second create on the same document, so two people
// cannot take the same name. If the profile write fails, the claim is removed again.
export async function claimUsername({ uid, username, profile }) {
  const claimRef = doc(db, "usernames", username);
  await setDoc(claimRef, { uid, createdAt: serverTimestamp() });
  try {
    await setDoc(doc(db, "developers", uid), {
      username,
      displayName: profile.displayName,
      bio: profile.bio,
      website: profile.website,
      pricingNote: profile.pricingNote,
      avatarUrl: profile.avatarUrl,
      acceptedPlatforms: profile.acceptedPlatforms,
      acceptingRequests: profile.acceptingRequests,
      suspended: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteDoc(claimRef).catch(() => {});
    throw error;
  }
}

export function updateDeveloper(uid, patch) {
  return updateDoc(doc(db, "developers", uid), { ...patch, updatedAt: serverTimestamp() });
}

// Only developers who accept requests and are not suspended. The rules require both filters.
export async function listDevelopers() {
  const snapshot = await getDocs(
    query(
      collection(db, "developers"),
      where("acceptingRequests", "==", true),
      where("suspended", "==", false),
      limit(LIMITS.directoryMax),
    ),
  );
  return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }));
}

export async function isPlatformAdmin(uid) {
  const snapshot = await getDoc(doc(db, "platformAdmins", uid));
  return snapshot.exists();
}

export async function listPortfolio(uid) {
  const snapshot = await getDocs(
    query(collection(db, "developers", uid, "portfolio"), orderBy("shippedAt", "desc"), limit(100)),
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
