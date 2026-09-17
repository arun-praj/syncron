import { mkdir } from "node:fs/promises";
import { openDatabase } from "./index.js";
await mkdir("data", { recursive: true });
const { client } = await openDatabase(
  process.env.DATABASE_URL ?? "file:./data/syncron.db",
);
client.close();
