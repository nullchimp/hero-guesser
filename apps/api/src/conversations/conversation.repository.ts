import { Injectable } from "@nestjs/common";
import { MessageRole, MessageStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  ConversationRecord,
  ConversationRole,
  ConversationStatus,
  MessageRecord
} from "./conversation.types.js";

interface CreateMessageInput {
  content: string;
  conversationId: string;
  model?: string;
  role: ConversationRole;
  status: ConversationStatus;
}

interface UpdateMessageInput {
  content?: string;
  errorMessage?: string;
  status: ConversationStatus;
}

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureConversation(sessionId: string, model: string): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.upsert({
      create: {
        model,
        sessionId
      },
      update: {
        model
      },
      where: {
        sessionId
      }
    });

    return {
      codexThreadId: conversation.codexThreadId,
      id: conversation.id,
      model: conversation.model,
      sessionId: conversation.sessionId
    };
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const messages = await this.prisma.message.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        conversationId
      }
    });

    return messages.map(mapMessage);
  }

  async createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    const message = await this.prisma.message.create({
      data: {
        content: input.content,
        conversationId: input.conversationId,
        model: input.model,
        role: toPrismaRole(input.role),
        status: toPrismaStatus(input.status)
      }
    });

    return mapMessage(message);
  }

  async updateMessage(messageId: string, input: UpdateMessageInput): Promise<MessageRecord> {
    const message = await this.prisma.message.update({
      data: {
        content: input.content,
        errorMessage: input.errorMessage,
        status: toPrismaStatus(input.status)
      },
      where: {
        id: messageId
      }
    });

    return mapMessage(message);
  }

  async updateCodexThread(conversationId: string, codexThreadId: string): Promise<void> {
    await this.prisma.conversation.update({
      data: {
        codexThreadId
      },
      where: {
        id: conversationId
      }
    });
  }
}

interface PrismaMessage {
  content: string;
  createdAt: Date;
  errorMessage: string | null;
  id: string;
  model: string | null;
  role: MessageRole;
  status: MessageStatus;
}

function mapMessage(message: PrismaMessage): MessageRecord {
  return {
    content: message.content,
    createdAt: message.createdAt,
    errorMessage: message.errorMessage,
    id: message.id,
    model: message.model,
    role: fromPrismaRole(message.role),
    status: fromPrismaStatus(message.status)
  };
}

function toPrismaRole(role: ConversationRole): MessageRole {
  return role === "user" ? MessageRole.USER : MessageRole.ASSISTANT;
}

function fromPrismaRole(role: MessageRole): ConversationRole {
  return role === MessageRole.USER ? "user" : "assistant";
}

function toPrismaStatus(status: ConversationStatus): MessageStatus {
  if (status === "complete") {
    return MessageStatus.COMPLETE;
  }

  if (status === "streaming") {
    return MessageStatus.STREAMING;
  }

  return MessageStatus.FAILED;
}

function fromPrismaStatus(status: MessageStatus): ConversationStatus {
  if (status === MessageStatus.COMPLETE) {
    return "complete";
  }

  if (status === MessageStatus.STREAMING) {
    return "streaming";
  }

  return "failed";
}
