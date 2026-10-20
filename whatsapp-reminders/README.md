# S.A Traders bill reminders — standalone WhatsApp service

This extracts/adapts the WhatsAppBerryService transport from `Shivayt007/YouPI-PG`: BerryProtocol linked-device pairing, a saved session, status and text sending. It has no payment gateway, OTP, checkout, bank observer or payment-success endpoint. The Android billing app keeps its existing rental calculations and customer records.

## EasyPanel deployment

Create a **new App service** from the `Shivayt007/bills` repository, branch `main`.

- Build path/context: `/whatsapp-reminders`
- Build method: Dockerfile, filename `Dockerfile`
- Domain: give this service its own HTTPS EasyPanel domain, targeting HTTP port **3000**.
- Storage: mount a persistent volume at **`/app/data`**. It holds the linked-device credentials and duplicate-send journal. Run one replica.
- Environment:

```dotenv
PORT=3000
DATA_DIR=/app/data
REMINDER_API_TOKEN=replace_with_your_own_random_secret
```

Generate a token with `openssl rand -hex 32`, then use the same token in the app. It must have 32–256 letters, digits, hyphens or underscores. Never put it in source code, Firestore settings or a shared URL. The service refuses to start without a sufficiently long token.

Install the new signed Android APK from the `Build signed S.A Traders release` GitHub Actions run. On the phone:

1. Open **Notifications → WhatsApp setup** as admin.
2. Enter this new service's HTTPS domain and API token; tap **Save setup**.
3. Enter the shop WhatsApp number and tap **Get phone linking code**, then **Refresh status** until the code appears.
4. In WhatsApp use **Linked devices → Link a device → Link with phone number instead** and enter the code. Refresh app status until connected. QR linking from a second screen is also supported.
5. Under **Overdue**, **Due today** or **Upcoming**, tap a bill's **Send reminder**, check the recipient/message, then tap **Send WhatsApp reminder**.

Setup is per phone. The token is encrypted with Android Keystore and excluded from device backups; it is not bundled into the APK or returned to JavaScript. Internet is needed to connect the app to this server. This is the linked-device Berry integration used by the source repo, not the Meta WhatsApp Business Cloud API.

## Sending behavior

Reminders are sent only after an explicit tap on the preview's send button. Local daily phone notifications remain unchanged; they do not automatically message customers. There is no bulk sender or background WhatsApp schedule in this change.

The preview uses current rental-engine amounts and rechecks bill status, recipient, date and amount before sending. Upcoming messages describe an **expected cycle amount**, rather than claiming it is already overdue. Closed/settled bills do not get a current-due reminder. Sending never writes to bills or payments.

A server response means **submitted to WhatsApp**, not delivered/read. Request IDs and hashed payloads are saved before dispatch; retries with the same ID are deduplicated across server restarts. If a send fails or times out after submission, the outcome is unknown and that ID cannot be sent again. Check the WhatsApp chat before intentionally opening a new preview. No automatic retries send a second message. Only one message can be submitted at a time, with a two-second minimum interval.

The Android app communicates over HTTPS through a fixed native API allowlist and does not follow redirects carrying the token. All session/pairing/send routes require the token. `/health` only reports that the HTTP process is running; the authenticated status route reports the actual WhatsApp connection. Status and QR are refreshed manually in setup.

## Validation

`node --test whatsapp-reminders/test/*.test.js` uses fake transports and local HTTP only. It covers authentication, offline/invalid rejection, same-request deduplication including restart, concurrent sends, unknown outcomes and real-event-gated session status. `tests/whatsapp-reminders-test.cjs` validates message wording and phone normalization. `tests/ui-test.cjs` covers preview, explicit send, disabled repeat send and stale bill refusal with a mocked native bridge. The service workflow builds the Docker image and imports the installed engine without connecting an account or sending a message.

Actual WhatsApp linking and customer delivery require your account/device after deployment. No live customer messages are sent by build/test jobs.
