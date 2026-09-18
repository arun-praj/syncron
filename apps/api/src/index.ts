import { mkdir } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { config } from "../../../packages/config/src/index.js";
import { openDatabase } from "../../../packages/db/src/index.js";
import { createAuth, mailTransport } from "../../../packages/auth/src/index.js";
import { log } from "../../../packages/shared/src/index.js";
import { createApp } from "./app.js";
import { livekit } from "./livekit.js";
const c = config();
await mkdir("data", { recursive: true });
const { db, client } = await openDatabase(c.DATABASE_URL);
const mail = mailTransport(c);
const auth = createAuth(db, c, mail.send);
const runtime = await createApp({
  db,
  auth,
  config: c,
  media: livekit(c),
  smtpHealth: mail.verify,
});
const server = serve({
  fetch: runtime.app.fetch,
  port: c.API_PORT,
  hostname: "0.0.0.0",
});
runtime.injectWebSocket(server);
log({ event: "server.started", port: c.API_PORT });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    runtime.stop();
    server.close(() => {
      client.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  });
