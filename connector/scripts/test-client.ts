// Runs a full scenario through a real MCP client and calls EVERY tool. Usage: npm test [-- <url>]
// It WRITES data, so run it only against the Firebase Emulator Suite (npm run emulators in the repo root),
// with the server started like: FIREBASE_EMULATOR=1 DEV_EMAIL=dev@example.com DEV_PASSWORD=test-pass-123 MCP_SECRET=test npm run dev
// Fails (exit 1) on errors, empty output, or any registered tool missing from the scenario.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] ?? "http://localhost:3000/mcp?key=test";
if (process.env.FIREBASE_EMULATOR !== "1") {
  console.error(
    "Refusing to run: set FIREBASE_EMULATOR=1 in this shell too (this scenario writes data; use the emulator only).",
  );
  process.exit(2);
}
const email = process.env.DEV_EMAIL ?? "dev@example.com";
const password = process.env.DEV_PASSWORD ?? "test-pass-123";
// Create the developer account in the Auth emulator (ignore "already exists").
await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});

const client = new Client({ name: "apprequest-test", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const called = new Set<string>();
let bad = 0;
let last = "";
async function run(
  name: string,
  args: Record<string, unknown>,
  expectError = false,
): Promise<string> {
  called.add(name);
  const t0 = Date.now();
  const r: any = await client.callTool({ name, arguments: args });
  const txt: string = r.content?.map((c: any) => c.text).join("\n") ?? "";
  const wrong = expectError ? !r.isError : r.isError || txt.trim().length < 5;
  if (wrong) bad++;
  console.log(
    `\n=== ${name} ${JSON.stringify(args).slice(0, 110)} — ${Date.now() - t0}ms ${wrong ? "UNEXPECTED" : expectError ? "error as expected" : "ok"} ===`,
  );
  console.log(process.env.FULL ? txt : txt.split("\n").slice(0, 8).join("\n"));
  last = txt;
  return txt;
}

const tools = await client.listTools();
console.log(`Connected. ${tools.tools.length} tools: ${tools.tools.map((t) => t.name).join(", ")}`);

const name = `dev${Date.now().toString(36)}`;
await run("app_guide", {});
await run("create_developer_profile", {
  username: name,
  displayName: "Test Dev",
  bio: "Testing",
  acceptedPlatforms: ["web", "android"],
  usesAi: true,
});
await run("get_my_profile", {});
await run("update_profile", { bio: "Updated bio", pricingNote: "From $100", usesAi: false });
await run("update_profile", { acceptingRequests: false });
await run(
  "create_request",
  {
    username: name,
    requesterName: "Dana",
    title: "Blocked",
    appName: "Nope",
    appDescription: "Should be refused while paused",
    platforms: ["web"],
  },
  true,
);
await run("update_profile", { acceptingRequests: true });
await run("list_developers", { limit: 50 });
await run("get_developer", { username: name });

const created = await run("create_request", {
  username: name,
  requesterName: "Dana",
  title: "Recipe tracker",
  appName: "Cookbook",
  appDescription: "Track recipes and shopping lists.",
  platforms: ["web"],
  template: "tool",
  budgetMin: 100,
  budgetMax: 300,
  contact: { channel: "email", email: "dana@example.com" },
});
const id = created.match(/ID: ([A-Za-z0-9]+)/)?.[1];
if (!id) throw new Error("create_request did not return an ID");
await run(
  "create_request",
  {
    username: name,
    requesterName: "Dana",
    title: "Bad platform",
    appName: "Nope",
    appDescription: "Platform is not accepted",
    platforms: ["ios"],
  },
  true,
);
await run("get_request", { requestId: id });
await run("edit_request", {
  requestId: id,
  appDescription: "Track recipes, shopping lists and meal plans.",
  budgetMin: 150,
  budgetMax: 350,
});
await run("save_contact", {
  requestId: id,
  channel: "phone",
  phone: "+972 50 123 4567",
  availability: "Evenings",
});
await run("send_message", { requestId: id, body: "Hi, can you add a dark mode?", as: "requester" });
await run("send_message", { requestId: id, body: "Sure, I can do that.", as: "developer" });
await run("get_thread", { requestId: id });
const thread = last;
const messageId = thread.match(/\{id:([A-Za-z0-9]+)\}/)?.[1];
await run("list_my_requests", {});
await run("list_my_requests", { status: "new" });
await run("save_notes", { requestId: id, internalNotes: "Good fit.", tags: ["web", "priority"] });
await run("get_request_private", { requestId: id });
await run("set_quote", { requestId: id, amount: "450", currency: "USD", timeline: "2 weeks" });
await run("set_request_status", { requestId: id, status: "in_progress" });
await run("set_request_status", { requestId: id, status: "done" });
await run("add_portfolio_item", { requestId: id, projectUrl: "https://example.com/cookbook" });
await run("get_developer", { username: name });
await run("remove_portfolio_item", { requestId: id });
if (messageId) await run("delete_message", { requestId: id, messageId });
await run("set_quote", { requestId: id, clear: true });
await run("report_developer", {
  username: name,
  reason: "Test report from the connector test suite",
});

const second = await run("create_request", {
  username: name,
  requesterName: "Eli",
  title: "Cancel me",
  appName: "Temp",
  appDescription: "A request that gets cancelled.",
  platforms: ["web"],
});
const id2 = second.match(/ID: ([A-Za-z0-9]+)/)?.[1] as string;
await run("cancel_request", { requestId: id2 });
await run("cancel_request", { requestId: id }, true);
await run("delete_request", { requestId: id2 });
await run("delete_request", { requestId: id });
await run("get_request", { requestId: id }, true);

const untested = tools.tools.filter((t) => !called.has(t.name)).map((t) => t.name);
console.log(`\nUntested tools: ${untested.join(", ") || "none"}. Problems: ${bad}`);
await client.close();
process.exit(bad || untested.length ? 1 : 0);
