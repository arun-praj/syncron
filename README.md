# Syncron

Chrome and Firefox watch-party extension with a Hono/Better Auth backend, SQLite/Drizzle persistence, authoritative playback WebSockets and LiveKit media.

Read the requirements in this order: [implementation plan](docs/implementation-plan.md), [frontend requirements](docs/frontend-requirements.md), [backend requirements](docs/backend-requirements.md), then the [canonical API](docs/API-schema.md) and [database](docs/db-schema.md) contracts.

See [backend development](docs/backend-development.md) for setup, environment variables, auth flow, Docker and limits. The unpacked extension is built with `pnpm --dir apps/extension build`.

```sh
pnpm install
# Copy .env.example to .env and replace the three secrets.
pnpm migrate
pnpm dev
```

From WSL, run the stack from the mounted repository path. The API uses port 8000:

```sh
cd /mnt/c/Users/aarun/Documents/syncron
docker compose up --build
```

Build unpacked extension directories with `pnpm --dir apps/extension build` (Chrome) or `pnpm --dir apps/extension exec wxt build -b firefox` (Firefox), then load `.output/chrome-mv3` or `.output/firefox-mv2` in the browser’s extension developer page.

Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm docker:smoke`. Docker smoke requires Docker Compose and free service ports.

Canonical contracts: [API](docs/API-schema.md), [database](docs/db-schema.md), [playback protocol](docs/realtime-protocol.md). Any API/schema changes must update their canonical document.
