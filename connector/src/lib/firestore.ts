// Firestore + Firebase Auth over plain REST. No Firebase SDK: the connector is stateless and runs on Vercel.
// The connector acts as a normal signed-in Firebase user, so firestore.rules stay the security boundary.
import { UpstreamError } from "./http.js";

const EMULATOR = process.env.FIREBASE_EMULATOR === "1";
const API_KEY = process.env.FIREBASE_API_KEY ?? "AIzaSyDYzzTJIcnceHrnJlROrDyGRt0FtM0oeog"; // public web key, not a secret
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? (EMULATOR ? "demo-apprequest" : "code-req");
const AUTH_BASE = EMULATOR
  ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
  : "https://identitytoolkit.googleapis.com/v1";
const FS_ROOT = EMULATOR ? "http://127.0.0.1:8080/v1" : "https://firestore.googleapis.com/v1";
const DB = `projects/${PROJECT}/databases/(default)/documents`;
const TIMEOUT_MS = 12000;

export type Doc = { id: string; [k: string]: unknown };
/** Marker for "set to the server's request time" (matches `request.time` in firestore.rules). */
export const SERVER_TIME = Symbol("serverTime");

// ---------- value codec ----------

function encode(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
}
function encodeFields(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(o)
      .filter(([, x]) => x !== SERVER_TIME)
      .map(([k, x]) => [k, encode(x)]),
  );
}
function decode(v: any): unknown {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}
function decodeFields(f: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, x]) => [k, decode(x)]));
}
function toDoc(d: any): Doc {
  return { id: String(d.name).split("/").pop() as string, ...decodeFields(d.fields ?? {}) };
}

// ---------- auth ----------

type Session = { idToken: string; uid: string; email: string; expires: number };
let session: Session | null = null;

export const developerConfigured = () => Boolean(process.env.DEV_EMAIL && process.env.DEV_PASSWORD);

async function post(url: string, body: unknown, token?: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new UpstreamError(
      `Firebase is unreachable (${e instanceof Error ? e.message : String(e)}).`,
      "Firebase",
    );
  }
  return handle(res);
}

async function handle(res: Response): Promise<any> {
  const body: any = await res.json().catch(() => ({}));
  if (res.ok) return body;
  const msg: string = body?.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 403 || body?.error?.status === "PERMISSION_DENIED")
    throw new UpstreamError(
      "Firestore rules denied this action (not allowed for this account, or the request is in a state that does not allow it).",
      "Firestore",
      403,
    );
  if (res.status === 404) throw new UpstreamError("Not found.", "Firestore", 404);
  if (res.status === 429)
    throw new UpstreamError("Firebase rate limit reached. Try again in a minute.", "Firebase", 429);
  throw new UpstreamError(`Firebase error: ${msg}`, "Firebase", res.status);
}

/** Signs in as the developer account configured in DEV_EMAIL / DEV_PASSWORD. Cached while the token is valid. */
export async function developer(): Promise<Session> {
  if (!developerConfigured())
    throw new UpstreamError(
      "Developer actions are not configured on this connector: set DEV_EMAIL and DEV_PASSWORD (a Firebase email/password developer account).",
      "Connector",
    );
  if (session && session.expires > Date.now() + 60_000) return session;
  const email = process.env.DEV_EMAIL as string;
  let data: any;
  try {
    data = await post(
      `${AUTH_BASE}/accounts:signInWithPassword?key=${EMULATOR ? "fake" : API_KEY}`,
      {
        email,
        password: process.env.DEV_PASSWORD,
        returnSecureToken: true,
      },
    );
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 400)
      throw new UpstreamError(
        "Developer sign-in failed: wrong DEV_EMAIL / DEV_PASSWORD, or email/password sign-in is not enabled for that account.",
        "Firebase Auth",
        400,
      );
    throw e;
  }
  session = {
    idToken: data.idToken,
    uid: data.localId,
    email,
    expires: Date.now() + Number(data.expiresIn ?? 3600) * 1000,
  };
  return session;
}

// ---------- reads ----------

const authHeader = (token?: string): Record<string, string> =>
  token ? { authorization: `Bearer ${token}` } : {};
const keyQuery = EMULATOR ? "" : `key=${encodeURIComponent(API_KEY)}`;

export async function getDoc(path: string, token?: string): Promise<Doc | null> {
  let res: Response;
  try {
    res = await fetch(`${FS_ROOT}/${DB}/${path}${keyQuery ? `?${keyQuery}` : ""}`, {
      headers: authHeader(token),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new UpstreamError(
      `Firestore is unreachable (${e instanceof Error ? e.message : String(e)}).`,
      "Firestore",
    );
  }
  if (res.status === 404) return null;
  return toDoc(await handle(res));
}

export type Filter = [field: string, op: "EQUAL", value: unknown];

/** Query a collection. `parent` is a document path for subcollections (e.g. "requests/abc"). */
export async function query(opts: {
  collection: string;
  parent?: string;
  where?: Filter[];
  orderBy?: [string, "ASCENDING" | "DESCENDING"];
  limit?: number;
  token?: string;
}): Promise<Doc[]> {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: opts.collection }] };
  if (opts.where?.length)
    structuredQuery.where = {
      compositeFilter: {
        op: "AND",
        filters: opts.where.map(([f, op, v]) => ({
          fieldFilter: { field: { fieldPath: f }, op, value: encode(v) },
        })),
      },
    };
  if (opts.orderBy)
    structuredQuery.orderBy = [
      { field: { fieldPath: opts.orderBy[0] }, direction: opts.orderBy[1] },
    ];
  if (opts.limit) structuredQuery.limit = opts.limit;
  const base = `${FS_ROOT}/${DB}${opts.parent ? `/${opts.parent}` : ""}:runQuery${keyQuery ? `?${keyQuery}` : ""}`;
  const rows: any[] = await post(base, { structuredQuery }, opts.token);
  return rows.filter((r) => r.document).map((r) => toDoc(r.document));
}

// ---------- writes (one atomic commit, like a client batch) ----------

export type Write =
  | { op: "set"; path: string; data: Record<string, unknown> }
  | { op: "update"; path: string; data: Record<string, unknown> }
  | { op: "delete"; path: string };

export async function commit(writes: Write[], token?: string): Promise<void> {
  const body = {
    writes: writes.map((w) => {
      const name = `${DB}/${w.path}`;
      if (w.op === "delete") return { delete: name };
      const stamps = Object.entries(w.data)
        .filter(([, v]) => v === SERVER_TIME)
        .map(([k]) => k);
      const plain = Object.keys(w.data).filter((k) => w.data[k] !== SERVER_TIME);
      const out: Record<string, unknown> = { update: { name, fields: encodeFields(w.data) } };
      if (w.op === "update") {
        out.updateMask = { fieldPaths: plain };
        out.currentDocument = { exists: true };
      }
      if (stamps.length)
        out.updateTransforms = stamps.map((fieldPath) => ({
          fieldPath,
          setToServerValue: "REQUEST_TIME",
        }));
      return out;
    }),
  };
  await post(`${FS_ROOT}/${DB}:commit${keyQuery ? `?${keyQuery}` : ""}`, body, token);
}

/** A fresh Firestore-style id for new documents. */
export function newId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
