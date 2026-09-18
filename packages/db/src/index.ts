import Sqlite from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
export async function openDatabase(url: string) {
  const path = url.startsWith("file:///")
    ? fileURLToPath(url)
    : url.replace(/^file:/, "");
  const client = new Sqlite(path);
  client.pragma("foreign_keys = ON");
  client.pragma("busy_timeout = 5000");
  const db = drizzle(client, { schema });
  migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../../drizzle", import.meta.url),
    ),
  });
  return { db, client };
}
export type Database = Awaited<ReturnType<typeof openDatabase>>["db"];
