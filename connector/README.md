# AppRequest connector

A remote MCP server (claude.ai custom connector) that lets Claude read and do what the AppRequest UI does, and shows inline cards (MCP Apps) for the results. It talks to Firebase over REST and signs in as a normal Firebase user, so `firestore.rules` stay the security boundary.

## Tools (23)

| Tool                                           | Who                    | What it does                                                        |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `app_guide`                                    | anyone                 | Allowed values, links, what is configured and what is not possible  |
| `list_developers`                              | anyone                 | Developers accepting requests                                       |
| `get_developer`                                | anyone                 | Public profile and portfolio                                        |
| `get_request`                                  | request ID             | Request details, quote; status buttons for the owning developer     |
| `get_thread`                                   | request ID             | Message thread                                                      |
| `create_request`                               | anyone                 | Submit a request (no icon)                                          |
| `edit_request`                                 | request ID             | Edit while new or in progress                                       |
| `cancel_request`                               | request ID             | Requester cancel while new                                          |
| `save_contact`                                 | request ID             | Requester contact details                                           |
| `send_message`                                 | request ID / developer | Post as requester or developer                                      |
| `report_developer`                             | anyone                 | Report a profile                                                    |
| `list_my_requests`                             | developer              | Board of your requests                                              |
| `get_request_private`                          | developer              | Contact details, notes, tags                                        |
| `get_my_profile`                               | developer              | Your profile and settings                                           |
| `create_developer_profile`                     | developer              | Claim a username, create the profile                                |
| `update_profile`                               | developer              | Name, bio, website, pricing, platforms, accepting requests, uses AI |
| `set_request_status`                           | developer              | new / in_progress / done / declined / cancelled                     |
| `set_quote`                                    | developer              | Set or clear the quote                                              |
| `save_notes`                                   | developer              | Private notes and tags                                              |
| `delete_message`                               | developer              | Remove a thread message                                             |
| `delete_request`                               | developer              | Delete a request with its data                                      |
| `add_portfolio_item` / `remove_portfolio_item` | developer              | Portfolio of finished requests                                      |

Not possible from a server: theme and language (per-browser settings), SVG icons (sanitized in the browser, ADR 0005) and platform-admin moderation.

## Security

Developer tools act as one Firebase account (`DEV_EMAIL` / `DEV_PASSWORD`). Because of that the endpoint refuses to run without `MCP_SECRET` when those are set, and the secret travels in the URL (`/mcp?key=...`) or as a Bearer token. Treat the full URL like a password. Use a dedicated account, not your main one.

## Run and test

```
cd connector
npm install
npm run typecheck
```

Tests write data, so they only run against the emulators. In the repo root start them (Java 21 on `PATH`): `npm run emulators`. Then:

```
FIREBASE_EMULATOR=1 DEV_EMAIL=dev@example.com DEV_PASSWORD=test-pass-123 MCP_SECRET=test PORT=3341 npm run dev
FIREBASE_EMULATOR=1 npm test -- "http://localhost:3341/mcp?key=test"
```

## Deploy (Vercel)

Set the project root to `connector/`, add the variables from `.env.example`, deploy, then add the connector in claude.ai with the URL `https://<host>/mcp?key=<MCP_SECRET>`. After adding tools, remove and re-add the connector, because claude.ai caches the tool list.
