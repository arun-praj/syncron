import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
const dir = await mkdtemp(join(tmpdir(), "syncron-smoke-"));
const envPath = join(dir, "smoke.env");
const override = join(dir, "compose.yml");
const secret = () => randomBytes(32).toString("hex");
await writeFile(
  envPath,
  `BETTER_AUTH_SECRET=${secret()}\nINVITE_SECRET=${secret()}\nLIVEKIT_API_SECRET=${secret()}\nLIVEKIT_API_KEY=smoke\nLIVEKIT_URL=ws://localhost:7880\nLIVEKIT_INTERNAL_URL=http://livekit:7880\nAPP_URL=http://localhost:8000\nBETTER_AUTH_URL=http://localhost:8000\n`,
);
// Compose's base env_file requires .env; an override reset selects only generated smoke credentials.
await writeFile(
  override,
  `services:\n  api:\n    env_file: !override\n      - ${JSON.stringify(envPath.replace(/\\/g, "/"))}\n`,
);
const compose = (...args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn(
      "docker",
      [
        "compose",
        "--project-name",
        "syncron-smoke",
        "--env-file",
        envPath,
        "-f",
        "docker-compose.yml",
        "-f",
        override,
        ...args,
      ],
      { stdio: "inherit" },
    );
    p.once("error", reject);
    p.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Docker exited ${code}`)),
    );
  });
const request = async (path: string, body?: unknown, token?: string) => {
  const r = await fetch(`http://localhost:8000${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:8000",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert(r.ok, `${path}: ${r.status}`);
  return r.status === 204 ? null : r.json();
};
try {
  await compose("up", "-d", "--build", "--wait", "--wait-timeout", "180");
  assert.equal((await request("/healthz")).status, "ok");
  assert.equal((await request("/readyz")).status, "ok");
  const email = `smoke-${Date.now()}@example.com`,
    password = secret();
  await request("/api/auth/sign-up/email", { email, password, name: "Smoke" });
  let otp = "";
  for (let i = 0; i < 30 && !otp; i++) {
    const list = await (
      await fetch("http://localhost:8025/api/v1/messages")
    ).json();
    const message = list.messages?.find(
      (m: { To: Array<{ Address: string }> }) =>
        m.To.some((t) => t.Address === email),
    );
    if (message) {
      const detail = await (
        await fetch(`http://localhost:8025/api/v1/message/${message.ID}`)
      ).json();
      otp = detail.Text.match(/\b\d{6}\b/)?.[0] ?? "";
    }
    if (!otp) await setTimeout(500);
  }
  assert.match(otp, /^\d{6}$/);
  await request("/api/auth/email-otp/verify-email", { email, otp });
  const session = await request("/api/auth/sign-in/email", { email, password });
  await request("/api/v1/me/onboarding", { username: `smoke${Date.now()}`, avatarId: "1" }, session.token);
  const { room } = await request(
    "/api/v1/rooms",
    { name: "Smoke", everyoneCanControl: true, media: { provider: "YOUTUBE", mediaId: "smoke", url: "https://www.youtube.com/watch?v=smoke" } },
    session.token,
  );
  const media = await request(
    `/api/v1/rooms/${room.id}/livekit-token`,
    {},
    session.token,
  );
  const claims = JSON.parse(
    Buffer.from(media.token.split(".")[1], "base64url").toString(),
  );
  assert.equal(claims.sub, session.user.id);
  assert.equal(claims.video.room, `sync_${room.id}`);
  assert.equal(claims.exp - claims.nbf, 600);
  await request(`/api/v1/rooms/${room.id}/end`, {}, session.token);
  console.log(
    "Docker smoke passed: migrations, health, SMTP OTP, bearer session, LiveKit connectivity and token.",
  );
} finally {
  try {
    await compose("down", "--volumes", "--remove-orphans");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
