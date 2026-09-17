import * as protocol from "../../../../packages/protocol/src/index.js";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Loosely-typed inputs (plain `string` avatarId/username) rather than the
// exact Zod literal unions: callers (e.g. the avatar grid, populated from
// this same protocol module's `avatarId.options` at runtime) can't prove
// their selection matches the union at compile time. protocol.onboarding's
// own `.parse()` below is what actually enforces the enum — a bad value
// throws there, same as any other invalid input at this boundary.
interface OnboardingInput {
  username: string;
  avatarId: string;
  displayName?: string;
}

export interface ApiClient {
  me(): Promise<z.infer<typeof protocol.meResponse>["user"]>;
  updateMe(
    body: z.infer<typeof protocol.profileUpdate>,
  ): Promise<z.infer<typeof protocol.meResponse>["user"]>;
  completeOnboarding(
    body: OnboardingInput,
  ): Promise<z.infer<typeof protocol.onboardingResponse>["user"]>;
}

// Framework-agnostic on purpose: takes the API base URL and a token getter
// as plain arguments so it can be exercised in tests/extension-auth-flow.test.ts
// against a real in-process backend, and wired to chrome.storage.local only
// at the entrypoint layer (see src/stores/auth-store.ts).
export function createApiClient(baseURL: string, getToken: () => Promise<string | null>): ApiClient {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const token = await getToken();
    if (!token) throw new ApiError("UNAUTHENTICATED", 401, "Not signed in");

    const response = await fetch(`${baseURL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const parsed = protocol.errorResponse.safeParse(await response.json().catch(() => null));
      if (parsed.success) {
        throw new ApiError(parsed.data.error.code, response.status, parsed.data.error.message);
      }
      throw new ApiError("INTERNAL_ERROR", response.status, "Request failed");
    }

    return response.json();
  }

  return {
    async me() {
      return protocol.meResponse.parse(await request("/api/v1/me")).user;
    },
    async updateMe(body) {
      return protocol.meResponse.parse(
        await request("/api/v1/me", {
          method: "PATCH",
          body: JSON.stringify(protocol.profileUpdate.parse(body)),
        }),
      ).user;
    },
    async completeOnboarding(body) {
      return protocol.onboardingResponse.parse(
        await request("/api/v1/me/onboarding", {
          method: "POST",
          body: JSON.stringify(protocol.onboarding.parse(body)),
        }),
      ).user;
    },
  };
}
