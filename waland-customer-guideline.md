# Waland — Customer Getting Started Guide

Step-by-step guide to connect WhatsApp and send messages using the Waland **machine-to-machine (M2M) API**.

**Base URL:** `https://api.waland.dev`

---

## Important — M2M only

The Waland API at `/v1/`* is **strictly for server-to-server integration**. It is **not** a public or browser-facing API.

> **Do not call this API from a public client or browser** — including JavaScript in web pages, mobile apps, browser extensions, or any code shipped to end users.
>
> You **must** call Waland from:
>
> - Your **secure backend** (server, worker, cron job), or
> - A **separate proxy service** you control that holds the API key server-side.
>
> Your backend or proxy **must use SSL (HTTPS)** in production — for traffic from your frontend to your server, and from your server to `api.waland.dev`. Do not send API keys over plain HTTP.
>
> If you expose your API key in a client, embed requests in frontend code, or route browser traffic directly to Waland, your **account may be blocked** without notice.

All examples below assume requests originate from a **trusted server environment**.

---

## What you need

- An email address and password for account sign-up (Part 1), or access to the **Waland Console**
- A server-side environment for integration (Part 2)
- **HTTPS (SSL)** on your backend or proxy in production (valid TLS certificate)
- A phone with WhatsApp installed (to scan the QR code during linking)
- The recipient’s WhatsApp number in international format (no `+`)

---

## How authentication works

Waland uses **two** credentials at different stages:


| Stage         | Credential                           | Endpoints | When                                  |
| ------------- | ------------------------------------ | --------- | ------------------------------------- |
| Account setup | **User session** (sign-up / sign-in) | `/auth/`* | One-time — create account and API key |
| Integration   | **Org API key** (`waland_…`)         | `/v1/`*   | Ongoing — sessions, messages, logs    |


After you have an API key, your **backend or proxy uses only the API key** for all WhatsApp operations. Do not use user sessions in your production integration.

---

## Quick overview

```text
── Account setup (one-time) ──
1. Sign up            →  POST /auth/sign-up/email
2. Get org ID         →  GET /auth/organization/list
3. Create API key     →  POST /auth/api-key/create

── M2M integration (your backend) ──
4. Create session     →  POST /v1/sessions
5. Start session      →  POST /v1/sessions/:id/start
6. Fetch QR (server)  →  GET /v1/sessions/:id/qr
7. Send message       →  POST /v1/sessions/:id/send
```

---

# Part 1 — Account setup (get your API key)

Run these steps **once** to create your account and API key. You can do this in the **Waland Console** or programmatically from a **secure server terminal** (not from a browser or public client).

Auth routes live under `/auth/`*. Use the `**token`** from sign-up or sign-in as `Authorization: Bearer <token>`. An `Origin` header is **not required** for server-side M2M calls (CSRF checks are disabled for programmatic clients).

```bash
export BASE_URL="https://api.waland.dev"
```

---

## Step 1 — Create an account

**Endpoint:** `POST /auth/sign-up/email`

**Request body:**

```json
{
  "name": "Your Name",
  "email": "you@example.com",
  "password": "your-secure-password"
}
```

Password must be at least **8 characters**.

**Example:**

```bash
curl https://api.waland.dev/auth/sign-up/email \
  --request POST \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "walanduser",
  "email": "walanduser@example.com",
  "password": "walanduser123"
}'
```

**Example response:**

```json
{
  "token": "Z5nHmsIrq7RHOPrGs0djqTt6KVyXp0ts",
  "user": {
    "name": "walanduser",
    "email": "walanduser@example.com",
    "emailVerified": false,
    "createdAt": "2026-05-24T02:23:15.875Z",
    "updatedAt": "2026-05-24T02:23:15.875Z",
    "id": "6a12611363263189af5a00d9"
  }
}
```

On sign-up, Waland automatically creates an organization for you (e.g. `"Your Name's Organization"`).

---

## Step 2 — Sign in (returning users)

Skip this if you just signed up and still have a valid session token.

**Endpoint:** `POST /auth/sign-in/email`

```bash
curl https://api.waland.dev/auth/sign-in/email \
  --request POST \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
  "email": "walanduser@example.com",
  "password": "walanduser123"
}'
```

Response:

```
{
  "redirect": false,
  "token": "EGqP5ctRVzKX33PvqP4MK42pWPxY0vse",
  "user": {
    "name": "walanduser",
    "email": "walanduser@example.com",
    "emailVerified": false,
    "createdAt": "2026-05-24T02:23:15.875Z",
    "updatedAt": "2026-05-24T02:23:15.875Z",
    "id": "6a12611363263189af5a00d9"
  }
}
```

---

## Step 3 — Get your organization ID

API keys are scoped to an **organization**. You need the organization `id` when creating a key.

**Endpoint:** `GET /auth/organization/list`

```bash
curl https://api.waland.dev/auth/organization/list \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer {token}'
```

**Example response:**

```json
[
  {
    "name": "walanduser's Organization",
    "slug": "walanduser-14cded",
    "createdAt": "2026-05-24T02:23:15.941Z",
    "id": "6a12611363263189af5a00dc"
  }
]
```

---

## Step 4 — Create an API key

**Endpoint:** `POST /auth/api-key/create`

Requires your **session token** from Step 1 or 2.

```bash
curl -X POST "$BASE_URL/auth/api-key/create" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{
    \"name\": \"my-integration\",
    \"organizationId\": \"$ORG_ID\"
  }"

## Example
curl https://api.waland.dev/auth/api-key/create \
  --request POST \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer sE0h2tHbz3sCsQx14V029ZnZrv3friuI' \
  --data '{
  "name": "my-waland-bot2",
  "organizationId": "6a124ffdc885efba904e1016"
}'
```

**Example response:**

```json
{
  "id": "665a1b2c3d4e5f6789012346",
  "name": "my-integration",
  "prefix": "waland_",
  "key": "waland_abc123fullsecretkey...",
  "referenceId": "665a1b2c3d4e5f6789012345",
  "enabled": true,
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```

**Important:**

- Copy the full `key` value immediately. It is shown **only once**.
- Store it in your server secrets manager or environment variable.
- From this point on, your integration uses **only this API key** — not the session token.

```bash
export WALAND_API_KEY="waland_abc123fullsecretkey..."
```

---

# Part 2 — M2M integration (WhatsApp API)

All steps below use your **org API key** on `/v1/`*. Call these from your **secure backend or proxy** over **HTTPS** only.

## Authentication (M2M)


| Header                        | Example                 |
| ----------------------------- | ----------------------- |
| `Authorization` (recommended) | `Bearer waland_abc123…` |
| `x-api-key` (alternative)     | `waland_abc123…`        |


---

## Step 5 — Create a WhatsApp session

A **session** is one linked WhatsApp account. Choose a short unique name (slug) — letters, numbers, underscores, and hyphens only.

**Endpoint:** `POST /v1/sessions`

```bash
curl -X POST "https://api.waland.dev/v1/sessions" \
  -H "Authorization: Bearer $WALAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-shop"
  }'
```

**Example response** `201`:

```json
{
  "id": "665a1b2c3d4e5f6789012347",
  "name": "my-shop",
  "status": "created",
  "phone": null,
  "pushName": null,
  "lastError": null,
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```

Save the session `id`:

```bash
export SESSION_ID="665a1b2c3d4e5f6789012347"
```


| Validation rule | Detail                                       |
| --------------- | -------------------------------------------- |
| Name format     | `[a-zA-Z0-9_-]+` only                        |
| Uniqueness      | Name must be unique within your organization |
| Duplicate name  | Returns `409 Conflict`                       |


---

## Step 6 — Start the session and link WhatsApp

### 6a. Start the client

**Endpoint:** `POST /v1/sessions/:id/start`

```bash
curl -X POST "https://api.waland.dev/v1/sessions/$SESSION_ID/start" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

The session moves through statuses: `initializing` → `qr_ready` → `authenticating` → `ready`.

### 6b. Fetch the QR code (from your server)

Wait a few seconds after start, then fetch the QR from your **backend**:

**Endpoint:** `GET /v1/sessions/:id/qr`

```bash
curl "https://api.waland.dev/v1/sessions/$SESSION_ID/qr" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

**Example response:**

```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "status": "qr_ready"
}
```

Your server should:

1. Call this endpoint (never the end-user’s browser directly against Waland).
2. Pass the `qrCode` data URL to **your own** authenticated admin page or internal tool.
3. Let an operator scan the QR with WhatsApp on their phone.

Do **not** embed the API key in a public webpage or expose Waland URLs to unauthenticated users.

### 6c. Scan with WhatsApp

On the operator’s phone:

1. Open **WhatsApp**
2. Go to **Settings → Linked devices** (or **⋮ → Linked devices** on Android)
3. Tap **Link a device**
4. Scan the QR code shown in your admin UI

### 6d. Wait until connected

Poll session status from your server until `status` is `ready`:

```bash
curl "https://api.waland.dev/v1/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

**Connected example:**

```json
{
  "id": "665a1b2c3d4e5f6789012347",
  "name": "my-shop",
  "status": "ready",
  "phone": "8801712345678",
  "pushName": "My Shop",
  "lastError": null,
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```

When `ready`, you can send messages. The `phone` field shows the linked WhatsApp number.

### Session status reference


| Status           | Meaning                                                         |
| ---------------- | --------------------------------------------------------------- |
| `created`        | Session record exists; not started yet                          |
| `initializing`   | WhatsApp client is starting                                     |
| `qr_ready`       | Scan the QR code now                                            |
| `authenticating` | QR scanned; finishing setup                                     |
| `ready`          | Connected — you can send messages                               |
| `disconnected`   | Connection lost — run `/start` again                            |
| `failed`         | Error — check `lastError`, try `/start` or create a new session |


---

## Step 7 — Send a message

The session must be `**ready**` before sending.

**Endpoint:** `POST /v1/sessions/:sessionId/send`

### Send a text message

```bash
curl -X POST "$BASE_URL/v1/sessions/$SESSION_ID/send" \
  -H "Authorization: Bearer $WALAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "8801712345678@c.us",
    "text": "Hello from Waland!"
  }'
```

### Send a message with media

Provide a **public HTTPS URL** to the file:

```bash
curl -X POST "$BASE_URL/v1/sessions/$SESSION_ID/send" \
  -H "Authorization: Bearer $WALAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "8801712345678@c.us",
    "text": "Check out this image",
    "mediaUrl": "https://example.com/photo.jpg"
  }'
```

### Chat ID format


| Recipient type | Format                   | Example                   |
| -------------- | ------------------------ | ------------------------- |
| Individual     | `{country}{number}@c.us` | `8801712345678@c.us`      |
| Group          | `{group-id}@g.us`        | `120363012345678901@g.us` |


Use the full international number **without** `+` or leading zeros after the country code.

### Example success response `201`

```json
{
  "id": "665a1b2c3d4e5f6789012348",
  "sessionId": "665a1b2c3d4e5f6789012347",
  "organizationId": "665a1b2c3d4e5f6789012345",
  "chatId": "8801712345678@c.us",
  "text": "Hello from Waland!",
  "mediaUrl": null,
  "status": "sent",
  "messageId": "true_8801712345678@c.us_3EB0ABCDEF",
  "error": null,
  "createdAt": "2026-05-24T10:05:00.000Z"
}
```


| Field       | Meaning                                      |
| ----------- | -------------------------------------------- |
| `status`    | `pending` → `sent` or `failed`               |
| `messageId` | WhatsApp message ID (when sent successfully) |
| `error`     | Error message if delivery failed             |


---

## Step 8 — Check message history (optional)

**Endpoint:** `GET /v1/sessions/:sessionId/messages`

```bash
curl "$BASE_URL/v1/sessions/$SESSION_ID/messages?page=1&limit=20" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

**Filter by status:**

```bash
curl "$BASE_URL/v1/sessions/$SESSION_ID/messages?status=sent&limit=50" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

**Filter by date range:**

```bash
curl "$BASE_URL/v1/sessions/$SESSION_ID/messages?from=2026-05-01&to=2026-05-31" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

**Get one message:**

```bash
curl "$BASE_URL/v1/sessions/$SESSION_ID/messages/MESSAGE_LOG_ID" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

---

## Other useful session operations

### List all sessions

```bash
curl "$BASE_URL/v1/sessions" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

### Stop a session (disconnect WhatsApp client)

```bash
curl -X POST "$BASE_URL/v1/sessions/$SESSION_ID/stop" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

The session record remains; status becomes `disconnected`. Run `/start` again to reconnect (usually without a new QR scan if auth is still valid).

### Delete a session

```bash
curl -X DELETE "$BASE_URL/v1/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $WALAND_API_KEY"
```

This stops the client and permanently removes the session. You will need to scan a new QR code if you create it again.

---

## Recommended architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Your frontend  │ ──▶ │  Your backend /  │ ──▶ │  api.waland.dev │
│  (no API key)   │     │  proxy service   │     │  /v1/*          │
└─────────────────┘     │  (holds key)     │     └─────────────────┘
                        └──────────────────┘
```

- **Frontend** talks only to your backend over **HTTPS**.
- **Backend / proxy** stores `WALAND_API_KEY`, terminates TLS, and calls Waland over **HTTPS**.
- **Waland** never receives requests from end-user browsers.

Plain HTTP is acceptable only for **local development** on your machine. Production integrations require SSL on both your service and all calls to `api.waland.dev`.

---

## Complete example script (server-side)

Run this on a **server or local machine** — not in a browser.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://api.waland.dev"
EMAIL="you@example.com"
PASSWORD="your-secure-password"
SESSION_NAME="my-shop"
RECIPIENT="8801712345678@c.us"
MESSAGE="Hello from Waland!"

# ── Part 1: Account setup ──

SESSION_TOKEN=$(curl -sS -X POST "$BASE_URL/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"name\":\"You\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

ORG_ID=$(curl -sS -H "Authorization: Bearer $SESSION_TOKEN" -H "Origin: $BASE_URL" \
  "$BASE_URL/auth/organization/list" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

WALAND_API_KEY=$(curl -sS -X POST "$BASE_URL/auth/api-key/create" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d "{\"name\":\"setup-script\",\"organizationId\":\"$ORG_ID\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")

echo "API key created (store securely): ${WALAND_API_KEY:0:20}..."

# ── Part 2: M2M integration ──

SESSION_ID=$(curl -sS -X POST "$BASE_URL/v1/sessions" \
  -H "Authorization: Bearer $WALAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$SESSION_NAME\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Session ID: $SESSION_ID"

curl -sS -X POST "$BASE_URL/v1/sessions/$SESSION_ID/start" \
  -H "Authorization: Bearer $WALAND_API_KEY" > /dev/null

echo "Session started. Fetch QR from your server:"
echo "  GET $BASE_URL/v1/sessions/$SESSION_ID/qr"
echo ""
echo "Scan the QR in your admin UI, then press Enter when connected..."
read -r

while true; do
  STATUS=$(curl -sS "$BASE_URL/v1/sessions/$SESSION_ID" \
    -H "Authorization: Bearer $WALAND_API_KEY" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  if [ "$STATUS" = "ready" ]; then break; fi
  if [ "$STATUS" = "failed" ]; then echo "Session failed"; exit 1; fi
  sleep 3
done

curl -sS -X POST "$BASE_URL/v1/sessions/$SESSION_ID/send" \
  -H "Authorization: Bearer $WALAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"chatId\":\"$RECIPIENT\",\"text\":\"$MESSAGE\"}" | python3 -m json.tool

echo "Done!"
```

---

## Troubleshooting


| Problem                                        | Likely cause                                               | What to do                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Unauthorized or invalid session` on `/auth/*` | Expired token, or API not yet deployed with bearer support | Sign in again; use the `token` from the response body as `Authorization: Bearer …`                       |
| `Missing or null Origin` on `/auth/*`          | CSRF checks enabled                                        | Set `AUTH_DISABLE_CSRF_CHECK=true` on the server (default), or add `-H "Origin: https://api.waland.dev"` |
| `Missing API key` on `/v1/*`                   | No key or wrong header                                     | Use `Authorization: Bearer waland_…` or `x-api-key`                                                      |
| `Invalid API key`                              | Wrong or revoked key                                       | Create a new key (Step 4 or Waland Console)                                                              |
| `401 Unauthorized`                             | Key leaked or blocked                                      | Rotate key; ensure calls are server-side only                                                            |
| `409 Conflict` on create session               | Session name already used                                  | Pick a different `name`                                                                                  |
| QR not available (`400`)                       | Client still starting                                      | Wait a few seconds after `/start`, then retry `/qr`                                                      |
| Send fails with `400` / not ready              | Session not connected                                      | Poll `/v1/sessions/:id` until `status` is `ready`                                                        |
| `502` on send                                  | WhatsApp delivery error                                    | Check message logs; see `error` field on the log entry                                                   |
| Session `disconnected` after deploy            | Server restart                                             | Call `/start` again — usually reconnects without a new QR scan                                           |
| Account blocked                                | Client-side or public API usage                            | Contact support; move all calls to a secure backend                                                      |


---

## API reference


| Documentation          | URL                                                                            |
| ---------------------- | ------------------------------------------------------------------------------ |
| WhatsApp API (Swagger) | [https://api.waland.dev/docs](https://api.waland.dev/docs)                     |
| Auth API reference     | [https://api.waland.dev/auth/reference](https://api.waland.dev/auth/reference) |
| Health check           | [https://api.waland.dev/health](https://api.waland.dev/health)                 |


---

## Security requirements

1. **M2M only** — all `/v1/`* calls from your backend or proxy, never from a browser or mobile app shipped to users.
2. **SSL required** — your backend or proxy must serve **HTTPS** in production (valid certificate). All outbound calls to `api.waland.dev` must use **HTTPS** as well. Never transmit API keys over unencrypted HTTP.
3. **Protect API keys** — environment variables, secrets manager, encrypted config. Never commit keys to git.
4. **One key per integration** — revoke compromised keys immediately in the Console.
5. **Rotate keys** after team changes or suspected exposure.
6. **Proxy pattern** — if your frontend needs WhatsApp features, your backend calls Waland; the frontend calls your backend over HTTPS.

Violations (public clients, embedded keys, direct browser calls) may result in **API key revocation and account suspension**.

---

