// Deletes every document from the Firestore emulator. It refuses to run against anything but a demo project.
// Usage: npm run emulators (in one terminal), then npm run reset (in another).

const PROJECT_ID = "demo-apprequest";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

// Demo project IDs start with "demo-", so this script can never touch a real Firebase project.
if (!PROJECT_ID.startsWith("demo-")) {
  console.error("Refusing to run: the project ID must be a demo project.");
  process.exit(1);
}

const url = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let response;
try {
  response = await fetch(url, { method: "DELETE" });
} catch {
  console.error(
    `No emulator answered at ${EMULATOR_HOST}. Start the emulators with npm run emulators first.`,
  );
  process.exit(1);
}
if (!response.ok) {
  console.error(`Reset failed with status ${response.status}.`);
  process.exit(1);
}
console.log(`Cleared every document in ${PROJECT_ID}.`);
