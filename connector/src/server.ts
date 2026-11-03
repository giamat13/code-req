import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UpstreamError } from "./lib/http.js";
import {
  SERVER_TIME,
  commit,
  developer,
  developerAvailable,
  getDoc,
  newId,
  query,
  type Doc,
} from "./lib/firestore.js";
import { VIEW_CSP, VIEW_HTML, VIEW_MIME, VIEW_URI } from "./view.js";

// ---------- vocabulary (mirrors public/js/domain/constants.js and firestore.rules) ----------

const PLATFORMS = ["web", "windows", "macos", "linux", "android", "ios", "other"];
const STATUSES = ["new", "in_progress", "done", "declined", "cancelled"] as const;
const TEMPLATES = ["landing", "mobile", "tool", "extension", "desktop", "other"] as const;
const CHANNELS = ["email", "phone", "thread"] as const;
const EDITABLE = [
  "requesterName",
  "title",
  "appName",
  "appDescription",
  "platforms",
  "svgIcon",
  "notes",
  "template",
  "budgetMin",
  "budgetMax",
  "deadline",
] as const;
const SITE = (process.env.SITE_URL ?? "https://code-req.web.app").replace(/\/$/, "");
const SOURCE = "AppRequest (Firestore)";

// ---------- results ----------

type Out = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};
const text = (t: string): Out => ({ content: [{ type: "text", text: t }] });
const card = (t: string, data: Record<string, unknown>): Out => ({
  content: [{ type: "text", text: t }],
  structuredContent: data,
});
const fail = (t: string): Out => ({ content: [{ type: "text", text: t }], isError: true });
const UI_META = { ui: { resourceUri: VIEW_URI }, "ui/resourceUri": VIEW_URI };

const READ = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;
const WRITE = {
  readOnlyHint: false,
  idempotentHint: false,
  destructiveHint: false,
  openWorldHint: true,
} as const;
const IDEMPOTENT_WRITE = { ...WRITE, idempotentHint: true } as const;
const DESTROY = {
  readOnlyHint: false,
  idempotentHint: false,
  destructiveHint: true,
  openWorldHint: true,
} as const;

class UserError extends Error {}
function safe<A>(fn: (a: A) => Promise<Out>) {
  return async (a: A): Promise<Out> => {
    try {
      return await fn(a);
    } catch (e) {
      if (e instanceof UserError) return fail(`⚠️ ${e.message}`);
      if (e instanceof UpstreamError) return fail(`⚠️ ${e.message}`);
      return fail(`⚠️ Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
}

// ---------- input schemas ----------

const requestId = z
  .string()
  .regex(/^[A-Za-z0-9]{10,40}$/, "Request IDs are letters and digits only")
  .describe(
    "The request ID (the bearer token from the tracking link), e.g. 'k3Jd9sLq0aPzXw12MnBv'.",
  );
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/, "Usernames are lowercase letters, digits and hyphens")
  .describe("Developer username, e.g. 'giamat13'.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD.");
const platformList = z.array(z.string().trim().min(1).max(30)).min(1).max(20);

// ---------- shaping ----------

const day = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : undefined);
const pick = <T extends object>(o: T, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, (o as any)[k] ?? null]));
const call = (name: string, args: Record<string, unknown>) => ({ name, arguments: args });
const profileOut = (d: Doc) =>
  pick(d, [
    "username",
    "displayName",
    "bio",
    "website",
    "pricingNote",
    "avatarUrl",
    "acceptedPlatforms",
    "acceptingRequests",
    "usesAi",
    "suspended",
  ]);
const trackUrl = (id: string) => `${SITE}/track.html?r=${id}`;
const budgetText = (r: Doc) => (r.budgetMin != null ? `${r.budgetMin}–${r.budgetMax}` : undefined);

function requestRow(r: Doc) {
  return {
    icon: "📦",
    title: String(r.appName ?? r.title ?? r.id),
    sub: [r.title, `for ${r.requesterName}`, day(r.createdAt)].filter(Boolean).join(" · "),
    badge: String(r.status),
    call: call("get_request", { requestId: r.id }),
  };
}

async function maybeOwnerUid(): Promise<string | null> {
  if (!developerAvailable()) return null;
  try {
    return (await developer()).uid;
  } catch {
    return null;
  }
}

async function findDeveloper(name: string): Promise<Doc> {
  const claim = await getDoc(`usernames/${name}`);
  if (!claim) throw new UserError(`No developer with the username "${name}".`);
  const profile = await getDoc(`developers/${claim.uid}`).catch(() => null);
  if (!profile)
    throw new UserError(`The profile of "${name}" is not available (suspended or removed).`);
  return { ...profile, id: String(claim.uid), uid: claim.uid };
}

async function loadRequest(id: string, token?: string): Promise<Doc> {
  const r = await getDoc(`requests/${id}`, token);
  if (!r) throw new UserError("No request with this ID.");
  return r;
}

async function ownedRequest(id: string): Promise<{ r: Doc; token: string }> {
  const s = await developer();
  const r = await loadRequest(id, s.idToken);
  if (r.developerUid !== s.uid)
    throw new UserError(
      "This request belongs to a different developer than the one this connector is signed in as.",
    );
  return { r, token: s.idToken };
}

const messageDoc = (
  authorRole: "requester" | "developer",
  body: string,
  kind: string | null = null,
) => ({
  authorRole,
  body,
  kind,
  createdAt: SERVER_TIME,
});

export function createServer(): McpServer {
  const server = new McpServer({
    name: "apprequest",
    title: "AppRequest",
    version: "1.0.0",
  } as any);

  server.registerResource(
    "card",
    VIEW_URI,
    {
      title: "AppRequest card",
      description: "Visual cards for AppRequest tool results.",
      mimeType: VIEW_MIME,
    },
    async () => ({
      contents: [
        {
          uri: VIEW_URI,
          mimeType: VIEW_MIME,
          text: VIEW_HTML,
          _meta: { ui: { csp: VIEW_CSP, prefersBorder: false } },
        },
      ],
    }),
  );

  const tool = (
    name: string,
    title: string,
    description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    annotations: object,
    handler: (a: any) => Promise<Out>,
  ) =>
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations }, _meta: UI_META },
      safe(handler),
    );

  // ====================== READ ======================

  tool(
    "app_guide",
    "ℹ️ App guide",
    "Explains what AppRequest is, the allowed values (platforms, statuses, templates), the site links, whether developer actions are configured, and what this connector cannot do. Call it first when unsure.",
    {},
    READ,
    async () => {
      const dev = developerAvailable();
      const rows: [string, string][] = [
        ["What it is", "Free site where people request apps from developers, no account needed"],
        ["Site", SITE],
        ["Platforms", PLATFORMS.join(", ")],
        ["Statuses", STATUSES.join(", ")],
        ["Templates", TEMPLATES.join(", ")],
        [
          "Developer actions",
          dev
            ? "Connected (acts as the signed-in developer)"
            : "Not connected: add your personal link from the app (dashboard, Connect Claude)",
        ],
        [
          "Requester actions",
          "Work with a request ID (the ID in the tracking link is the access token)",
        ],
        [
          "Not possible here",
          "Theme and language are per-browser settings; SVG icons need browser-side sanitizing, so requests are created without an icon; platform-admin moderation",
        ],
      ];
      return card(rows.map(([k, v]) => `${k}: ${v}`).join("\n"), {
        kind: "detail",
        name: "AppRequest",
        icon: "📮",
        subtitle: "Request apps from developers",
        rows,
        sources: SOURCE,
      });
    },
  );

  tool(
    "list_developers",
    "👩‍💻 Developers",
    "Lists developers who currently accept requests (name, bio, platforms). Use it to find who to send a request to.",
    {
      limit: z.number().int().min(1).max(100).default(30).describe("How many developers, e.g. 30."),
    },
    READ,
    async ({ limit }) => {
      const docs = await query({
        collection: "developers",
        where: [
          ["acceptingRequests", "EQUAL", true],
          ["suspended", "EQUAL", false],
        ],
        limit,
      });
      if (!docs.length) return text("No developers are accepting requests right now.");
      const items = docs.map((d) => ({
        icon: "👤",
        title: `${d.displayName} (@${d.username})`,
        sub: [(d.acceptedPlatforms as string[] | undefined)?.join(", "), d.pricingNote]
          .filter(Boolean)
          .join(" · "),
        call: call("get_developer", { username: d.username }),
      }));
      const lines = docs.map(
        (d) =>
          `- @${d.username}: ${d.displayName}${d.bio ? ` — ${d.bio}` : ""} [${(d.acceptedPlatforms as string[] | undefined)?.join(", ")}]`,
      );
      return card(
        `${docs.length} developers accepting requests:\n${lines.join("\n")}\n\n_Source: ${SOURCE}_`,
        {
          kind: "list",
          title: "Developers accepting requests",
          sub: `${docs.length} found`,
          items,
          sources: SOURCE,
        },
      );
    },
  );

  tool(
    "get_developer",
    "👤 Developer profile",
    "Shows one developer's public profile and portfolio by username.",
    { username },
    READ,
    async ({ username: name }) => {
      const d = await findDeveloper(name);
      const portfolio = await query({
        collection: "portfolio",
        parent: `developers/${d.uid}`,
        orderBy: ["shippedAt", "DESCENDING"],
        limit: 20,
      }).catch(() => []);
      const rows: [string, unknown][] = [
        ["Username", `@${d.username}`],
        ["Bio", d.bio],
        ["Website", d.website],
        ["Pricing", d.pricingNote],
        ["Platforms", (d.acceptedPlatforms as string[])?.join(", ")],
        ["Accepting requests", d.acceptingRequests ? "Yes" : "No"],
        ["Uses AI to write code", d.usesAi == null ? undefined : d.usesAi ? "Yes" : "No"],
        ["Portfolio", portfolio.map((p) => p.appName).join(", ") || "Nothing shipped yet"],
        ["Request page", `${SITE}/developer.html?u=${d.username}`],
      ];
      return card(
        `${d.displayName} (@${d.username})\n${rows
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}\n\n_Source: ${SOURCE}_`,
        {
          kind: "detail",
          name: String(d.displayName),
          icon: "👤",
          subtitle: `@${d.username}`,
          rows,
          sources: SOURCE,
        },
      );
    },
  );

  tool(
    "get_request",
    "📦 Request",
    "Shows one request by ID: status, details, quote and, when the connector is the owning developer, action buttons. Anyone holding the ID can read it.",
    { requestId },
    READ,
    async ({ requestId: id }) => {
      const r = await loadRequest(id);
      const mine = (await maybeOwnerUid()) === r.developerUid;
      const q = r.quote as Record<string, string> | null;
      const rows: [string, unknown][] = [
        ["Status", r.status],
        ["Title", r.title],
        ["App name", r.appName],
        ["Requester", r.requesterName],
        ["Developer", `@${r.developerUsername}`],
        ["Description", r.appDescription],
        ["Platforms", (r.platforms as string[])?.join(", ")],
        ["Template", r.template],
        ["Budget", budgetText(r)],
        ["Deadline", r.deadline],
        ["Notes", r.notes],
        [
          "Quote",
          q
            ? `${q.amount} ${q.currency}${q.timeline ? `, ${q.timeline}` : ""}${q.validUntil ? `, valid until ${q.validUntil}` : ""}`
            : undefined,
        ],
        ["Has contact details", r.hasContact ? "Yes" : "No"],
        ["Created", day(r.createdAt)],
        ["Tracking link", trackUrl(id)],
      ];
      const actions = mine
        ? [
            ...STATUSES.filter((s) => s !== r.status).map((s) => ({
              label: `Mark ${s.replace("_", " ")}`,
              call: call("set_request_status", { requestId: id, status: s }),
            })),
            { label: "Thread", call: call("get_thread", { requestId: id }) },
            { label: "Private info", call: call("get_request_private", { requestId: id }) },
          ]
        : [{ label: "Thread", call: call("get_thread", { requestId: id }) }];
      return card(
        `${r.appName} — ${r.status}\n${rows
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}\n\n_Source: ${SOURCE}_`,
        {
          kind: "detail",
          name: String(r.appName),
          icon: "📦",
          subtitle: String(r.title),
          badges: [String(r.status)],
          rows,
          actions,
          sources: SOURCE,
        },
      );
    },
  );

  tool(
    "get_thread",
    "💬 Message thread",
    "Shows the message thread of a request (messages from both sides plus edit/contact notices).",
    { requestId },
    READ,
    async ({ requestId: id }) => {
      await loadRequest(id);
      const msgs = await query({
        collection: "messages",
        parent: `requests/${id}`,
        orderBy: ["createdAt", "ASCENDING"],
        limit: 200,
      });
      if (!msgs.length)
        return card("No messages yet.", {
          kind: "thread",
          title: "Thread",
          messages: [],
          sources: SOURCE,
        });
      const lines = msgs.map(
        (m) =>
          `[${day(m.createdAt)}] ${m.authorRole}${m.kind ? ` (${m.kind})` : ""}: ${m.body || (m.kind === "contact" ? "updated contact details" : "")} {id:${m.id}}`,
      );
      return card(`${lines.join("\n")}\n\n_Source: ${SOURCE}_`, {
        kind: "thread",
        title: "Thread",
        messages: msgs.map((m) => ({
          role: m.authorRole,
          text:
            m.kind === "edit"
              ? `Edited: ${m.body}`
              : m.kind === "contact"
                ? "Updated contact details"
                : m.body,
          time: day(m.createdAt),
        })),
        sources: SOURCE,
      });
    },
  );

  tool(
    "list_my_requests",
    "🗂️ My requests (board)",
    "Lists the requests sent to the connector's developer account, newest first, as a status board. Optionally filter by one status. Developer account only.",
    {
      status: z.enum(STATUSES).optional().describe("Only this status, e.g. 'new'."),
      limit: z.number().int().min(1).max(200).default(100),
    },
    READ,
    async ({ status, limit }) => {
      const s = await developer();
      let rows = await query({
        collection: "requests",
        where: [["developerUid", "EQUAL", s.uid]],
        orderBy: ["createdAt", "DESCENDING"],
        limit,
        token: s.idToken,
      });
      if (status) rows = rows.filter((r) => r.status === status);
      if (!rows.length)
        return text(status ? `No requests with status "${status}".` : "No requests yet.");
      const lines = rows.map(
        (r) =>
          `- ${r.id} [${r.status}] ${r.appName} — ${r.title} (from ${r.requesterName}, ${day(r.createdAt)})`,
      );
      const columns = (
        status ? [status] : ["new", "in_progress", "done", "declined", "cancelled"]
      ).map((st) => ({
        title: st.replace("_", " "),
        items: rows.filter((r) => r.status === st).map(requestRow),
      }));
      return card(`${rows.length} requests:\n${lines.join("\n")}\n\n_Source: ${SOURCE}_`, {
        kind: "board",
        title: "Requests",
        columns,
        sources: SOURCE,
      });
    },
  );

  tool(
    "get_request_private",
    "🔒 Private info",
    "Shows the requester's contact details and the developer's internal notes/tags for a request. Developer account only (the rules hide these from everyone else).",
    { requestId },
    READ,
    async ({ requestId: id }) => {
      const { token } = await ownedRequest(id);
      const contact = await getDoc(`requests/${id}/private/contact`, token);
      const notes = await getDoc(`requests/${id}/private/notes`, token);
      const rows: [string, unknown][] = [
        ["Contact channel", contact?.channel],
        ["Email", contact?.email],
        ["Phone", contact?.phone],
        ["Availability", contact?.availability],
        ["Internal notes", notes?.internalNotes],
        ["Tags", (notes?.tags as string[] | undefined)?.join(", ")],
      ];
      const shown = rows.filter(([, v]) => v);
      return card(
        shown.length
          ? shown.map(([k, v]) => `${k}: ${v}`).join("\n")
          : "No contact details or notes saved.",
        {
          kind: "detail",
          name: "Private info",
          icon: "🔒",
          subtitle: `Request ${id}`,
          rows,
          sources: SOURCE,
        },
      );
    },
  );

  tool(
    "get_my_profile",
    "🪪 My profile",
    "Shows the connector developer account's own profile (the settings editable on the dashboard).",
    {},
    READ,
    async () => {
      const s = await developer();
      const p = await getDoc(`developers/${s.uid}`, s.idToken);
      if (!p)
        return text(
          `The account ${s.email} has no developer profile yet. Use create_developer_profile.`,
        );
      const o = profileOut(p);
      return card(JSON.stringify(o, null, 2), {
        kind: "detail",
        name: String(p.displayName),
        icon: "🪪",
        subtitle: `@${p.username}`,
        rows: Object.entries(o).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v,
        ]),
        sources: SOURCE,
      });
    },
  );

  // ====================== DEVELOPER WRITES ======================

  tool(
    "create_developer_profile",
    "🆕 Create developer profile",
    "Onboards the connector's account as a developer: claims a username and creates the public profile. Fails if the account already has a profile or the username is taken or reserved.",
    {
      username,
      displayName: z.string().trim().min(1).max(60).describe("Public name, e.g. 'Dana Levi'."),
      bio: z.string().trim().max(280).optional(),
      website: z
        .string()
        .trim()
        .max(200)
        .regex(/^https:\/\/\S+$/, "Must start with https://")
        .optional(),
      pricingNote: z.string().trim().max(120).optional().describe("e.g. 'From $200'."),
      acceptedPlatforms: platformList.default(["web"]),
      usesAi: z.boolean().optional().describe("Whether you use AI to write code."),
    },
    WRITE,
    async (a) => {
      const s = await developer();
      if (await getDoc(`developers/${s.uid}`, s.idToken))
        throw new UserError("This account already has a developer profile. Use update_profile.");
      await commit(
        [
          {
            op: "set",
            path: `usernames/${a.username}`,
            data: { uid: s.uid, createdAt: SERVER_TIME },
          },
        ],
        s.idToken,
      );
      try {
        await commit(
          [
            {
              op: "set",
              path: `developers/${s.uid}`,
              data: {
                username: a.username,
                displayName: a.displayName,
                bio: a.bio ?? null,
                website: a.website ?? null,
                pricingNote: a.pricingNote ?? null,
                avatarUrl: null,
                acceptedPlatforms: a.acceptedPlatforms,
                acceptingRequests: true,
                ...(a.usesAi == null ? {} : { usesAi: a.usesAi }),
                suspended: false,
                createdAt: SERVER_TIME,
                updatedAt: SERVER_TIME,
              },
            },
          ],
          s.idToken,
        );
      } catch (e) {
        await commit([{ op: "delete", path: `usernames/${a.username}` }], s.idToken).catch(
          () => {},
        );
        throw e;
      }
      return text(`✅ Profile created. Request page: ${SITE}/developer.html?u=${a.username}`);
    },
  );

  tool(
    "update_profile",
    "⚙️ Update profile / settings",
    "Changes the connector developer's public profile and settings: display name, bio, website, pricing note, accepted platforms, whether new requests are accepted, whether you use AI. Only the fields you pass change.",
    {
      displayName: z.string().trim().min(1).max(60).optional(),
      bio: z.string().trim().max(280).nullable().optional().describe("null clears it."),
      website: z
        .string()
        .trim()
        .max(200)
        .regex(/^https:\/\/\S+$/)
        .nullable()
        .optional(),
      pricingNote: z.string().trim().max(120).nullable().optional(),
      acceptedPlatforms: platformList.optional(),
      acceptingRequests: z.boolean().optional().describe("false pauses new requests."),
      usesAi: z.boolean().optional(),
    },
    IDEMPOTENT_WRITE,
    async (a) => {
      const s = await developer();
      const data: Record<string, unknown> = {};
      for (const k of [
        "displayName",
        "bio",
        "website",
        "pricingNote",
        "acceptedPlatforms",
        "acceptingRequests",
        "usesAi",
      ])
        if (a[k] !== undefined) data[k] = a[k];
      if (!Object.keys(data).length) throw new UserError("Pass at least one field to change.");
      if (!(await getDoc(`developers/${s.uid}`, s.idToken)))
        throw new UserError("No developer profile yet. Use create_developer_profile.");
      await commit(
        [{ op: "update", path: `developers/${s.uid}`, data: { ...data, updatedAt: SERVER_TIME } }],
        s.idToken,
      );
      return text(`✅ Updated: ${Object.keys(data).join(", ")}.`);
    },
  );

  tool(
    "set_request_status",
    "🚦 Set request status",
    "Moves one of your requests to a status (new, in_progress, done, declined, cancelled).",
    { requestId, status: z.enum(STATUSES) },
    IDEMPOTENT_WRITE,
    async ({ requestId: id, status }) => {
      const { token } = await ownedRequest(id);
      await commit(
        [{ op: "update", path: `requests/${id}`, data: { status, updatedAt: SERVER_TIME } }],
        token,
      );
      return text(`✅ Request ${id} is now "${status}".`);
    },
  );

  tool(
    "set_quote",
    "💰 Set or clear quote",
    "Sets the price quote on one of your requests, or clears it with clear=true.",
    {
      requestId,
      amount: z.string().trim().min(1).max(20).optional().describe("e.g. '450'."),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .default("USD")
        .describe("3-letter code, e.g. 'USD', 'ILS'."),
      timeline: z.string().trim().max(200).optional().describe("e.g. '2 weeks'."),
      validUntil: isoDate.optional(),
      clear: z.boolean().default(false),
    },
    IDEMPOTENT_WRITE,
    async (a) => {
      const { token } = await ownedRequest(a.requestId);
      if (!a.clear && !a.amount) throw new UserError("Pass an amount, or clear=true.");
      const quote = a.clear
        ? null
        : {
            amount: a.amount,
            currency: a.currency,
            timeline: a.timeline ?? null,
            validUntil: a.validUntil ?? null,
          };
      await commit(
        [
          {
            op: "update",
            path: `requests/${a.requestId}`,
            data: { quote, updatedAt: SERVER_TIME },
          },
        ],
        token,
      );
      return text(a.clear ? "✅ Quote cleared." : `✅ Quote set: ${a.amount} ${a.currency}.`);
    },
  );

  tool(
    "save_notes",
    "📝 Save private notes",
    "Replaces the private internal notes and tags of one of your requests (never shown to the requester).",
    {
      requestId,
      internalNotes: z.string().max(5000).default(""),
      tags: z
        .array(
          z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9][a-z0-9 -]*$/)
            .max(24),
        )
        .max(5)
        .default([])
        .describe("Up to 5 short lowercase tags."),
    },
    IDEMPOTENT_WRITE,
    async (a) => {
      const { token } = await ownedRequest(a.requestId);
      await commit(
        [
          {
            op: "set",
            path: `requests/${a.requestId}/private/notes`,
            data: {
              internalNotes: a.internalNotes,
              tags: [...new Set(a.tags)],
              updatedAt: SERVER_TIME,
            },
          },
        ],
        token,
      );
      return text("✅ Notes saved.");
    },
  );

  tool(
    "delete_message",
    "🗑️ Delete message",
    "Deletes one message from the thread of one of your requests. Get the message ID from get_thread's text output.",
    { requestId, messageId: z.string().regex(/^[A-Za-z0-9]{10,40}$/) },
    DESTROY,
    async (a) => {
      const { token } = await ownedRequest(a.requestId);
      await commit(
        [{ op: "delete", path: `requests/${a.requestId}/messages/${a.messageId}` }],
        token,
      );
      return text("✅ Message deleted.");
    },
  );

  tool(
    "delete_request",
    "🗑️ Delete request",
    "Permanently deletes one of your requests with its messages, contact details and notes. Cannot be undone; confirm with the user first.",
    { requestId },
    DESTROY,
    async ({ requestId: id }) => {
      const { token } = await ownedRequest(id);
      const msgs = await query({ collection: "messages", parent: `requests/${id}`, limit: 500 });
      for (let i = 0; i < msgs.length; i += 400)
        await commit(
          msgs
            .slice(i, i + 400)
            .map((m) => ({ op: "delete" as const, path: `requests/${id}/messages/${m.id}` })),
          token,
        );
      await commit(
        [
          { op: "delete", path: `requests/${id}/private/contact` },
          { op: "delete", path: `requests/${id}/private/notes` },
        ],
        token,
      );
      await commit([{ op: "delete", path: `requests/${id}` }], token);
      return text(`✅ Request ${id} deleted.`);
    },
  );

  tool(
    "add_portfolio_item",
    "🏆 Add to portfolio",
    "Publishes a finished request (status 'done') on your public portfolio, optionally with a link to the shipped project.",
    {
      requestId,
      projectUrl: z
        .string()
        .max(300)
        .regex(/^https:\/\/\S+$/)
        .optional()
        .describe("https link to the finished app."),
    },
    IDEMPOTENT_WRITE,
    async (a) => {
      const { r, token } = await ownedRequest(a.requestId);
      if (r.status !== "done")
        throw new UserError('Only requests with status "done" can go on the portfolio.');
      const s = await developer();
      await commit(
        [
          {
            op: "set",
            path: `developers/${s.uid}/portfolio/${a.requestId}`,
            data: {
              title: r.title,
              appName: r.appName,
              platforms: r.platforms,
              svgIcon: r.svgIcon ?? null,
              projectUrl: a.projectUrl ?? null,
              shippedAt: SERVER_TIME,
            },
          },
        ],
        token,
      );
      return text(`✅ "${r.appName}" added to your portfolio.`);
    },
  );

  tool(
    "remove_portfolio_item",
    "➖ Remove from portfolio",
    "Removes one item from your public portfolio (the request itself stays).",
    { requestId },
    DESTROY,
    async ({ requestId: id }) => {
      const s = await developer();
      await commit([{ op: "delete", path: `developers/${s.uid}/portfolio/${id}` }], s.idToken);
      return text("✅ Removed from portfolio.");
    },
  );

  // ====================== SHARED / REQUESTER ======================

  tool(
    "send_message",
    "✉️ Send message",
    "Posts a message in a request's thread. as='developer' needs the connector's developer account and the request must be yours; as='requester' works with the request ID alone (not allowed on cancelled requests).",
    {
      requestId,
      body: z.string().trim().min(1).max(2000).describe("The message text."),
      as: z.enum(["developer", "requester"]),
    },
    WRITE,
    async ({ requestId: id, body, as }) => {
      let token: string | undefined;
      if (as === "developer") token = (await ownedRequest(id)).token;
      else if ((await loadRequest(id)).status === "cancelled")
        throw new UserError("This request is cancelled, so the requester cannot post.");
      await commit(
        [
          { op: "set", path: `requests/${id}/messages/${newId()}`, data: messageDoc(as, body) },
          { op: "update", path: `requests/${id}`, data: { lastMessageAt: SERVER_TIME } },
        ],
        token,
      );
      return text(`✅ Message sent as ${as}.`);
    },
  );

  const requestFields = {
    requesterName: z.string().trim().min(2).max(100).describe("Requester's name, e.g. 'Dana'."),
    title: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .describe("Short request title, e.g. 'Recipe tracker'."),
    appName: z.string().trim().min(2).max(80).describe("Name of the app, e.g. 'Cookbook'."),
    appDescription: z.string().trim().min(10).max(2000).describe("What the app should do."),
    platforms: platformList.describe(
      "Platforms wanted; each must be one the developer accepts, e.g. ['web','android'].",
    ),
    notes: z.string().trim().max(2000).nullable().optional(),
    template: z.enum(TEMPLATES).nullable().optional(),
    budgetMin: z.number().int().min(0).max(10000000).nullable().optional(),
    budgetMax: z.number().int().min(0).max(10000000).nullable().optional(),
    deadline: isoDate.nullable().optional(),
  };
  const contactFields = {
    channel: z
      .enum(CHANNELS)
      .default("thread")
      .describe("How the developer should reach the requester."),
    email: z
      .string()
      .trim()
      .max(254)
      .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
      .nullable()
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9 ()-]{5,24}$/)
      .nullable()
      .optional(),
    availability: z.string().trim().max(200).nullable().optional(),
  };
  const checkBudget = (min?: number | null, max?: number | null) => {
    if ((min == null) !== (max == null))
      throw new UserError("Give both budgetMin and budgetMax, or neither.");
    if (min != null && max != null && max < min)
      throw new UserError("budgetMax cannot be below budgetMin.");
  };
  const futureDate = (d?: string | null) => {
    if (
      d &&
      (Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || d < new Date().toISOString().slice(0, 10))
    )
      throw new UserError("The deadline must be a real date, today or later.");
  };
  const contactDoc = (c: any) => ({
    email: c.email ?? null,
    phone: c.phone ?? null,
    channel: c.channel ?? "thread",
    availability: c.availability ?? null,
    updatedAt: SERVER_TIME,
  });

  tool(
    "create_request",
    "➕ Create request",
    "Submits a new app request to a developer, like the public request form. No account needed. Returns the request ID and tracking link: keep them, they are the only access to the request. Does not attach an SVG icon.",
    {
      username,
      ...requestFields,
      contact: z
        .object(contactFields)
        .optional()
        .describe("Optional private contact details for the developer."),
    },
    WRITE,
    async (a) => {
      const dev = await findDeveloper(a.username);
      if (dev.suspended || !dev.acceptingRequests)
        throw new UserError(`@${a.username} is not accepting requests right now.`);
      const accepted = dev.acceptedPlatforms as string[];
      const bad = a.platforms.filter((p: string) => !accepted.includes(p));
      if (bad.length)
        throw new UserError(
          `@${a.username} does not accept: ${bad.join(", ")}. Accepted: ${accepted.join(", ")}.`,
        );
      checkBudget(a.budgetMin, a.budgetMax);
      futureDate(a.deadline);
      const id = newId();
      const hasContact = Boolean(a.contact?.email || a.contact?.phone);
      const writes: Parameters<typeof commit>[0] = [
        {
          op: "set",
          path: `requests/${id}`,
          data: {
            developerUid: dev.uid,
            developerUsername: dev.username,
            requesterName: a.requesterName,
            title: a.title,
            appName: a.appName,
            appDescription: a.appDescription,
            platforms: [...new Set(a.platforms)],
            svgIcon: null,
            notes: a.notes ?? null,
            template: a.template ?? null,
            budgetMin: a.budgetMin ?? null,
            budgetMax: a.budgetMax ?? null,
            deadline: a.deadline ?? null,
            status: "new",
            quote: null,
            lastMessageAt: null,
            hasContact,
            requesterUid: null,
            createdAt: SERVER_TIME,
            updatedAt: SERVER_TIME,
          },
        },
      ];
      if (a.contact && (a.contact.email || a.contact.phone || a.contact.availability))
        writes.push({
          op: "set",
          path: `requests/${id}/private/contact`,
          data: contactDoc(a.contact),
        });
      await commit(writes);
      return card(
        `✅ Request created. ID: ${id}\nTracking link: ${trackUrl(id)}\nKeep the ID: anyone holding it can read and edit the request.`,
        {
          kind: "detail",
          name: a.appName,
          icon: "✅",
          subtitle: "Request sent",
          badges: ["new"],
          rows: [
            ["Request ID", id],
            ["To", `@${a.username}`],
            ["Tracking link", trackUrl(id)],
          ],
          actions: [{ label: "Open request", call: call("get_request", { requestId: id }) }],
          sources: SOURCE,
        },
      );
    },
  );

  tool(
    "edit_request",
    "✏️ Edit request",
    "Edits a request's content as the requester (while it is new or in progress). Only the fields you pass change; a notice listing the changed fields is added to the thread.",
    {
      requestId,
      ...Object.fromEntries(Object.entries(requestFields).map(([k, v]) => [k, v.optional()])),
    },
    IDEMPOTENT_WRITE,
    async (a) => {
      const r = await loadRequest(a.requestId);
      if (!["new", "in_progress"].includes(String(r.status)))
        throw new UserError(`A request that is "${r.status}" can no longer be edited.`);
      const merged: Record<string, unknown> = {};
      const changed: string[] = [];
      for (const k of EDITABLE) {
        const next = k in a && a[k] !== undefined ? a[k] : r[k];
        merged[k] = next ?? null;
        if (JSON.stringify(merged[k]) !== JSON.stringify(r[k] ?? null)) changed.push(k);
      }
      if (!changed.length) return text("Nothing to change.");
      checkBudget(merged.budgetMin as number | null, merged.budgetMax as number | null);
      if (changed.includes("deadline")) futureDate(merged.deadline as string | null);
      const dev = await getDoc(`developers/${r.developerUid}`);
      const bad = (merged.platforms as string[]).filter(
        (p) => !(dev?.acceptedPlatforms as string[] | undefined)?.includes(p),
      );
      if (bad.length) throw new UserError(`The developer does not accept: ${bad.join(", ")}.`);
      await commit([
        {
          op: "update",
          path: `requests/${a.requestId}`,
          data: { ...merged, updatedAt: SERVER_TIME },
        },
        {
          op: "set",
          path: `requests/${a.requestId}/messages/${newId()}`,
          data: messageDoc("requester", changed.join(","), "edit"),
        },
      ]);
      return text(`✅ Updated: ${changed.join(", ")}.`);
    },
  );

  tool(
    "cancel_request",
    "🚫 Cancel request",
    "Cancels a request as the requester. Only possible while its status is 'new'; developers use set_request_status instead.",
    { requestId },
    DESTROY,
    async ({ requestId: id }) => {
      const r = await loadRequest(id);
      if (r.status !== "new")
        throw new UserError(
          `Only "new" requests can be cancelled by the requester (this one is "${r.status}").`,
        );
      await commit([
        {
          op: "update",
          path: `requests/${id}`,
          data: { status: "cancelled", updatedAt: SERVER_TIME },
        },
      ]);
      return text("✅ Request cancelled.");
    },
  );

  tool(
    "save_contact",
    "📇 Save contact details",
    "Saves or replaces the requester's private contact details on a request (only the developer can read them) and notes it in the thread.",
    { requestId, ...contactFields },
    IDEMPOTENT_WRITE,
    async (a) => {
      const r = await loadRequest(a.requestId);
      const c = {
        email: a.email ?? null,
        phone: a.phone ?? null,
        channel: a.channel,
        availability: a.availability ?? null,
      };
      if (a.channel === "email" && !c.email) throw new UserError("Channel 'email' needs an email.");
      if (a.channel === "phone" && !c.phone)
        throw new UserError("Channel 'phone' needs a phone number.");
      const writes: Parameters<typeof commit>[0] = [
        { op: "set", path: `requests/${a.requestId}/private/contact`, data: contactDoc(c) },
        {
          op: "update",
          path: `requests/${a.requestId}`,
          data: { hasContact: Boolean(c.email || c.phone), updatedAt: SERVER_TIME },
        },
      ];
      if (r.status !== "cancelled")
        writes.push({
          op: "set",
          path: `requests/${a.requestId}/messages/${newId()}`,
          data: messageDoc("requester", "", "contact"),
        });
      await commit(writes);
      return text("✅ Contact details saved.");
    },
  );

  tool(
    "report_developer",
    "🚩 Report developer",
    "Reports a developer profile to the platform moderators. Needs a reason of at least 10 characters.",
    {
      username,
      reason: z
        .string()
        .trim()
        .min(10)
        .max(1000)
        .describe("What is wrong, e.g. 'Asks for payment outside the platform'."),
    },
    WRITE,
    async (a) => {
      const dev = await findDeveloper(a.username);
      await commit([
        {
          op: "set",
          path: `reports/${newId()}`,
          data: { targetUid: dev.uid, reason: a.reason, status: "open", createdAt: SERVER_TIME },
        },
      ]);
      return text(`✅ Report about @${a.username} sent to the moderators.`);
    },
  );

  return server;
}
