import { inviteClaims } from "../../../packages/protocol/src/index.js";
import { DomainError } from "../../../packages/shared/src/index.js";
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (v: string) =>
  Uint8Array.from(atob(v.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
export class Invites {
  private key: Promise<CryptoKey>;
  constructor(
    secret: string,
    private appUrl: string,
  ) {
    this.key = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  async issue(roomId: string, inviteVersion: number) {
    const payload = encode(
      new TextEncoder().encode(JSON.stringify({ roomId, inviteVersion })),
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.key,
      new TextEncoder().encode(payload),
    );
    return `${this.appUrl.replace(/\/$/, "")}/join#invite=${payload}.${encode(new Uint8Array(signature))}`;
  }
  async verify(token: string) {
    try {
      const [payload, signature, ...rest] = token.split(".");
      if (
        !payload ||
        !signature ||
        rest.length ||
        token.length > 1024 ||
        !(await crypto.subtle.verify(
          "HMAC",
          await this.key,
          decode(signature),
          new TextEncoder().encode(payload),
        ))
      )
        throw new Error();
      return inviteClaims.parse(
        JSON.parse(new TextDecoder().decode(decode(payload))),
      );
    } catch {
      throw new DomainError("INVITE_INVALID");
    }
  }
}
