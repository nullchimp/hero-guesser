import { Mock, vi } from "vitest";
import {
  COPILOT_RUNTIME,
  CopilotRuntime,
  HERO_SYSTEM_MESSAGE
} from "../src/copilot/copilot.runtime.js";
import { AppConfigService } from "../src/config/app-config.service.js";

interface FakeSession {
  disconnect: Mock<() => Promise<void>>;
  sendAndWait: Mock<(options: { prompt: string }, timeoutMs?: number) => Promise<{ data: { content: string } } | undefined>>;
  sessionId: string;
}

interface FakeClient {
  createSession: Mock<(config: Record<string, unknown>) => Promise<FakeSession>>;
  forceStop: Mock<() => Promise<void>>;
  resumeSession: Mock<(sessionId: string, config: Record<string, unknown>) => Promise<FakeSession>>;
  start: Mock<() => Promise<void>>;
  stop: Mock<() => Promise<Error[]>>;
}

function buildFakeClient(): FakeClient {
  return {
    createSession: vi.fn(),
    forceStop: vi.fn(async () => undefined),
    resumeSession: vi.fn(),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => [])
  };
}

function buildFakeSession(sessionId: string, content: string | undefined): FakeSession {
  return {
    disconnect: vi.fn(async () => undefined),
    sendAndWait: vi.fn(async () =>
      content === undefined ? undefined : { data: { content } }
    ),
    sessionId
  };
}

function buildRuntime(client: FakeClient): CopilotRuntime {
  const runtime = new CopilotRuntime({
    copilotHome: "/tmp/copilot-home",
    copilotToken: "test-token"
  } as AppConfigService);
  (runtime as unknown as { client: FakeClient }).client = client;
  return runtime;
}

describe("CopilotRuntime", () => {
  it("exposes the COPILOT_RUNTIME injection token", () => {
    expect(typeof COPILOT_RUNTIME).toBe("symbol");
    expect(COPILOT_RUNTIME.description).toBe("COPILOT_RUNTIME");
  });

  it("ships a system message that mentions hero guesser rules and JSON-only responses", () => {
    expect(HERO_SYSTEM_MESSAGE).toContain("Hero Guesser");
    expect(HERO_SYSTEM_MESSAGE).toContain("JSON");
    expect(HERO_SYSTEM_MESSAGE).toContain("yes");
    expect(HERO_SYSTEM_MESSAGE).toContain("no");
    expect(HERO_SYSTEM_MESSAGE).toContain("unknown");
  });

  describe("sendGameMove", () => {
    it("creates a new SDK session when no id is given, sends the prompt on it, and returns its id", async () => {
      const client = buildFakeClient();
      const session = buildFakeSession(
        "new-session",
        "{\"move\":\"question\",\"question\":\"is it red?\"}"
      );
      client.createSession.mockResolvedValue(session);
      const runtime = buildRuntime(client);

      const result = await runtime.sendGameMove({
        copilotSessionId: null,
        model: "gpt-5.4",
        prompt: "New game. Ask your opening question now."
      });

      expect(result).toEqual({
        content: "{\"move\":\"question\",\"question\":\"is it red?\"}",
        copilotSessionId: "new-session"
      });
      expect(client.createSession).toHaveBeenCalledTimes(1);
      expect(client.resumeSession).not.toHaveBeenCalled();
      const config = client.createSession.mock.calls[0][0];
      expect(config.model).toBe("gpt-5.4");
      expect(config.onPermissionRequest).toBeTypeOf("function");
      expect(config.systemMessage).toMatchObject({
        content: HERO_SYSTEM_MESSAGE,
        mode: "replace"
      });
      expect(session.sendAndWait).toHaveBeenCalledWith(
        { prompt: "New game. Ask your opening question now." },
        expect.any(Number)
      );
      expect(session.disconnect).toHaveBeenCalledTimes(1);
    });

    it("resumes the existing session and returns the assistant content", async () => {
      const client = buildFakeClient();
      const session = buildFakeSession(
        "resumed-session",
        "{\"move\":\"question\",\"question\":\"is it red?\"}"
      );
      client.resumeSession.mockResolvedValue(session);
      const runtime = buildRuntime(client);

      const result = await runtime.sendGameMove({
        copilotSessionId: "resumed-session",
        model: "gpt-5.4",
        prompt: "User answered: yes."
      });

      expect(client.createSession).not.toHaveBeenCalled();
      expect(client.resumeSession).toHaveBeenCalledWith(
        "resumed-session",
        expect.objectContaining({
          model: "gpt-5.4",
          systemMessage: { content: HERO_SYSTEM_MESSAGE, mode: "replace" }
        })
      );
      expect(session.sendAndWait).toHaveBeenCalledWith(
        { prompt: "User answered: yes." },
        expect.any(Number)
      );
      expect(result).toEqual({
        content: "{\"move\":\"question\",\"question\":\"is it red?\"}",
        copilotSessionId: "resumed-session"
      });
      expect(session.disconnect).toHaveBeenCalledTimes(1);
    });

    it("rejects every tool permission request on a newly created session", async () => {
      const client = buildFakeClient();
      const session = buildFakeSession("perm-session", "{\"move\":\"question\",\"question\":\"q?\"}");
      client.createSession.mockResolvedValue(session);
      const runtime = buildRuntime(client);

      await runtime.sendGameMove({
        copilotSessionId: null,
        model: "gpt-5.4",
        prompt: "any"
      });
      const config = client.createSession.mock.calls[0][0] as {
        onPermissionRequest: (request: unknown, invocation: unknown) => Promise<{ kind: string; feedback?: string }>;
      };

      const decision = await config.onPermissionRequest({}, { sessionId: "perm-session" });
      expect(decision.kind).toBe("reject");
    });

    it("throws when the assistant produced no message", async () => {
      const client = buildFakeClient();
      const session = buildFakeSession("empty-session", undefined);
      client.resumeSession.mockResolvedValue(session);
      const runtime = buildRuntime(client);

      await expect(
        runtime.sendGameMove({
          copilotSessionId: "empty-session",
          model: "gpt-5.4",
          prompt: "ignored"
        })
      ).rejects.toThrow("Copilot session produced no assistant message.");
      expect(session.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("lifecycle", () => {
    it("does not start the SDK client when the token is missing", async () => {
      const runtime = new CopilotRuntime({
        copilotHome: undefined,
        copilotToken: "   "
      } as unknown as AppConfigService);

      await runtime.onModuleInit();

      expect((runtime as unknown as { client: unknown }).client).toBeNull();
      await expect(
        runtime.sendGameMove({
          copilotSessionId: null,
          model: "gpt-5.4",
          prompt: "any"
        })
      ).rejects.toThrow(/Copilot SDK runtime is not started/u);
    });

    it("stops the client cleanly on module destroy", async () => {
      const client = buildFakeClient();
      client.stop.mockResolvedValue([]);
      const runtime = buildRuntime(client);

      await runtime.onModuleDestroy();

      expect(client.stop).toHaveBeenCalledTimes(1);
      expect((runtime as unknown as { client: unknown }).client).toBeNull();
    });

    it("falls back to forceStop when stop fails", async () => {
      const client = buildFakeClient();
      client.stop.mockRejectedValue(new Error("stop hung"));
      client.forceStop.mockResolvedValue(undefined);
      const runtime = buildRuntime(client);

      await runtime.onModuleDestroy();

      expect(client.stop).toHaveBeenCalledTimes(1);
      expect(client.forceStop).toHaveBeenCalledTimes(1);
    });
  });
});
