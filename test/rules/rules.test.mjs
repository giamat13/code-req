// Firestore rules tests. They run against the Firestore emulator (npm run test:rules), which sets
// FIRESTORE_EMULATOR_HOST. Every allow and deny path in firestore.rules should appear here.

import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const DEV = "dev-alice";
const OTHER = "dev-bob";
const ADMIN = "admin-1";
const ANON = "anon-dana";
const REQ = "req00000000000000001";
const NEW_REQ = "req00000000000000002";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-apprequest",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const signedIn = (uid, provider = "google.com") =>
  testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore();
const anonymous = (uid = ANON) => signedIn(uid, "anonymous");
const guest = () => testEnv.unauthenticatedContext().firestore();

function developer(overrides = {}) {
  return {
    username: "alice",
    displayName: "Alice",
    bio: null,
    website: null,
    pricingNote: null,
    avatarUrl: null,
    acceptedPlatforms: ["web", "ios"],
    acceptingRequests: true,
    suspended: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    developerUid: DEV,
    developerUsername: "alice",
    requesterName: "Dana",
    title: "Habit tracker",
    appName: "Habits",
    appDescription: "Track daily habits every morning.",
    platforms: ["web"],
    svgIcon: null,
    notes: null,
    template: null,
    budgetMin: null,
    budgetMax: null,
    deadline: null,
    status: "new",
    quote: null,
    lastMessageAt: null,
    hasContact: true,
    requesterUid: ANON,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

function contact(overrides = {}) {
  return {
    email: "dana@example.com",
    phone: null,
    channel: "email",
    availability: null,
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

async function seed({ suspended = false, accepting = true, status = "new" } = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "usernames", "alice"), { uid: DEV, createdAt: Timestamp.now() });
    await setDoc(
      doc(db, "developers", DEV),
      developer({ suspended, acceptingRequests: accepting }),
    );
    await setDoc(doc(db, "usernames", "bob"), { uid: OTHER, createdAt: Timestamp.now() });
    await setDoc(doc(db, "developers", OTHER), developer({ username: "bob", displayName: "Bob" }));
    await setDoc(doc(db, "platformAdmins", ADMIN), { email: "admin@example.com" });
    await setDoc(doc(db, "requests", REQ), request({ status }));
    await setDoc(doc(db, "requests", REQ, "private", "contact"), contact());
    await setDoc(doc(db, "requests", REQ, "messages", "m1"), {
      authorRole: "developer",
      body: "Hello",
      kind: null,
      createdAt: Timestamp.now(),
    });
  });
}

// A new request as the client writes it. Every key is present, and empty optional values are null.
function clientRequest(overrides = {}) {
  return {
    developerUid: DEV,
    developerUsername: "alice",
    requesterName: "Dana",
    title: "Habit tracker",
    appName: "Habits",
    appDescription: "Track daily habits every morning.",
    platforms: ["web"],
    svgIcon: null,
    notes: null,
    template: null,
    budgetMin: null,
    budgetMax: null,
    deadline: null,
    status: "new",
    quote: null,
    lastMessageAt: null,
    hasContact: false,
    requesterUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

const message = (overrides = {}) => ({
  authorRole: "requester",
  body: "Can you add dark mode?",
  kind: null,
  createdAt: serverTimestamp(),
  ...overrides,
});

describe("default deny", () => {
  test("paths that no rule matches are rejected", async () => {
    await assertFails(setDoc(doc(signedIn(DEV), "secrets", "x"), { a: 1 }));
  });
});

describe("usernames and developer profiles", () => {
  test("a signed-in account can claim a free username for itself", async () => {
    await assertSucceeds(
      setDoc(doc(signedIn("carol-uid"), "usernames", "carol"), {
        uid: "carol-uid",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("an anonymous session cannot claim a username", async () => {
    await assertFails(
      setDoc(doc(anonymous("anon-x"), "usernames", "anonx"), {
        uid: "anon-x",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("a username cannot be claimed for another account", async () => {
    await assertFails(
      setDoc(doc(signedIn("carol-uid"), "usernames", "dave"), {
        uid: "dave-uid",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("a reserved username cannot be claimed", async () => {
    await assertFails(
      setDoc(doc(signedIn("carol-uid"), "usernames", "admin"), {
        uid: "carol-uid",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(signedIn("carol-uid"), "usernames", "code-req"), {
        uid: "carol-uid",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("an account that already has a profile cannot claim a second username", async () => {
    await seed();
    await assertFails(
      setDoc(doc(signedIn(DEV), "usernames", "alice2"), { uid: DEV, createdAt: serverTimestamp() }),
    );
  });

  test("a developer profile can be created after its username is claimed", async () => {
    await setDoc(doc(signedIn("carol-uid"), "usernames", "carol"), {
      uid: "carol-uid",
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(
      setDoc(doc(signedIn("carol-uid"), "developers", "carol-uid"), {
        username: "carol",
        displayName: "Carol",
        bio: null,
        website: null,
        pricingNote: null,
        avatarUrl: null,
        acceptedPlatforms: ["web"],
        acceptingRequests: true,
        suspended: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a profile cannot be created without a claimed username", async () => {
    await assertFails(
      setDoc(doc(signedIn("carol-uid"), "developers", "carol-uid"), {
        username: "carol",
        displayName: "Carol",
        bio: null,
        website: null,
        pricingNote: null,
        avatarUrl: null,
        acceptedPlatforms: ["web"],
        acceptingRequests: true,
        suspended: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("an owner can update the display name", async () => {
    await seed();
    await assertSucceeds(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        displayName: "Alice B.",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("an owner can set the AI flag to a boolean, but not to anything else", async () => {
    await seed();
    await assertSucceeds(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        usesAi: true,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        usesAi: "yes",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("an owner cannot change the username", async () => {
    await seed();
    await assertFails(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        username: "alicia",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("an owner cannot lift their own suspension", async () => {
    await seed({ suspended: true, accepting: false });
    await assertFails(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        suspended: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a platform admin can suspend a developer", async () => {
    await seed();
    await assertSucceeds(
      updateDoc(doc(signedIn(ADMIN), "developers", DEV), {
        suspended: true,
        acceptingRequests: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a regular developer cannot suspend another developer", async () => {
    await seed();
    await assertFails(
      updateDoc(doc(signedIn(OTHER), "developers", DEV), {
        suspended: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a suspended profile is hidden from anonymous visitors", async () => {
    await seed({ suspended: true, accepting: false });
    await assertFails(getDoc(doc(guest(), "developers", DEV)));
    await assertSucceeds(getDoc(doc(signedIn(DEV), "developers", DEV)));
  });

  test("the directory query may list only developers who are not suspended", async () => {
    await seed();
    await assertSucceeds(
      getDocs(query(collection(guest(), "developers"), where("suspended", "==", false))),
    );
    await assertFails(getDocs(collection(guest(), "developers")));
  });
});

describe("creating requests", () => {
  beforeEach(seed);

  test("an anonymous visitor can send a valid request", async () => {
    await assertSucceeds(setDoc(doc(guest(), "requests", NEW_REQ), clientRequest()));
  });

  test("a platform the developer does not build for is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ platforms: ["windows"] })),
    );
  });

  test("a suspended developer receives no requests", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "developers", DEV),
        developer({ suspended: true, acceptingRequests: false }),
      );
    });
    await assertFails(setDoc(doc(guest(), "requests", NEW_REQ), clientRequest()));
  });

  test("a developer who stopped accepting requests receives none", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "developers", DEV),
        developer({ acceptingRequests: false }),
      );
    });
    await assertFails(setDoc(doc(guest(), "requests", NEW_REQ), clientRequest()));
  });

  test("a request must start as new", async () => {
    await assertFails(setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ status: "done" })));
  });

  test("a request cannot arrive with a quote", async () => {
    await assertFails(
      setDoc(
        doc(guest(), "requests", NEW_REQ),
        clientRequest({
          quote: { amount: "1", currency: "USD", timeline: null, validUntil: null },
        }),
      ),
    );
  });

  test("a description that is too short is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ appDescription: "short" })),
    );
  });

  test("an SVG that is not an SVG document is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ svgIcon: "<div>not svg</div>" })),
    );
  });

  test("a well-formed SVG string is accepted", async () => {
    await assertSucceeds(
      setDoc(
        doc(guest(), "requests", NEW_REQ),
        clientRequest({ svgIcon: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }),
      ),
    );
  });

  test("an extra field is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), { ...clientRequest(), isAdmin: true }),
    );
  });

  test("a missing field is rejected", async () => {
    const data = clientRequest();
    delete data.notes;
    await assertFails(setDoc(doc(guest(), "requests", NEW_REQ), data));
  });

  test("the developer username must match the developer", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ developerUsername: "bob" })),
    );
  });

  test("requesterUid must match the signed-in account", async () => {
    await assertSucceeds(
      setDoc(
        doc(anonymous("anon-y"), "requests", NEW_REQ),
        clientRequest({ requesterUid: "anon-y" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(anonymous("anon-y"), "requests", "req00000000000000003"),
        clientRequest({ requesterUid: "someone-else" }),
      ),
    );
    await assertFails(
      setDoc(
        doc(guest(), "requests", "req00000000000000004"),
        clientRequest({ requesterUid: "anon-y" }),
      ),
    );
  });

  test("a contact document can be written in the same batch as its request", async () => {
    const db = guest();
    const { writeBatch } = await import("firebase/firestore");
    const batch = writeBatch(db);
    batch.set(doc(db, "requests", NEW_REQ), clientRequest({ hasContact: true }));
    batch.set(doc(db, "requests", NEW_REQ, "private", "contact"), {
      email: "dana@example.com",
      phone: null,
      channel: "email",
      availability: null,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });
});

describe("reading requests", () => {
  beforeEach(seed);

  test("anyone with the ID can read that request", async () => {
    await assertSucceeds(getDoc(doc(guest(), "requests", REQ)));
  });

  test("anonymous visitors cannot list requests", async () => {
    await assertFails(getDocs(collection(guest(), "requests")));
  });

  test("a developer can list the requests sent to them", async () => {
    await assertSucceeds(
      getDocs(query(collection(signedIn(DEV), "requests"), where("developerUid", "==", DEV))),
    );
  });

  test("a developer cannot list another developer's requests", async () => {
    await assertFails(
      getDocs(query(collection(signedIn(OTHER), "requests"), where("developerUid", "==", DEV))),
    );
  });

  test("a requester can list the requests they sent from their session", async () => {
    await assertSucceeds(
      getDocs(query(collection(anonymous(ANON), "requests"), where("requesterUid", "==", ANON))),
    );
  });
});

describe("editing requests", () => {
  beforeEach(seed);

  test("the developer can move a request to in progress", async () => {
    await assertSucceeds(
      updateDoc(doc(signedIn(DEV), "requests", REQ), {
        status: "in_progress",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the developer cannot change the title", async () => {
    await assertFails(
      updateDoc(doc(signedIn(DEV), "requests", REQ), {
        title: "Changed",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("another developer cannot change the status", async () => {
    await assertFails(
      updateDoc(doc(signedIn(OTHER), "requests", REQ), {
        status: "done",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the developer can send a quote", async () => {
    await assertSucceeds(
      updateDoc(doc(signedIn(DEV), "requests", REQ), {
        quote: { amount: "450", currency: "USD", timeline: "2 weeks", validUntil: "2026-12-01" },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a quote with a bad currency code is rejected", async () => {
    await assertFails(
      updateDoc(doc(signedIn(DEV), "requests", REQ), {
        quote: { amount: "450", currency: "dollars", timeline: null, validUntil: null },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester can edit content while the request is new", async () => {
    await assertSucceeds(
      updateDoc(doc(anonymous(), "requests", REQ), {
        title: "Habit tracker v2",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester can still edit while work is in progress", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "requests", REQ), { status: "in_progress" });
    });
    await assertSucceeds(
      updateDoc(doc(anonymous(), "requests", REQ), {
        notes: "Please add a streak counter.",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester cannot edit once the request is done", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "requests", REQ), { status: "done" });
    });
    await assertFails(
      updateDoc(doc(anonymous(), "requests", REQ), {
        title: "Too late",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester cannot pick a platform the developer does not build for", async () => {
    await assertFails(
      updateDoc(doc(anonymous(), "requests", REQ), {
        platforms: ["windows"],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester cannot move the developer or the status through an edit", async () => {
    await assertFails(
      updateDoc(doc(anonymous(), "requests", REQ), {
        developerUid: OTHER,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(anonymous(), "requests", REQ), {
        status: "done",
        title: "x",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester can cancel a new request", async () => {
    await assertSucceeds(
      updateDoc(doc(anonymous(), "requests", REQ), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester cannot cancel a request that is in progress", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "requests", REQ), { status: "in_progress" });
    });
    await assertFails(
      updateDoc(doc(anonymous(), "requests", REQ), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the requester can record contact details at any status", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "requests", REQ), { status: "done" });
    });
    await assertSucceeds(
      updateDoc(doc(anonymous(), "requests", REQ), {
        hasContact: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a thread timestamp can be bumped by anyone with the ID", async () => {
    await assertSucceeds(
      updateDoc(doc(guest(), "requests", REQ), { lastMessageAt: serverTimestamp() }),
    );
  });

  test("only the developer can delete a request", async () => {
    await assertFails(deleteDoc(doc(anonymous(), "requests", REQ)));
    await assertSucceeds(deleteDoc(doc(signedIn(DEV), "requests", REQ)));
  });
});

describe("contact details and private notes", () => {
  beforeEach(seed);

  test("a requester can save contact details", async () => {
    await assertSucceeds(
      setDoc(
        doc(guest(), "requests", REQ, "private", "contact"),
        contact({ phone: "+972 50 123 4567", channel: "phone", updatedAt: serverTimestamp() }),
      ),
    );
  });

  test("a requester cannot read the saved contact details back", async () => {
    await assertFails(getDoc(doc(anonymous(), "requests", REQ, "private", "contact")));
  });

  test("the developer can read the contact details", async () => {
    await assertSucceeds(getDoc(doc(signedIn(DEV), "requests", REQ, "private", "contact")));
  });

  test("another developer cannot read the contact details", async () => {
    await assertFails(getDoc(doc(signedIn(OTHER), "requests", REQ, "private", "contact")));
  });

  test("an invalid email is rejected", async () => {
    await assertFails(
      setDoc(
        doc(guest(), "requests", REQ, "private", "contact"),
        contact({ email: "not-an-email", updatedAt: serverTimestamp() }),
      ),
    );
  });

  test("an unknown channel is rejected", async () => {
    await assertFails(
      setDoc(
        doc(guest(), "requests", REQ, "private", "contact"),
        contact({ channel: "carrier-pigeon", updatedAt: serverTimestamp() }),
      ),
    );
  });

  test("a requester cannot write private notes", async () => {
    await assertFails(
      setDoc(doc(anonymous(), "requests", REQ, "private", "notes"), {
        internalNotes: "x",
        tags: [],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("the developer can write notes with up to five tags", async () => {
    await assertSucceeds(
      setDoc(doc(signedIn(DEV), "requests", REQ, "private", "notes"), {
        internalNotes: "Call on Monday",
        tags: ["a", "b"],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(signedIn(DEV), "requests", REQ, "private", "notes"), {
        internalNotes: "x",
        tags: ["a", "b", "c", "d", "e", "f"],
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe("messages", () => {
  beforeEach(seed);

  test("a requester can post to an open request", async () => {
    await assertSucceeds(addDoc(collection(guest(), "requests", REQ, "messages"), message()));
  });

  test("a requester cannot post to a cancelled request", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "requests", REQ), { status: "cancelled" });
    });
    await assertFails(addDoc(collection(guest(), "requests", REQ, "messages"), message()));
  });

  test("the developer can reply", async () => {
    await assertSucceeds(
      addDoc(
        collection(signedIn(DEV), "requests", REQ, "messages"),
        message({ authorRole: "developer", body: "Sure." }),
      ),
    );
  });

  test("a requester cannot post as the developer", async () => {
    await assertFails(
      addDoc(
        collection(guest(), "requests", REQ, "messages"),
        message({ authorRole: "developer" }),
      ),
    );
  });

  test("an empty message is rejected", async () => {
    await assertFails(
      addDoc(collection(guest(), "requests", REQ, "messages"), message({ body: "" })),
    );
  });

  test("an edit notice can only come from the requester", async () => {
    await assertSucceeds(
      addDoc(
        collection(guest(), "requests", REQ, "messages"),
        message({ kind: "edit", body: "title,notes" }),
      ),
    );
    await assertFails(
      addDoc(
        collection(signedIn(DEV), "requests", REQ, "messages"),
        message({ authorRole: "developer", kind: "edit", body: "title" }),
      ),
    );
  });

  test("a contact notice carries no details", async () => {
    await assertSucceeds(
      addDoc(
        collection(guest(), "requests", REQ, "messages"),
        message({ kind: "contact", body: "" }),
      ),
    );
  });

  test("the developer can delete a message, the requester cannot", async () => {
    await assertFails(deleteDoc(doc(guest(), "requests", REQ, "messages", "m1")));
    await assertSucceeds(deleteDoc(doc(signedIn(DEV), "requests", REQ, "messages", "m1")));
  });
});

describe("portfolio", () => {
  beforeEach(seed);

  test("the developer can add a finished request to the portfolio", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "requests", REQ), { status: "done" });
    });
    await assertSucceeds(
      setDoc(doc(signedIn(DEV), "developers", DEV, "portfolio", REQ), {
        title: "Habit tracker",
        appName: "Habits",
        platforms: ["web"],
        svgIcon: null,
        projectUrl: "https://habits.example",
        shippedAt: serverTimestamp(),
      }),
    );
  });

  test("an unfinished request cannot be added", async () => {
    await assertFails(
      setDoc(doc(signedIn(DEV), "developers", DEV, "portfolio", REQ), {
        title: "Habit tracker",
        appName: "Habits",
        platforms: ["web"],
        svgIcon: null,
        projectUrl: null,
        shippedAt: serverTimestamp(),
      }),
    );
  });

  test("anyone can read the portfolio", async () => {
    await assertSucceeds(getDocs(collection(guest(), "developers", DEV, "portfolio")));
  });
});

describe("custom platforms and the free budget", () => {
  beforeEach(seed);

  test("a developer can accept a platform of their own", async () => {
    await assertSucceeds(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        acceptedPlatforms: ["web", "Apple Watch"],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a request can use a platform the developer accepts, including one of their own", async () => {
    await updateDoc(doc(signedIn(DEV), "developers", DEV), {
      acceptedPlatforms: ["web", "Apple Watch"],
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ platforms: ["Apple Watch"] })),
    );
  });

  test("a platform the developer no longer accepts is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ platforms: ["Apple Watch"] })),
    );
  });

  test("a developer cannot accept more than twenty platforms", async () => {
    const many = Array.from({ length: 21 }, (_, index) => `Device ${index}`);
    await assertFails(
      updateDoc(doc(signedIn(DEV), "developers", DEV), {
        acceptedPlatforms: many,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("a free budget, written as 0 to 0, is accepted", async () => {
    await assertSucceeds(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ budgetMin: 0, budgetMax: 0 })),
    );
  });

  test("a budget range is accepted", async () => {
    await assertSucceeds(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ budgetMin: 500, budgetMax: 2000 })),
    );
  });

  test("a budget with only one end is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ budgetMin: 500, budgetMax: null })),
    );
  });

  test("a budget whose top is below its bottom is rejected", async () => {
    await assertFails(
      setDoc(doc(guest(), "requests", NEW_REQ), clientRequest({ budgetMin: 2000, budgetMax: 500 })),
    );
  });

  test("a budget that is not a whole number is rejected", async () => {
    await assertFails(
      setDoc(
        doc(guest(), "requests", NEW_REQ),
        clientRequest({ budgetMin: 500.5, budgetMax: 900 }),
      ),
    );
  });
});

describe("reports and audit log", () => {
  beforeEach(seed);

  test("anyone can report a developer with a clear reason", async () => {
    await assertSucceeds(
      addDoc(collection(guest(), "reports"), {
        targetUid: DEV,
        reason: "Sends spam requests",
        status: "open",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("a report needs a real reason", async () => {
    await assertFails(
      addDoc(collection(guest(), "reports"), {
        targetUid: DEV,
        reason: "bad",
        status: "open",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("reports are readable by platform admins only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await addDoc(collection(context.firestore(), "reports"), {
        targetUid: DEV,
        reason: "Sends spam requests",
        status: "open",
        createdAt: Timestamp.now(),
      });
    });
    await assertFails(getDocs(collection(signedIn(DEV), "reports")));
    await assertSucceeds(getDocs(collection(signedIn(ADMIN), "reports")));
  });

  test("an admin can write an audit entry in their own name", async () => {
    await assertSucceeds(
      addDoc(collection(signedIn(ADMIN), "auditLog"), {
        actorUid: ADMIN,
        action: "suspend",
        targetUid: DEV,
        note: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("an audit entry cannot name someone else as the actor", async () => {
    await assertFails(
      addDoc(collection(signedIn(ADMIN), "auditLog"), {
        actorUid: DEV,
        action: "suspend",
        targetUid: DEV,
        note: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("a regular developer cannot write audit entries", async () => {
    await assertFails(
      addDoc(collection(signedIn(DEV), "auditLog"), {
        actorUid: DEV,
        action: "suspend",
        targetUid: OTHER,
        note: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("the admin list is readable only by its owner", async () => {
    await assertSucceeds(getDoc(doc(signedIn(ADMIN), "platformAdmins", ADMIN)));
    await assertFails(getDoc(doc(guest(), "platformAdmins", ADMIN)));
  });
});
