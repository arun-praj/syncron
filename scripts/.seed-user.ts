import { and, eq } from "drizzle-orm";
import { config } from "../packages/config/src/index.js";
import { openDatabase } from "../packages/db/src/index.js";
import { account, profiles, user } from "../packages/db/src/schema.js";
import { createAuth } from "../packages/auth/src/index.js";
import { initialUsername } from "../packages/validation/src/index.js";

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!email || !password) throw new Error("SEED_EMAIL and SEED_PASSWORD are required");

const c = config();
const { db, client } = await openDatabase(c.DATABASE_URL);
try {
  const auth = createAuth(db, c, async () => {});
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (!existing) {
    await auth.api.signUpEmail({ body: { email, password, name: "Syncron user" } });
  }

  const saved = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (!saved) throw new Error("user was not created");
  const now = new Date();
  await db.update(user).set({ emailVerified: true, name: saved.name || "Syncron user", updatedAt: now }).where(eq(user.id, saved.id));
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, saved.id) });
  const values = { userId: saved.id, username: initialUsername(email, saved.name || "Syncron user"), avatarId: "1", onboardingCompletedAt: now, createdAt: profile?.createdAt ?? now, updatedAt: now };
  if (profile) await db.update(profiles).set({ username: values.username, avatarId: values.avatarId, onboardingCompletedAt: values.onboardingCompletedAt, updatedAt: now }).where(eq(profiles.userId, saved.id));
  else await db.insert(profiles).values(values);

  const signedIn = await auth.api.signInEmail({ body: { email, password } });
  if (!signedIn?.user?.id) throw new Error("password authentication failed");
  const checkUser = await db.query.user.findFirst({ where: eq(user.id, saved.id) });
  const checkProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, saved.id) });
  const checkAccount = await db.query.account.findFirst({ where: and(eq(account.userId, saved.id), eq(account.providerId, "credential")) });
  if (!checkUser?.emailVerified || !checkProfile?.onboardingCompletedAt || checkProfile.avatarId !== "1" || checkProfile.username !== values.username || !checkAccount?.password) throw new Error("persisted account verification failed");
  console.log(JSON.stringify({ id: saved.id, email: checkUser.email, emailVerified: checkUser.emailVerified, username: checkProfile.username, avatarId: checkProfile.avatarId, onboardingCompleted: Boolean(checkProfile.onboardingCompletedAt), passwordAuthentication: true }));
} finally {
  client.close();
}
