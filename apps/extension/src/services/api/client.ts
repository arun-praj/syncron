import {
  createRoom as createRoomRequest,
  createRoomResponse,
  errorResponse,
  invitePreview as invitePreviewRequest,
  invitePreviewResponse,
  inviteResponse,
  joinRoom as joinRoomRequest,
  joinRoomResponse,
  leaveRoom as leaveRoomRequest,


  livekitResponse,
  membersResponse,
  meResponse,
  onboarding as onboardingRequest,
  onboardingResponse,
  profileUpdate as profileUpdateRequest,
  roomResponse,
  settings as roomSettingsRequest,
  ticketResponse,
} from "@syncron/protocol";
import { z } from "zod";

import { getStoredToken } from "~/services/auth/client";

// Same origin as the Better Auth client (docker-compose.yml maps the API
// container to host port 8000 in dev).
export const API_BASE_URL = import.meta.env.WXT_API_URL ?? "http://localhost:8000";
// The room WebSocket (services/playback-socket) upgrades on this same
// origin, just over ws(s):// instead of http(s)://.
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(code: string, status: number, message: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const token = await getStoredToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = errorResponse.safeParse(body);
    if (parsed.success) {
      const { code, message, requestId } = parsed.data.error;
      throw new ApiError(code, res.status, message, requestId);
    }
    throw new ApiError("UNKNOWN_ERROR", res.status, "Request failed.");
  }

  return schema.parse(body);
}

export const api = {
  me: () => request("/api/v1/me", meResponse, { method: "GET" }),

  updateMe: (input: z.infer<typeof profileUpdateRequest>) =>
    request("/api/v1/me", meResponse, {
      method: "PATCH",
      body: JSON.stringify(profileUpdateRequest.parse(input)),
    }),

  completeOnboarding: (input: z.infer<typeof onboardingRequest>) =>
    request("/api/v1/me/onboarding", onboardingResponse, {
      method: "POST",
      body: JSON.stringify(onboardingRequest.parse(input)),
    }),

  createRoom: (input: z.infer<typeof createRoomRequest>) =>
    request("/api/v1/rooms", createRoomResponse, {
      method: "POST",
      body: JSON.stringify(createRoomRequest.parse(input)),
    }),

  joinRoom: (invite: string) =>
    request("/api/v1/rooms/join", joinRoomResponse, {
      method: "POST",
      body: JSON.stringify(joinRoomRequest.parse({ invite })),
    }),

  previewInvite: (invite: string) =>
    request("/api/v1/rooms/preview", invitePreviewResponse, {
      method: "POST",
      body: JSON.stringify(invitePreviewRequest.parse({ invite })),
    }),

  getRoomMembers: (roomId: string) =>
    request(`/api/v1/rooms/${roomId}/members`, membersResponse, { method: "GET" }),

  getRoom: (roomId: string) =>
    request(`/api/v1/rooms/${roomId}`, roomResponse, { method: "GET" }),

  updateRoomSettings: (roomId: string, input: z.infer<typeof roomSettingsRequest>) =>
    request(`/api/v1/rooms/${roomId}/settings`, roomResponse, {
      method: "PATCH",
      body: JSON.stringify(roomSettingsRequest.parse(input)),
    }),

  getInvite: (roomId: string) =>
    request(`/api/v1/rooms/${roomId}/invite`, inviteResponse, { method: "GET" }),

  leaveRoom: (roomId: string, input: z.input<typeof leaveRoomRequest> = {}) =>
    request(`/api/v1/rooms/${roomId}/leave`, z.void(), {
      method: "POST",
      body: JSON.stringify(leaveRoomRequest.parse(input)),
    }),

  endRoom: (roomId: string) =>
    request(`/api/v1/rooms/${roomId}/end`, z.void(), {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getWsTicket: (roomId: string) =>
    request(`/api/v1/rooms/${roomId}/ws-ticket`, ticketResponse, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getLivekitToken: (roomId: string) =>
    request(`/api/v1/rooms/${roomId}/livekit-token`, livekitResponse, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
