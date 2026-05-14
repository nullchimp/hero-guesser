import { CodexGateway, CodexStreamEvent } from "../src/codex/codex.gateway.js";
import { ModelCatalog } from "../src/config/model-catalog.service.js";
import { ConversationRepository } from "../src/conversations/conversation.repository.js";
import { ConversationService } from "../src/conversations/conversation.service.js";
import {
  ConversationRecord,
  ConversationStatus,
  MessageRecord
} from "../src/conversations/conversation.types.js";

describe("ConversationService", () => {
  it("persists a browser-session conversation and streams a completed assistant reply", async () => {
    const repository = new FakeConversationRepository();
    const service = new ConversationService(
      repository as unknown as ConversationRepository,
      new FakeCodexGateway([
        { type: "thread", threadId: "codex-thread-1" },
        { type: "sdk-event", sdkType: "turn.started" },
        { type: "assistant-delta", content: "Guess: Batman" },
        { type: "assistant-final", content: "Guess: Batman" }
      ]) as unknown as CodexGateway,
      new FakeModelCatalog("gpt-5.3-codex") as unknown as ModelCatalog
    );

    const events = await collect(
      service.sendMessage({
        content: "A billionaire detective in a cape",
        model: "gpt-5.3-codex",
        sessionId: "browser-session-1"
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      "user-message",
      "assistant-message-start",
      "codex-event",
      "assistant-delta",
      "assistant-message-complete"
    ]);
    expect(repository.conversation.codexThreadId).toBe("codex-thread-1");
    expect(repository.messages).toMatchObject([
      {
        content: "A billionaire detective in a cape",
        role: "user",
        status: "complete"
      },
      {
        content: "Guess: Batman",
        role: "assistant",
        status: "complete"
      }
    ]);
  });

  it("marks the assistant message failed when Codex fails", async () => {
    const repository = new FakeConversationRepository();
    const service = new ConversationService(
      repository as unknown as ConversationRepository,
      new FailingCodexGateway() as unknown as CodexGateway,
      new FakeModelCatalog("gpt-5.3-codex") as unknown as ModelCatalog
    );

    const events = await collect(
      service.sendMessage({
        content: "A fast scarlet speedster",
        model: "gpt-5.3-codex",
        sessionId: "browser-session-1"
      })
    );

    expect(events.at(-1)).toMatchObject({
      error: "Codex unavailable.",
      type: "error"
    });
    expect(repository.messages.at(-1)).toMatchObject({
      errorMessage: "Codex unavailable.",
      role: "assistant",
      status: "failed"
    });
  });
});

class FakeConversationRepository {
  readonly conversation: ConversationRecord = {
    codexThreadId: null,
    id: "conversation-1",
    model: "gpt-5.3-codex",
    sessionId: "browser-session-1"
  };

  readonly messages: MessageRecord[] = [];

  async ensureConversation(sessionId: string, model: string): Promise<ConversationRecord> {
    this.conversation.sessionId = sessionId;
    this.conversation.model = model;
    return this.conversation;
  }

  async listMessages(): Promise<MessageRecord[]> {
    return this.messages;
  }

  async createMessage(input: {
    content: string;
    model?: string;
    role: "user" | "assistant";
    status: ConversationStatus;
  }): Promise<MessageRecord> {
    const message: MessageRecord = {
      content: input.content,
      createdAt: new Date("2026-05-14T12:00:00.000Z"),
      errorMessage: null,
      id: `message-${this.messages.length + 1}`,
      model: input.model ?? null,
      role: input.role,
      status: input.status
    };

    this.messages.push(message);
    return message;
  }

  async updateMessage(
    messageId: string,
    input: { content?: string; errorMessage?: string; status: ConversationStatus }
  ): Promise<MessageRecord> {
    const message = this.messages.find((candidate) => candidate.id === messageId);

    if (message === undefined) {
      throw new Error(`Missing message ${messageId}.`);
    }

    message.content = input.content ?? message.content;
    message.errorMessage = input.errorMessage ?? message.errorMessage;
    message.status = input.status;
    return message;
  }

  async updateCodexThread(_conversationId: string, codexThreadId: string): Promise<void> {
    this.conversation.codexThreadId = codexThreadId;
  }
}

class FakeCodexGateway {
  constructor(private readonly events: CodexStreamEvent[]) {}

  async *streamGuess(): AsyncGenerator<CodexStreamEvent> {
    for (const event of this.events) {
      yield event;
    }
  }
}

class FailingCodexGateway {
  async *streamGuess(): AsyncGenerator<CodexStreamEvent> {
    yield {
      threadId: "codex-thread-1",
      type: "thread"
    };

    throw new Error("Codex unavailable.");
  }
}

class FakeModelCatalog {
  constructor(private readonly model: string) {}

  resolve(): string {
    return this.model;
  }
}

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];

  for await (const event of events) {
    collected.push(event);
  }

  return collected;
}
