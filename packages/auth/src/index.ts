import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import nodemailer from "nodemailer";
import type { Database } from "../../db/src/index.js";
import * as tables from "../../db/src/schema.js";
import type { Config } from "../../config/src/index.js";
import { initialUsername } from "../../validation/src/index.js";
import {
  MemoryRateLimiter,
  newId,
  type RateLimiter,
} from "../../shared/src/index.js";
export type Mail = { email: string; otp: string; type: string };
export function googleProfile(profile: { email_verified?: boolean }) {
  if (profile.email_verified !== true)
    throw new APIError("FORBIDDEN", {
      message: "Google email must be verified",
    });
  return { emailVerified: true };
}
export function mailTransport(c: Config) {
  const transport = nodemailer.createTransport({
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    ...(c.GMAIL_HOST
      ? {
          host: c.GMAIL_HOST,
          port: c.GMAIL_PORT,
          secure: c.GMAIL_PORT === 465,
          requireTLS: c.GMAIL_PORT !== 465,
          auth: { user: c.GMAIL_USERNAME, pass: c.GMAIL_APP_PASSWORD },
        }
      : { host: c.SMTP_HOST, port: c.SMTP_PORT, secure: false }),
  });
  return {
    verify: () => transport.verify(),
    send: async (m: Mail) => {
      await transport.sendMail({
        from: c.GMAIL_SENDER ?? c.SMTP_SENDER,
        to: m.email,
        subject: `Syncron ${m.type} code`,
        text: `Your Syncron code is ${m.otp}. It expires in five minutes.`,
      });
    },
  };
}
export function createAuth(
  db: Database,
  c: Config,
  send: (mail: Mail) => Promise<void>,
  limiter: RateLimiter = new MemoryRateLimiter(),
) {
  return betterAuth({
    baseURL: c.BETTER_AUTH_URL,
    secret: c.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    trustedOrigins: c.TRUSTED_ORIGINS.split(",").map((v) => v.trim()),
    database: drizzleAdapter(db, { provider: "sqlite", schema: tables }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: false },
    user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    socialProviders: c.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: c.GOOGLE_CLIENT_ID,
            clientSecret: c.GOOGLE_CLIENT_SECRET!,
            mapProfileToUser: googleProfile,
          },
        }
      : {},
    advanced: {
      database: { generateId: () => newId() },
      ipAddress: { ipAddressHeaders: [] },
    },
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          [
            "/sign-in/email-otp",
            "/email-otp/get-verification-otp",
            "/email-otp/create-verification-otp",
            "/update-user",
          ].includes(ctx.path)
        )
          throw new APIError("FORBIDDEN");
        const sends = [
          "/sign-up/email",
          "/send-verification-email",
          "/email-otp/send-verification-otp",
          "/email-otp/request-password-reset",
          "/forget-password/email-otp",
        ];
        if (sends.includes(ctx.path)) {
          const email =
            typeof ctx.body?.email === "string"
              ? ctx.body.email.trim().toLowerCase()
              : "";
          const ip = ctx.headers?.get("x-syncron-client-ip") ?? "local";
          if (
            !limiter.take(`otp:cooldown:${email}`, 1, 60000) ||
            !limiter.take(`otp:email:${email}`, 3, 600000) ||
            !limiter.take(`otp:ip:${ip}`, 3, 600000)
          )
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "OTP resend limit reached",
            });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (u) => {
            const now = new Date();
            await db
              .insert(tables.profiles)
              .values({
                userId: u.id,
                username: initialUsername(u.email, u.name),
                createdAt: now,
                updatedAt: now,
              });
          },
        },
      },
    },
    plugins: [
      bearer(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        resendStrategy: "rotate",
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        sendVerificationOTP: send,
      }),
    ],
  });
}
export type Auth = ReturnType<typeof createAuth>;
