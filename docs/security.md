# Security and Privacy Requirements

Backend milestone scope and implemented behavior are defined by [backend development](backend-development.md), [API](API-schema.md), and [database](db-schema.md). Extension/UI sections are future requirements.

## 1. Authentication

Use Better Auth for passwords, OAuth account linkage, sessions, and verification.

Never implement custom password hashing unless Better Auth explicitly delegates it through a supported adapter.

Google OAuth secrets exist only on backend/server configuration.

## 2. Authorization

All sensitive room actions require server-side checks.

Never trust:

- role sent by client,
- host ID sent by client,
- room membership claimed by client,
- `everyoneCanControl` claimed by client.

Verify from persistent/transient trusted state.

## 3. Signed invites

Use a dedicated secret to sign room ID and persisted invite version. Never persist or log tokens. Initial joins require a valid token; rotation revokes all prior links.

## 4. LiveKit

- API secret is server-only.
- Mint short-lived participant tokens.
- Derive participant identity from authenticated Syncron user.
- Derive LiveKit room name from trusted Syncron room ID.
- Do not permit arbitrary room-name/token grant creation from client input.
- Deny token minting for ended rooms and non-members.

## 5. Ephemeral text privacy

Chat must not be intentionally persisted.

Do not include message content in:

- database,
- application logs,
- analytics events,
- tracing spans,
- error monitoring breadcrumbs,
- crash dumps where avoidable.

If moderation/reporting is added later, it requires an explicit privacy/product design change.

## 6. Media privacy

Syncron does not record webcam or microphone streams.

Syncron does not proxy or record synchronized source media.

Browser permissions for camera/microphone should be requested only when users enable those features.

## 7. Input validation

Use Zod at:

- REST input boundaries,
- WebSocket event boundaries,
- extension message boundaries where untrusted page/content data crosses contexts.

Apply length/range constraints.

Examples:

- room name length,
- username length,
- chat text length,
- playback position >= 0,
- playback rate constrained to reasonable supported range,
- URL length limits.

## 8. Rate limiting

At minimum rate-limit:

- sign-in/sign-up attempts,
- invite join attempts,
- room creation,
- room join,
- kick/host-transfer abuse,
- WebSocket control event floods,
- LiveKit token issuance.

## 9. Origin/CORS

Backend must explicitly allow only intended origins/extension origins in production.

Do not use wildcard CORS with credentials.

Chrome and Firefox extension origin patterns must be configured intentionally.

## 10. Logging

Use structured JSON logging.

Log IDs and event types, not secrets or chat bodies.

Useful fields:

- request ID,
- user ID where appropriate,
- room ID,
- route/event type,
- status/error code,
- duration.

Never log:

- passwords,
- OAuth secrets/tokens,
- Better Auth session secrets,
- LiveKit API secret,
- invite tokens,
- chat text.

## 11. CSP and extension isolation

Use restrictive extension content security policy compatible with WXT/build output.

Do not use `eval` or remote executable JavaScript.

Keep site DOM interaction inside content-script/provider adapter boundary.
