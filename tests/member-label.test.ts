import { describe, expect, it, vi } from "vitest";

describe("member labels", () => {
  it("keeps self labels stable and prefixes other usernames once", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
    const { formatMemberLabel } = await import("../apps/extension/src/features/room/member-label.js");

    expect(formatMemberLabel({ id: "self", name: "Syncron user", username: "owner" }, "self")).toBe("You");
    expect(formatMemberLabel({ id: "other", name: "Syncron user", username: "member" }, "self")).toBe("@member");
    expect(formatMemberLabel({ id: "other", name: "Syncron user", username: "@member" }, "self")).toBe("@member");
    expect(formatMemberLabel({ id: "other", name: "Display name" }, "self")).toBe("Display name");
    expect(formatMemberLabel(null, "self")).toBe("Someone");
  });
});
