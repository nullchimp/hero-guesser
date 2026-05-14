import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import type { ConversationMessage, StreamEvent } from "./services/api";

const api = vi.hoisted(() => ({
  fetchConversation: vi.fn(),
  fetchModels: vi.fn(),
  getSessionId: vi.fn(),
  sendMessageStream: vi.fn()
}));

vi.mock("./services/api", () => api);

describe("App", () => {
  beforeEach(() => {
    api.fetchConversation.mockReset();
    api.fetchModels.mockReset();
    api.getSessionId.mockReturnValue("browser-session-1");
    api.sendMessageStream.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("loads persisted conversation history and server-configured models", async () => {
    api.fetchModels.mockResolvedValue({
      defaultModel: "gpt-5.3-codex",
      models: [
        { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
        { id: "gpt-5.4-mini", label: "gpt-5.4-mini" }
      ]
    });
    api.fetchConversation.mockResolvedValue({
      messages: [
        message({
          content: "Guess: Wonder Woman",
          id: "message-1",
          role: "assistant"
        })
      ],
      model: "gpt-5.4-mini",
      sessionId: "browser-session-1"
    });

    render(App);

    expect(await screen.findByText("Guess: Wonder Woman")).not.toBeNull();
    expect(screen.getByLabelText<HTMLSelectElement>("Model").value).toBe("gpt-5.4-mini");
  });

  it("submits a clue and renders streamed assistant output", async () => {
    api.fetchModels.mockResolvedValue({
      defaultModel: "gpt-5.3-codex",
      models: [
        { id: "gpt-5.3-codex", label: "gpt-5.3-codex" }
      ]
    });
    api.fetchConversation.mockResolvedValue({
      messages: [],
      model: "gpt-5.3-codex",
      sessionId: "browser-session-1"
    });
    api.sendMessageStream.mockImplementation(
      async (
        _sessionId: string,
        _content: string,
        _model: string,
        onEvent: (event: StreamEvent) => void
      ) => {
        onEvent({
          message: message({
            content: "Fast scarlet speedster",
            id: "message-1",
            role: "user"
          }),
          type: "user-message"
        });
        onEvent({
          message: message({
            content: "",
            id: "message-2",
            role: "assistant",
            status: "streaming"
          }),
          type: "assistant-message-start"
        });
        onEvent({
          content: "Guess: The Flash",
          type: "assistant-delta"
        });
        onEvent({
          message: message({
            content: "Guess: The Flash",
            id: "message-2",
            role: "assistant"
          }),
          type: "assistant-message-complete"
        });
      }
    );

    render(App);

    await screen.findByText("Ready for a clue.");
    await fireEvent.update(screen.getByLabelText("Clue"), "Fast scarlet speedster");
    await fireEvent.click(screen.getByRole("button", { name: "Guess" }));

    await waitFor(() => {
      expect(screen.getByText("Guess: The Flash")).not.toBeNull();
    });
    expect(api.sendMessageStream).toHaveBeenCalledWith(
      "browser-session-1",
      "Fast scarlet speedster",
      "gpt-5.3-codex",
      expect.any(Function)
    );
  });
});

function message(overrides: Partial<ConversationMessage>): ConversationMessage {
  return {
    ...baseMessage(),
    ...overrides
  };
}

function baseMessage(): ConversationMessage {
  return {
    content: "",
    createdAt: "2026-05-14T12:00:00.000Z",
    errorMessage: null,
    id: "message",
    model: "gpt-5.3-codex",
    role: "assistant" as const,
    status: "complete" as const
  };
}
