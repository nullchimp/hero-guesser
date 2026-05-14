import { Injectable } from "@nestjs/common";
import { CodexGateway } from "../codex/codex.gateway.js";
import { ModelCatalog } from "../config/model-catalog.service.js";
import { ConversationRepository } from "./conversation.repository.js";
import {
  ConversationResponse,
  ConversationStreamEvent,
  MessageRecord
} from "./conversation.types.js";

interface SendMessageInput {
  content: string;
  model?: string;
  sessionId: string;
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly codexGateway: CodexGateway,
    private readonly modelCatalog: ModelCatalog
  ) {}

  async getConversation(sessionId: string): Promise<ConversationResponse> {
    const model = this.modelCatalog.resolve(undefined);
    const conversation = await this.repository.ensureConversation(sessionId, model);
    const messages = await this.repository.listMessages(conversation.id);

    return {
      messages,
      model: conversation.model,
      sessionId
    };
  }

  async *sendMessage(input: SendMessageInput): AsyncGenerator<ConversationStreamEvent> {
    const content = input.content.trim();
    const model = this.modelCatalog.resolve(input.model);
    const conversation = await this.repository.ensureConversation(input.sessionId, model);
    const userMessage = await this.repository.createMessage({
      content,
      conversationId: conversation.id,
      model,
      role: "user",
      status: "complete"
    });

    yield {
      message: userMessage,
      type: "user-message"
    };

    const assistantMessage = await this.repository.createMessage({
      content: "",
      conversationId: conversation.id,
      model,
      role: "assistant",
      status: "streaming"
    });

    yield {
      message: assistantMessage,
      type: "assistant-message-start"
    };

    let assistantContent = "";

    try {
      for await (const event of this.codexGateway.streamGuess({
        clue: content,
        codexThreadId: conversation.codexThreadId,
        model
      })) {
        if (event.type === "thread") {
          await this.repository.updateCodexThread(conversation.id, event.threadId);
        }

        if (event.type === "sdk-event") {
          yield {
            message: event.message,
            sdkType: event.sdkType,
            type: "codex-event"
          };
        }

        if (event.type === "assistant-delta") {
          assistantContent += event.content;

          yield {
            content: event.content,
            type: "assistant-delta"
          };
        }

        if (event.type === "assistant-final" && event.content !== assistantContent) {
          const delta = event.content.slice(assistantContent.length);
          assistantContent = event.content;

          if (delta.length > 0) {
            yield {
              content: delta,
              type: "assistant-delta"
            };
          }
        }
      }

      const completedMessage = await this.repository.updateMessage(assistantMessage.id, {
        content: assistantContent,
        status: "complete"
      });

      yield {
        message: completedMessage,
        type: "assistant-message-complete"
      };
    } catch (error) {
      const failedMessage = await this.repository.updateMessage(assistantMessage.id, {
        content: assistantContent,
        errorMessage: toErrorMessage(error),
        status: "failed"
      });

      yield {
        error: failedMessage.errorMessage ?? "Codex request failed.",
        message: failedMessage,
        type: "error"
      };
    }
  }
}

export function serializeMessage(message: MessageRecord): Record<string, unknown> {
  return {
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    errorMessage: message.errorMessage,
    id: message.id,
    model: message.model,
    role: message.role,
    status: message.status
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Codex request failed.";
}
