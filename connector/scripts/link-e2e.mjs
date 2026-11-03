// Starts the dev server, runs the personal-link test, stops the server. Run inside the emulators:
//   firebase emulators:exec --only auth,firestore --project demo-apprequest "node connector/scripts/link-e2e.mjs"
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const env = { ...process.env, FIREBASE_EMULATOR: "1", PORT: "3342" };
const cwd = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const server = spawn("npx", ["tsx", "scripts/dev.ts"], { cwd, env, shell: true, stdio: "inherit" });
await sleep(8000);
const test = spawn("npx", ["tsx", "scripts/test-link.ts", "http://localhost:3342/mcp"], {
  cwd,
  env,
  shell: true,
  stdio: "inherit",
});
const code = await new Promise((resolve) => test.on("exit", resolve));
spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { shell: true });
process.exit(code ?? 1);
