// Adds demo developers, requests, and messages to the Firestore emulator. It refuses to run against a real project.
// Usage: npm run emulators (in one terminal), then npm run seed (in another).

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, setDoc, Timestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";

const PROJECT_ID = "demo-apprequest";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [host, port] = EMULATOR_HOST.split(":");

// Demo project IDs start with "demo-", so this script can never touch a real Firebase project.
if (!PROJECT_ID.startsWith("demo-")) {
  console.error("Refusing to run: the project ID must be a demo project.");
  process.exit(1);
}

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules, host, port: Number(port) },
});

const now = () => Timestamp.fromMillis(Date.now() - Math.floor(Math.random() * 14) * 86_400_000);

const developers = [
  {
    uid: "demo-dev-alice",
    username: "alice",
    displayName: "Alice Cohen",
    bio: "I build small tools for teams that outgrew their spreadsheets.",
    website: "https://example.com/alice",
    pricingNote: "Projects from 1,500 USD",
    acceptedPlatforms: ["web", "android", "ios"],
  },
  {
    uid: "demo-dev-bob",
    username: "bob",
    displayName: "Bob Levi",
    bio: null,
    website: null,
    pricingNote: null,
    acceptedPlatforms: ["windows", "macos", "linux"],
  },
];

const requests = [
  {
    id: "demo-request-0001",
    developerUid: "demo-dev-alice",
    developerUsername: "alice",
    requesterName: "Dana Peretz",
    title: "Habit tracker for two",
    appName: "Habits Together",
    appDescription:
      "A shared habit tracker for couples. Each person sees the other's streak and can send a nudge.",
    platforms: ["ios", "android"],
    status: "new",
    template: "mobile",
    budgetRange: "500_2000",
    hasContact: true,
  },
  {
    id: "demo-request-0002",
    developerUid: "demo-dev-alice",
    developerUsername: "alice",
    requesterName: "Omer Shaked",
    title: "Invoice generator",
    appName: "QuickInvoice",
    appDescription: "Generate PDF invoices from a short form and keep a list of unpaid ones.",
    platforms: ["web"],
    status: "in_progress",
    template: "tool",
    budgetRange: "under_500",
    hasContact: false,
    quote: { amount: "900", currency: "USD", timeline: "3 weeks", validUntil: "2026-12-15" },
  },
  {
    id: "demo-request-0003",
    developerUid: "demo-dev-bob",
    developerUsername: "bob",
    requesterName: "Maya Adler",
    title: "Desktop timer",
    appName: "FocusBlock",
    appDescription: "A desktop timer that blocks distracting sites during focus sessions.",
    platforms: ["windows", "macos"],
    status: "new",
    template: "desktop",
    budgetRange: "unknown",
    hasContact: false,
  },
];

await testEnv.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();

  for (const developer of developers) {
    await setDoc(doc(db, "usernames", developer.username), {
      uid: developer.uid,
      createdAt: now(),
    });
    await setDoc(doc(db, "developers", developer.uid), {
      ...developer,
      avatarUrl: null,
      acceptingRequests: true,
      suspended: false,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  for (const request of requests) {
    const { id, ...fields } = request;
    await setDoc(doc(db, "requests", id), {
      ...fields,
      svgIcon: null,
      notes: null,
      deadline: null,
      quote: request.quote ?? null,
      lastMessageAt: now(),
      requesterUid: null,
      createdAt: now(),
      updatedAt: now(),
    });
    if (request.hasContact) {
      await setDoc(doc(db, "requests", id, "private", "contact"), {
        email: "dana@example.com",
        phone: null,
        channel: "email",
        availability: "Weekdays after 5 pm",
        updatedAt: now(),
      });
    }
    await setDoc(doc(collection(db, "requests", id, "messages")), {
      authorRole: "requester",
      body: "Thanks for taking this on. Happy to answer questions.",
      kind: null,
      createdAt: now(),
    });
  }
});

await testEnv.cleanup();
console.log(
  `Seeded ${developers.length} developers and ${requests.length} requests into ${PROJECT_ID}.`,
);
console.log("Try: http://localhost:5000/developer.html?u=alice");
