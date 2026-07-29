import { HttpStatus } from "@nestjs/common";
import { AppConfigService } from "../src/config/app-config.service.js";
import { CanvasAuthError } from "../src/auth/canvas-auth.error.js";
import { GitHubIdentityService } from "../src/auth/github-identity.service.js";

describe("GitHubIdentityService", () => {
  it.each([
    ["a", 1],
    ["a".repeat(39), 123456]
  ])("resolves and normalizes the authenticated GitHub identity", async (login, id) => {
    let requestedUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchFn: typeof fetch = async (input, init) => {
      requestedUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      requestInit = init;
      return jsonResponse({
        id,
        login
      });
    };
    const service = createService("github-token", fetchFn);

    await expect(service.getCurrentIdentity()).resolves.toEqual({
      id: String(id),
      login,
      loginKey: login.toLowerCase()
    });
    expect(requestedUrl).toBe("https://api.github.com/user");
    expect(requestInit?.redirect).toBe("manual");
    expect(new Headers(requestInit?.headers).get("Authorization")).toBe("Bearer github-token");
  });

  it("rejects a missing token without making a request", async () => {
    const fetchFn = vi.fn();
    const service = createService("  ", fetchFn);

    await expect(service.getCurrentIdentity()).rejects.toMatchObject({
      retryable: false,
      status: HttpStatus.SERVICE_UNAVAILABLE
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("classifies an invalid token as a terminal error", async () => {
    const service = createService(
      "bad-token",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    );

    await expect(service.getCurrentIdentity()).rejects.toMatchObject({
      retryable: false,
      status: HttpStatus.UNAUTHORIZED
    });
  });

  it("classifies rate limits and server errors as retryable", async () => {
    const rateLimited = createService(
      "token",
      vi.fn().mockResolvedValue(new Response(null, {
        headers: {
          "X-RateLimit-Remaining": "0"
        },
        status: 403
      }))
    );
    const unavailable = createService(
      "token",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(rateLimited.getCurrentIdentity()).rejects.toMatchObject({
      retryable: true
    });
    await expect(unavailable.getCurrentIdentity()).rejects.toMatchObject({
      retryable: true
    });
  });

  it("rejects malformed identities", async () => {
    const service = createService(
      "token",
      vi.fn().mockResolvedValue(jsonResponse({
        id: "not-a-number",
        login: "invalid_login"
      }))
    );

    await expect(service.getCurrentIdentity()).rejects.toBeInstanceOf(CanvasAuthError);
  });
});

function createService(token: string, fetchFn: typeof fetch): GitHubIdentityService {
  return new GitHubIdentityService(
    {
      copilotToken: token
    } as AppConfigService,
    fetchFn
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: 200
  });
}
