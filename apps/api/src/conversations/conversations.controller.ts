import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Res
} from "@nestjs/common";
import type { Response } from "express";
import { ModelCatalog } from "../config/model-catalog.service.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import { ConversationService, serializeMessage } from "./conversation.service.js";
import {
  ConversationResponse,
  ConversationStreamEvent
} from "./conversation.types.js";

@Controller()
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly modelCatalog: ModelCatalog
  ) {}

  @Get("models")
  getModels(): ReturnType<ModelCatalog["list"]> {
    return this.modelCatalog.list();
  }

  @Get("conversation")
  async getConversation(
    @Headers("x-hero-session-id") sessionId: string | undefined
  ): Promise<Record<string, unknown>> {
    const conversation = await this.conversations.getConversation(readSessionId(sessionId));
    return serializeConversation(conversation);
  }

  @Post("conversation/messages")
  @HttpCode(200)
  async postMessage(
    @Headers("x-hero-session-id") sessionId: string | undefined,
    @Body() dto: SendMessageDto,
    @Res() response: Response
  ): Promise<void> {
    response.status(200);
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    try {
      for await (const event of this.conversations.sendMessage({
        content: dto.content,
        model: dto.model,
        sessionId: readSessionId(sessionId)
      })) {
        writeSse(response, event.type, serializeStreamEvent(event));
      }
    } catch (error) {
      writeSse(response, "error", {
        error: error instanceof Error ? error.message : "Request failed.",
        type: "error"
      });
    } finally {
      response.end();
    }
  }
}

function readSessionId(sessionId: string | undefined): string {
  const normalizedSessionId = sessionId?.trim();

  if (!normalizedSessionId) {
    throw new BadRequestException("Missing X-Hero-Session-Id header.");
  }

  return normalizedSessionId;
}

function serializeConversation(conversation: ConversationResponse): Record<string, unknown> {
  return {
    messages: conversation.messages.map(serializeMessage),
    model: conversation.model,
    sessionId: conversation.sessionId
  };
}

function serializeStreamEvent(event: ConversationStreamEvent): Record<string, unknown> {
  if (
    event.type === "user-message" ||
    event.type === "assistant-message-start" ||
    event.type === "assistant-message-complete" ||
    event.type === "error"
  ) {
    return {
      ...event,
      message: event.message === undefined ? undefined : serializeMessage(event.message)
    };
  }

  if (event.type === "assistant-delta") {
    return {
      content: event.content,
      type: event.type
    };
  }

  return {
    message: event.message,
    sdkType: event.sdkType,
    type: event.type
  };
}

function writeSse(response: Response, event: string, data: Record<string, unknown>): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}
