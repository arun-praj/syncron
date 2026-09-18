# Syncron agent guide

Read these first when changing the project:

1. [Implementation plan](docs/implementation-plan.md)
2. [Frontend requirements](docs/frontend-requirements.md)
3. [Backend requirements](docs/backend-requirements.md)
4. [Canonical API](docs/API-schema.md)
5. [Canonical database schema](docs/db-schema.md)
6. [Realtime protocol](docs/realtime-protocol.md)

Keep shared HTTP and WebSocket contracts in `packages/protocol`. Update the canonical API and database documents with every contract or persistence change. Never log passwords, OTPs, invite tokens, or chat text.
