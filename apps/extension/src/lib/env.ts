// Set WXT_API_URL in apps/extension/.env(.local) to point at a non-default
// backend. Defaults to the local backend from docs/backend-development.md
// (`pnpm dev`, API_PORT default 3001).
export const API_BASE_URL = import.meta.env.WXT_API_URL ?? "http://localhost:3001";
