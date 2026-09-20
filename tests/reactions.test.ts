import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("reaction tokens", () => {
  it("round-trips supported reactions and leaves unknown text alone", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
    const { decodeReaction, encodeReaction, ROOM_REACTIONS } = await import(
      "../apps/extension/src/features/room/reactions.js"
    );
    const reaction = ROOM_REACTIONS[0]!;

    expect(decodeReaction(encodeReaction(reaction))).toEqual(reaction);
    expect(decodeReaction("[[syncron-reaction:v1:not-supported]]")).toBeNull();
    expect(decodeReaction("prefix [[syncron-reaction:v1:thumbs-up]]")).toBeNull();
    expect(decodeReaction("ordinary chat")).toBeNull();
  });

  it("maps every reaction to a local one-shot APNG", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
    const { ROOM_REACTIONS } = await import("../apps/extension/src/features/room/reactions.js");

    for (const reaction of ROOM_REACTIONS) {
      expect(reaction.icon).toMatch(/^\/emoji\/.+\.png$/);
      const bytes = readFileSync(new URL(`../apps/extension/public${reaction.icon}`, import.meta.url));
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

      let offset = 8;
      let loopCount: number | undefined;
      while (offset < bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString("ascii", offset + 4, offset + 8);
        if (type === "acTL") loopCount = bytes.readUInt32BE(offset + 8 + 4);
        offset += length + 12;
      }

      expect(loopCount).toBe(1);
    }
  });
});
