import { z } from "zod";
const secret = z
  .string()
  .min(32)
  .refine((v) => !v.includes("replace-me"), "Replace placeholder secrets");
const sender = z.string().refine((value) => {
  if (/[\r\n]/.test(value)) return false;
  const trimmed = value.trim();
  const displayName = trimmed.match(/^([^<>]+?)\s*<([^<>]+)>$/);
  return z.email().safeParse(displayName?.[2] ?? trimmed).success;
}, "Invalid SMTP sender");
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z.string().default("file:./data/syncron.db"),
  APP_URL: z.url().default("http://localhost:8000"),
  // The unpacked extension's ID (visible on chrome://extensions once
  // loaded) — lets the GET /join page hand the invite off to the
  // extension via `chrome.runtime.sendMessage(EXTENSION_ID, ...)`. Unset
  // in environments where it isn't known yet (e.g. before the extension
  // has a stable published ID); the join page falls back to its
  // install-the-extension message in that case.
  EXTENSION_ID: z.string().optional(),
  BETTER_AUTH_URL: z.url().default("http://localhost:8000"),
  BETTER_AUTH_SECRET: secret,
  INVITE_SECRET: secret,
  LIVEKIT_URL: z.url(),
  LIVEKIT_INTERNAL_URL: z.url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: secret,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GMAIL_HOST: z.string().optional(),
  GMAIL_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  GMAIL_USERNAME: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  GMAIL_SENDER: sender.optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SENDER: sender.default("syncron@localhost.test"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:8000"),
});
export function config(env: Record<string, string | undefined> = process.env) {
  const c = schema.parse(
    Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "")),
  );
  for (const group of [
    [c.GOOGLE_CLIENT_ID, c.GOOGLE_CLIENT_SECRET],
    [
      c.GMAIL_HOST,
      c.GMAIL_PORT,
      c.GMAIL_USERNAME,
      c.GMAIL_APP_PASSWORD,
      c.GMAIL_SENDER,
    ],
  ])
    if (
      group.some((v) => v !== undefined) &&
      !group.every((v) => v !== undefined)
    )
      throw new Error("Partial Google or Gmail configuration");
  const smtp = [env.SMTP_HOST, env.SMTP_PORT, env.SMTP_SENDER].filter(Boolean);
  if (smtp.length && smtp.length !== 3)
    throw new Error("Set SMTP_HOST, SMTP_PORT and SMTP_SENDER together");
  const smtpCredentials = [c.SMTP_USERNAME, c.SMTP_PASSWORD].filter(
    (value) => value !== undefined,
  );
  if (smtpCredentials.length === 1)
    throw new Error("Set SMTP_USERNAME and SMTP_PASSWORD together");
  if (
    new Set([c.INVITE_SECRET, c.BETTER_AUTH_SECRET, c.LIVEKIT_API_SECRET])
      .size !== 3
  )
    throw new Error("Security secrets must differ");
  for (const value of [c.APP_URL, c.BETTER_AUTH_URL])
    if (!/^https?:\/\//.test(value))
      throw new Error("App and auth URLs must use HTTP(S)");
  if (
    !/^wss?:\/\//.test(c.LIVEKIT_URL) ||
    !/^(https?|wss?):\/\//.test(c.LIVEKIT_INTERNAL_URL)
  )
    throw new Error("Invalid LiveKit URL protocol");
  for (const origin of c.TRUSTED_ORIGINS.split(",").map((v) => v.trim()))
    if (origin.includes("*") || !z.url().safeParse(origin).success)
      throw new Error("Trusted origins must be explicit URLs");
  return c;
}
export type Config = ReturnType<typeof config>;

export function trustedOrigins(c: Config): string[] {
  const origins = c.TRUSTED_ORIGINS.split(",").map((v) => v.trim());
  return c.EXTENSION_ID
    ? [...origins, `chrome-extension://${c.EXTENSION_ID}`]
    : origins;
}
