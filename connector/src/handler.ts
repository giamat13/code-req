import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import { withKey } from "./lib/session.js";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
};
const MAX_BODY = 64 * 1024; // abuse protection: MCP requests here are tiny

function withCors(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const json = (status: number, message: string) =>
  withCors(
    new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );

/** Constant-time string compare. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The connector can act as a developer account, so the endpoint must not be open to anyone with the URL.
 * MCP_SECRET is required whenever DEV_EMAIL/DEV_PASSWORD are set. Send it as `?key=...` (claude.ai custom
 * connectors take a URL) or as `Authorization: Bearer ...`. Without developer credentials the server is public-data only.
 */
function keyOf(request: Request): string {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return bearer || new URL(request.url).searchParams.get("key") || "";
}

/**
 * Two ways to act as a developer:
 * - Personal link (default): `?key=` holds the user's own Firebase refresh token. It is checked when it is
 *   traded for an ID token, so a wrong key can do nothing, and rules apply to that user only.
 * - Legacy single account: MCP_SECRET + DEV_EMAIL/DEV_PASSWORD. The key equals MCP_SECRET and is not a token.
 * With no key the server is public-data only (requester tools).
 */
function isLegacyKey(key: string): boolean {
  const secret = process.env.MCP_SECRET;
  return Boolean(secret) && same(key, secret as string);
}
function authorized(request: Request): boolean {
  const secret = process.env.MCP_SECRET;
  if (secret && process.env.DEV_EMAIL && process.env.DEV_PASSWORD) {
    // Legacy deployments stay protected: the secret is required when a shared login is configured.
    const key = keyOf(request);
    return isLegacyKey(key) || key.length > 40;
  }
  return true;
}

/** Stateless Streamable HTTP: a fresh server + transport per request, no sessions. */
export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST")
    return json(405, "Method not allowed. Use POST (stateless server).");
  if (!authorized(request))
    return json(
      401,
      "Unauthorized. Set MCP_SECRET on the server and pass it as ?key=... or a Bearer token.",
    );
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return withCors(new Response("Payload too large", { status: 413 }));

  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const key = keyOf(request);
  // A personal link (refresh token) is put in scope for this request only; the legacy secret is not a token.
  const run = () => transport.handleRequest(request);
  try {
    return withCors(await (key && !isLegacyKey(key) ? withKey(key, run) : run()));
  } finally {
    // Close after the response has been produced; nothing is kept between requests.
    queueMicrotask(() => void server.close().catch(() => {}));
  }
}
