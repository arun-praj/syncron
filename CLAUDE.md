# CLAUDE.md — Syncron Engineering Rules

Read all files under `docs/` before implementing a feature that touches architecture, APIs, database persistence, realtime behavior, authentication, extension behavior, LiveKit, or Docker.

## Project principles

- TypeScript everywhere.
- Prefer simple, explicit modules over framework magic.
- Do not duplicate protocol types across server and extension.
- Validate untrusted input at every external boundary with Zod.
- Never trust room permissions supplied by a client.
- Never store text chat messages in SQLite/D1, logs, analytics, error reports, or tracing payloads.
- Never record or persist webcam or microphone media.
- The backend does not proxy or rebroadcast watched/listened media.
- Syncron synchronizes playback controls and metadata only.

## Required stack

- Monorepo: pnpm workspaces.
- API: Hono + TypeScript.
- Auth: Better Auth.
- ORM: Drizzle ORM.
- Dev database: SQLite.
- Production target: Cloudflare D1.
- Video/voice/text realtime communications: self-hosted LiveKit.
- Playback synchronization: Syncron-owned WebSocket protocol.
- Extension: WXT + React + TypeScript.
- Client state: Zustand.
- Validation/contracts: Zod.
- Tests: Vitest + Playwright.
- Local services: Docker Compose.

## Canonical docs rule

### API changes

Every change involving any of the following MUST update `docs/API-schema.md` in the same commit/change:

- route additions/removals/renames,
- request body/query/path parameters,
- response payloads,
- HTTP status codes,
- authentication requirements,
- authorization behavior,
- WebSocket event names,
- WebSocket payloads,
- protocol error codes,
- LiveKit token endpoint behavior.

### Database changes

Every change involving any of the following MUST update `docs/db-schema.md` in the same commit/change:

- tables,
- columns,
- indexes,
- foreign keys,
- uniqueness constraints,
- enum-like string values,
- retention/persistence behavior,
- migrations.

Do not mark a task complete if either canonical document is stale.

## Shared protocol rule

HTTP DTOs and WebSocket event payloads that are consumed by both API and extension should be defined once in `packages/protocol` using Zod schemas and exported TypeScript types.

## Security rules

- Never store plaintext passwords.
- Do not create custom password hashing; use Better Auth.
- Authorization is checked server-side for every protected room operation.
- Host-only operations remain host-only regardless of client UI state.
- Rate-limit auth, room join, chat, and control-event abuse surfaces.
- Secrets must come from environment variables/secrets stores.
- Never commit `.env` files containing credentials.

## Testing rule

For every feature, add tests at the lowest appropriate level and integration/E2E coverage for critical room/auth/realtime behavior.

## Pre-approved commands

The following commands are allowlisted in `.claude/settings.json` and run without a permission prompt: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm view <pkg> ...`. Immediately before running one of these, output a one-line notice in this exact form so the skipped prompt stays visible:

`*** auto-approved: <command> ***`

Do not add further commands to this silent-run list without the user's explicit approval — mutating commands (`pnpm install`, `pnpm --dir ... build`, `git rm`, `rm -rf`, etc.) must keep prompting.
