import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "../firebase-sdk.js";
import { LIMITS } from "../domain/constants.js";
import { pickEditable } from "../domain/edits.js";
import { contactState } from "../domain/validation.js";
import { db } from "./firebase.js";

const BATCH_SIZE = 400;

function withId(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

// Firestore rejects undefined, so every optional field is written as null.
function contactPayload(contact) {
  return {
    email: contact.email,
    phone: contact.phone,
    channel: contact.channel,
    availability: contact.availability,
    updatedAt: serverTimestamp(),
  };
}

// values: validated request fields. contact: validated contact fields, or null when none were entered.
export async function createRequest({ developer, values, contact, requesterUid = null }) {
  const reference = doc(collection(db, "requests"));
  const state = contact ? contactState(contact) : { stored: false, hasContact: false };
  const batch = writeBatch(db);
  batch.set(reference, {
    developerUid: developer.uid,
    developerUsername: developer.username,
    ...pickEditable(values),
    status: "new",
    quote: null,
    lastMessageAt: null,
    hasContact: state.hasContact,
    requesterUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (state.stored) {
    batch.set(doc(db, "requests", reference.id, "private", "contact"), contactPayload(contact));
  }
  await batch.commit();
  return reference.id;
}

export async function getRequest(id) {
  const snapshot = await getDoc(doc(db, "requests", id));
  return snapshot.exists() ? withId(snapshot) : null;
}

// Requests submitted from this browser's anonymous session, newest first.
export async function listMyRequests(requesterUid) {
  const snapshot = await getDocs(
    query(
      collection(db, "requests"),
      where("requesterUid", "==", requesterUid),
      orderBy("createdAt", "desc"),
      limit(LIMITS.requestListMax),
    ),
  );
  return snapshot.docs.map(withId);
}

// Live list of the requests sent from this browser's session, newest first.
export function watchMyRequests(requesterUid, onChange, onError) {
  const mine = query(
    collection(db, "requests"),
    where("requesterUid", "==", requesterUid),
    orderBy("createdAt", "desc"),
    limit(LIMITS.requestListMax),
  );
  return onSnapshot(mine, (snapshot) => onChange(snapshot.docs.map(withId)), onError);
}

export function watchRequest(id, onChange, onError) {
  return onSnapshot(
    doc(db, "requests", id),
    (snapshot) => onChange(snapshot.exists() ? withId(snapshot) : null),
    onError,
  );
}

export function watchOwnRequests(uid, onChange, onError) {
  const requests = query(
    collection(db, "requests"),
    where("developerUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(LIMITS.requestListMax),
  );
  return onSnapshot(requests, (snapshot) => onChange(snapshot.docs.map(withId)), onError);
}

// The requester edits content. The notice in the thread lists the changed fields.
export async function saveEdits(id, values, changed) {
  const batch = writeBatch(db);
  batch.update(doc(db, "requests", id), { ...pickEditable(values), updatedAt: serverTimestamp() });
  if (changed.length > 0) {
    batch.set(doc(collection(db, "requests", id, "messages")), {
      authorRole: "requester",
      body: changed.join(","),
      kind: "edit",
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// notify is false for cancelled requests, because the rules reject messages on those.
export async function saveContact(id, contact, { notify }) {
  const state = contactState(contact);
  const batch = writeBatch(db);
  batch.set(doc(db, "requests", id, "private", "contact"), contactPayload(contact));
  batch.update(doc(db, "requests", id), {
    hasContact: state.hasContact,
    updatedAt: serverTimestamp(),
  });
  if (notify) {
    batch.set(doc(collection(db, "requests", id, "messages")), {
      authorRole: "requester",
      body: "",
      kind: "contact",
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// Only the developer can read this. Requesters get null.
export async function getPrivateContact(id) {
  try {
    const snapshot = await getDoc(doc(db, "requests", id, "private", "contact"));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    if (error.code === "permission-denied") return null;
    throw error;
  }
}

export function setRequestStatus(id, status) {
  return updateDoc(doc(db, "requests", id), { status, updatedAt: serverTimestamp() });
}

export function saveQuote(id, quote) {
  return updateDoc(doc(db, "requests", id), { quote, updatedAt: serverTimestamp() });
}

export function cancelRequest(id) {
  return updateDoc(doc(db, "requests", id), { status: "cancelled", updatedAt: serverTimestamp() });
}

export async function getPrivateNotes(id) {
  const snapshot = await getDoc(doc(db, "requests", id, "private", "notes"));
  return snapshot.exists() ? snapshot.data() : null;
}

export function saveNotes(id, { internalNotes, tags }) {
  return setDoc(doc(db, "requests", id, "private", "notes"), {
    internalNotes,
    tags,
    updatedAt: serverTimestamp(),
  });
}

async function deleteRefs(refs) {
  for (let index = 0; index < refs.length; index += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(index, index + BATCH_SIZE)) batch.delete(ref);
    await batch.commit();
  }
}

// Order matters. The private and message rules check the parent request, so the request goes last.
export async function deleteRequest(id) {
  const messages = await getDocs(collection(db, "requests", id, "messages"));
  await deleteRefs(messages.docs.map((item) => item.ref));
  await deleteRefs([
    doc(db, "requests", id, "private", "contact"),
    doc(db, "requests", id, "private", "notes"),
  ]);
  await deleteDoc(doc(db, "requests", id));
}
