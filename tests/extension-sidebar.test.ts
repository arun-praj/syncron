import { describe, expect, it } from "vitest";

import {
  isActivateYoutubeSidebarMessage,
  isOpenYoutubeSidebarMessage,
  isOpenServiceTabMessage,
  isSyncronJoinInviteMessage,
  isSyncronPreviewInviteMessage,
  isSyncronPingMessage,
  isYoutubeContentReadyMessage,
} from "../apps/extension/src/lib/extension-messages.js";
import { closedYoutubeRoomTabIds } from "../apps/extension/src/lib/room-session.js";

describe("extension sidebar messages", () => {
  it("finds durable room records whose tabs are closed", () => {
    expect(closedYoutubeRoomTabIds([4, 9], [9, 12])).toEqual([4]);
  });

  it("accepts only complete tab activation messages", () => {
    expect(isActivateYoutubeSidebarMessage({ type: "syncron:activate-youtube-sidebar", tabId: 12 })).toBe(true);
    expect(isActivateYoutubeSidebarMessage({ type: "syncron:activate-youtube-sidebar", tabId: "12" })).toBe(false);
    expect(isActivateYoutubeSidebarMessage({ type: "syncron:activate-youtube-sidebar" })).toBe(false);
  });

  it("accepts an activation message that also carries a joined-room snapshot", () => {
    const joinedRoom = {
      roomId: "room_1",
      isHost: false,
      everyoneCanControl: false,
      allowMembersToShareInvite: false,
      inviteUrl: null,
      members: [{ id: "u1", name: "You", avatarId: "1", isHost: false }],
    };
    expect(
      isActivateYoutubeSidebarMessage({
        type: "syncron:activate-youtube-sidebar",
        tabId: 12,
        joinedRoom,
      }),
    ).toBe(true);
  });

  it("only accepts a join-invite message with a non-empty invite string", () => {
    expect(isSyncronPingMessage({ type: "syncron:ping" })).toBe(true);
    expect(isSyncronPingMessage({ type: "syncron:join-invite" })).toBe(false);
    const join = {
      type: "syncron:join-invite",
      invite: "tok_abc",
      microphoneEnabled: false,
      cameraEnabled: false,
    };
    expect(isSyncronJoinInviteMessage(join)).toBe(true);
    expect(isSyncronPreviewInviteMessage({ type: "syncron:preview-invite", invite: "tok_abc" })).toBe(true);
    expect(isSyncronPreviewInviteMessage({ type: "syncron:preview-invite", invite: "" })).toBe(false);
    expect(isSyncronJoinInviteMessage({ ...join, microphoneEnabled: "false" })).toBe(false);
    expect(isSyncronJoinInviteMessage({ ...join, cameraEnabled: 0 })).toBe(false);
    expect(isSyncronJoinInviteMessage({ type: "syncron:join-invite", invite: "" })).toBe(false);
    expect(isSyncronJoinInviteMessage({ type: "syncron:join-invite" })).toBe(false);
    expect(isSyncronJoinInviteMessage({ type: "syncron:ping" })).toBe(false);
  });

  it("keeps service-tab requests and content readiness distinguishable", () => {
    expect(
      isOpenServiceTabMessage({
        type: "syncron:open-service-tab",
        href: "https://www.youtube.com",
        serviceId: "YOUTUBE",
      }),
    ).toBe(true);
    expect(
      isOpenServiceTabMessage({
        type: "syncron:open-service-tab",
        href: "https://example.com",
        serviceId: "UNKNOWN",
      }),
    ).toBe(false);
    expect(isYoutubeContentReadyMessage({ type: "syncron:youtube-content-ready" })).toBe(true);
    expect(isYoutubeContentReadyMessage({ type: "syncron:open-service-tab" })).toBe(false);
  });

  it("accepts only a numeric current-tab sidebar request", () => {
    expect(isOpenYoutubeSidebarMessage({ type: "syncron:open-youtube-sidebar", tabId: 12 })).toBe(true);
    expect(isOpenYoutubeSidebarMessage({ type: "syncron:open-youtube-sidebar", tabId: "12" })).toBe(false);
  });
});
