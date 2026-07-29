import { AuthService } from "../src/auth/auth.service.js";
import { AuthController } from "../src/auth/auth.controller.js";
import {
  CanvasAuthService
} from "../src/auth/canvas-auth.service.js";
import { GitHubIdentityService } from "../src/auth/github-identity.service.js";

describe("CanvasAuthService", () => {
  it("exchanges a code idempotently for the same session", async () => {
    const loginWithGitHub = vi.fn().mockResolvedValue(authSession());
    const service = createService({
      loginWithGitHub
    });
    const bootstrap = await service.createBootstrap("127.0.0.1");

    const [first, second] = await Promise.all([
      service.exchange(bootstrap.code),
      service.exchange(bootstrap.code)
    ]);

    expect(first).toEqual(authSession());
    expect(second).toEqual(authSession());
    expect(loginWithGitHub).toHaveBeenCalledTimes(1);
  });

  it("expires bootstrap codes", async () => {
    let now = Date.parse("2026-07-29T00:00:00.000Z");
    const service = createService({
      clock: () => now
    });
    const bootstrap = await service.createBootstrap("127.0.0.1");
    now += 60_001;

    await expect(service.exchange(bootstrap.code)).rejects.toMatchObject({
      retryable: false,
      status: 401
    });
  });

  describe("AuthController Canvas bootstrap", () => {
    it("rejects browser-origin bootstrap requests before creating a code", async () => {
      const createBootstrap = vi.fn();
      const controller = new AuthController(
        {} as AuthService,
        {
          createBootstrap
        } as unknown as CanvasAuthService
      );

      await expect(controller.createCanvasBootstrap(
        "http://localhost:8080",
        "127.0.0.1"
      )).rejects.toMatchObject({
        retryable: false,
        status: 403
      });
      expect(createBootstrap).not.toHaveBeenCalled();
    });
  });

  it("retries authentication after a failed exchange", async () => {
    const loginWithGitHub = vi.fn()
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce(authSession());
    const service = createService({
      loginWithGitHub
    });
    const bootstrap = await service.createBootstrap("127.0.0.1");

    await expect(service.exchange(bootstrap.code)).rejects.toThrow("temporary database failure");
    await expect(service.exchange(bootstrap.code)).resolves.toEqual(authSession());
    expect(loginWithGitHub).toHaveBeenCalledTimes(2);
  });

  it("rate-limits repeated bootstrap creation by source", async () => {
    const service = createService();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await service.createBootstrap("127.0.0.1");
    }

    await expect(service.createBootstrap("127.0.0.1")).rejects.toMatchObject({
      retryable: true,
      status: 429
    });
  });
});

function createService({
  clock = () => Date.parse("2026-07-29T00:00:00.000Z"),
  loginWithGitHub = vi.fn().mockResolvedValue(authSession())
}: {
  clock?: () => number;
  loginWithGitHub?: ReturnType<typeof vi.fn>;
} = {}): CanvasAuthService {
  let nextByte = 0;
  const random = (size: number): Buffer => {
    nextByte += 1;
    return Buffer.alloc(size, nextByte);
  };
  const github = {
    getCurrentIdentity: vi.fn().mockResolvedValue({
      id: "12345",
      login: "Nullchimp",
      loginKey: "nullchimp"
    })
  };

  return new CanvasAuthService(
    {
      loginWithGitHub
    } as unknown as AuthService,
    github as unknown as GitHubIdentityService,
    clock,
    random
  );
}

function authSession() {
  return {
    token: "app-token",
    user: {
      heroname: "Nullchimp",
      id: "user-1"
    }
  };
}
