import {
  createRoom as createRoomRequest,
  createRoomResponse,
  errorResponse,
  meResponse,
  onboarding as onboardingRequest,
  onboardingResponse,
  profileUpdate as profileUpdateRequest,
} from "@syncron/protocol";
import type { z } from "zod";

import { getStoredToken } from "~/services/auth/client";

// Same origin as the Better Auth client (docker-compose.yml maps the API
// container to host port 8000 in dev).
const API_BASE_URL = import.meta.env.WXT_API_URL ?? "http://localhost:8000";

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
};
