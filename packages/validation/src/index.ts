import { z } from "zod";
export const username = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_][a-z0-9_.]*[a-z0-9_]$/)
  .refine((v) => !["admin", "support", "syncron"].includes(v));
export function initialUsername(email: string, name: string): string {
  for (const candidate of [email.split("@")[0], name.split(/\s+/)[0], "user"]) {
    const value = candidate
      ?.toLowerCase()
      .replace(/[^a-z0-9_.]/g, "")
      .slice(0, 32)
      .replace(/^\.+|\.+$/g, "");
    if (username.safeParse(value).success) return value!;
  }
  return "user";
}
