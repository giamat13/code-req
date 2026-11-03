// Tests the personal-link sign-in against the emulators. Start the server WITHOUT DEV_EMAIL / DEV_PASSWORD:
//   FIREBASE_EMULATOR=1 PORT=3342 npm run dev
// then: FIREBASE_EMULATOR=1 npx tsx scripts/test-link.ts http://localhost:3342/mcp
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

if (process.env.FIREBASE_EMULATOR !== "1") {
  console.log("Refusing to run: set FIREBASE_EMULATOR=1 (this script creates an account).");
  process.exit(1);
}
const base = process.argv[2] ?? "http://localhost:3342/mcp";

const signUp = await fetch(
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `link-${Date.now()}@example.com`,
      password: "test-pass-123",
      returnSecureToken: true,
    }),
  },
);
const { refreshToken } = (await signUp.json()) as { refreshToken: string };

async function call(key: string, name: string): Promise<{ text: string; isError: boolean }> {
  const client = new Client({ name: "link-test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL(`${base}${key ? `?key=${encodeURIComponent(key)}` : ""}`),
    ),
  );
  const r: any = await client.callTool({ name, arguments: {} });
  await client.close();
  return { text: r.content?.map((c: any) => c.text).join("\n") ?? "", isError: Boolean(r.isError) };
}

let bad = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}\n     ${detail.split("\n")[0].slice(0, 160)}`);
}

const guide = await call(refreshToken, "app_guide");
check(
  "valid link: connected",
  /Connected/.test(guide.text),
  guide.text.match(/Developer actions.*/)?.[0] ?? guide.text,
);
const mine = await call(refreshToken, "get_my_profile");
check("valid link: acts as the user", !mine.isError, mine.text);
const wrong = await call("x".repeat(60), "get_my_profile");
check("wrong key: refused", wrong.isError, wrong.text);
const none = await call("", "app_guide");
check(
  "no key: public mode only",
  /Not connected/.test(none.text),
  none.text.match(/Developer actions.*/)?.[0] ?? none.text,
);

console.log(`\nProblems: ${bad}`);
process.exit(bad ? 1 : 0);
