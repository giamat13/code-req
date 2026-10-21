import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "../firebase-sdk.js";
import { LIMITS } from "../domain/constants.js";
import { db } from "./firebase.js";

export function watchMessages(requestId, onChange, onError) {
  const thread = query(
    collection(db, "requests", requestId, "messages"),
    orderBy("createdAt", "asc"),
    limit(LIMITS.threadMax),
  );
  return onSnapshot(
    thread,
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}

// The message and the thread timestamp are written in one batch, so the unread state stays correct.
export async function sendMessage(requestId, authorRole, body) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "requests", requestId, "messages")), {
    authorRole,
    body,
    kind: null,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "requests", requestId), { lastMessageAt: serverTimestamp() });
  await batch.commit();
}

export function deleteMessage(requestId, messageId) {
  return deleteDoc(doc(db, "requests", requestId, "messages", messageId));
}
