// Deletes every document from the Firestore emulator. It refuses to run without an emulator host.
// Usage: npm run reset

const PROJECT_ID = "demo-apprequest";
const host = process.env.FIRESTORE_EMULATOR_HOST;

if (!host) {
  console.error(
    "FIRESTORE_EMULATOR_HOST is not set. Start the emulators with npm run emulators first.",
  );
  process.exit(1);
}

const url = `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const response = await fetch(url, { method: "DELETE" });
if (!response.ok) {
  console.error(`Reset failed with status ${response.status}.`);
  process.exit(1);
}
console.log(`Cleared every document in ${PROJECT_ID}.`);
