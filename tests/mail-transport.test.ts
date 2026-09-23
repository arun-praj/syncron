import { beforeEach, describe, expect, test, vi } from "vitest";
import { config } from "../packages/config/src/index.js";

const mocks = vi.hoisted(() => ({ createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));

import { mailTransport } from "../packages/auth/src/index.js";

const baseEnv = {
  BETTER_AUTH_SECRET: "a".repeat(40),
  INVITE_SECRET: "b".repeat(40),
  LIVEKIT_API_KEY: "test",
  LIVEKIT_API_SECRET: "c".repeat(40),
  LIVEKIT_URL: "ws://localhost:7880",
  LIVEKIT_INTERNAL_URL: "http://localhost:7880",
};

describe("mail transport", () => {
  beforeEach(() => mocks.createTransport.mockReset());

  test("uses authenticated generic SMTP first and Gmail as fallback", async () => {
    const generic = {
      verify: vi.fn().mockRejectedValue(new Error("Brevo unavailable")),
      sendMail: vi.fn().mockRejectedValue(new Error("Brevo unavailable")),
    };
    const gmail = {
      verify: vi.fn().mockResolvedValue(undefined),
      sendMail: vi.fn().mockResolvedValue({ messageId: "fallback" }),
    };
    mocks.createTransport.mockReturnValueOnce(generic).mockReturnValueOnce(gmail);

    const mail = mailTransport(config({
      ...baseEnv,
      SMTP_HOST: "smtp-relay.brevo.com",
      SMTP_PORT: "587",
      SMTP_USERNAME: "brevo-user",
      SMTP_PASSWORD: "brevo-password",
      SMTP_SENDER: "sender@example.com",
      GMAIL_HOST: "smtp.gmail.com",
      GMAIL_PORT: "587",
      GMAIL_USERNAME: "gmail-user",
      GMAIL_APP_PASSWORD: "gmail-password",
      GMAIL_SENDER: "gmail@example.com",
    }));

    await expect(mail.verify()).resolves.toBeUndefined();
    await expect(mail.send({ email: "recipient@example.com", otp: "123456", type: "verification" }))
      .resolves.toBeUndefined();
    expect(generic.verify).toHaveBeenCalledOnce();
    expect(generic.sendMail).toHaveBeenCalledOnce();
    expect(gmail.verify).toHaveBeenCalledOnce();
    expect(gmail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "gmail@example.com" }));
    expect(mocks.createTransport).toHaveBeenNthCalledWith(1, expect.objectContaining({
      host: "smtp-relay.brevo.com",
      auth: { user: "brevo-user", pass: "brevo-password" },
    }));
  });

  test("keeps Gmail-only mode on one Gmail transport", async () => {
    const gmail = {
      verify: vi.fn().mockResolvedValue(undefined),
      sendMail: vi.fn().mockResolvedValue({ messageId: "gmail" }),
    };
    mocks.createTransport.mockReturnValue(gmail);

    const mail = mailTransport(config({
      ...baseEnv,
      GMAIL_HOST: "smtp.gmail.com",
      GMAIL_PORT: "587",
      GMAIL_USERNAME: "gmail-user",
      GMAIL_APP_PASSWORD: "gmail-password",
      GMAIL_SENDER: "gmail@example.com",
    }));

    await expect(mail.send({ email: "recipient@example.com", otp: "123456", type: "verification" }))
      .resolves.toBeUndefined();
    expect(mocks.createTransport).toHaveBeenCalledOnce();
    expect(gmail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "gmail@example.com" }));
  });
});
