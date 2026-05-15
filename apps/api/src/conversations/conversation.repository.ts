import { Injectable } from "@nestjs/common";
import {
  GameStatus as PrismaGameStatus,
  GuessStatus as PrismaGuessStatus,
  MessageKind as PrismaMessageKind,
  MessageRole,
  MessageStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  ConversationRecord,
  ConversationRole,
  ConversationStatus,
  GameStatus,
  GuessRecord,
  GuessStatus,
  MessageKind,
  MessageRecord,
  WikipediaArticleRecord
} from "./conversation.types.js";

interface CreateSessionInput {
  model: string;
  ownerId: string;
  sessionId: string;
}

interface CreateMessageInput {
  content: string;
  conversationId: string;
  kind: MessageKind;
  model?: string;
  role: ConversationRole;
  status: ConversationStatus;
}

interface CreateGuessInput {
  article: WikipediaArticleRecord;
  confidence: string;
  conversationId: string;
  messageId: string;
  name: string;
  rationale: string;
}

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateSessionInput): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.create({
      data: {
        model: input.model,
        ownerId: input.ownerId,
        sessionId: input.sessionId
      }
    });

    return mapConversation(conversation);
  }

  async listSessionSummaries(ownerId: string): Promise<ConversationRecord[]> {
    const conversations = await this.prisma.conversation.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      where: {
        ownerId
      }
    });

    return conversations.map(mapConversation);
  }

  async getSession(ownerId: string, sessionId: string): Promise<ConversationRecord | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        ownerId,
        sessionId
      }
    });

    return conversation === null ? null : mapConversation(conversation);
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const messages = await this.prisma.message.findMany({
      include: {
        guess: true
      },
      orderBy: {
        createdAt: "asc"
      },
      where: {
        conversationId
      }
    });

    return messages.map(mapMessage);
  }

  async listGuesses(conversationId: string): Promise<GuessRecord[]> {
    const guesses = await this.prisma.guess.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        conversationId
      }
    });

    return guesses.map(mapGuess);
  }

  async createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    const message = await this.prisma.message.create({
      data: {
        content: input.content,
        conversationId: input.conversationId,
        kind: toPrismaKind(input.kind),
        model: input.model,
        role: toPrismaRole(input.role),
        status: toPrismaStatus(input.status)
      },
      include: {
        guess: true
      }
    });

    return mapMessage(message);
  }

  async incrementQuestions(conversationId: string): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.update({
      data: {
        questionsAsked: {
          increment: 1
        }
      },
      where: {
        id: conversationId
      }
    });

    return mapConversation(conversation);
  }

  async createGuess(input: CreateGuessInput): Promise<GuessRecord> {
    const guess = await this.prisma.guess.create({
      data: {
        articleExtract: input.article.extract,
        articleTitle: input.article.title,
        articleUrl: input.article.url,
        confidence: input.confidence,
        conversationId: input.conversationId,
        imageHeight: input.article.imageHeight,
        imageUrl: input.article.imageUrl,
        imageWidth: input.article.imageWidth,
        messageId: input.messageId,
        name: input.name,
        rationale: input.rationale
      }
    });

    return mapGuess(guess);
  }

  async updateGuessStatus(guessId: string, status: GuessStatus): Promise<GuessRecord> {
    const guess = await this.prisma.guess.update({
      data: {
        status: toPrismaGuessStatus(status)
      },
      where: {
        id: guessId
      }
    });

    return mapGuess(guess);
  }

  async completeSession(
    conversationId: string,
    status: Exclude<GameStatus, "active">
  ): Promise<ConversationRecord> {
    const conversation = await this.prisma.conversation.update({
      data: {
        completedAt: new Date(),
        status: toPrismaGameStatus(status)
      },
      where: {
        id: conversationId
      }
    });

    return mapConversation(conversation);
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

  async deleteSession(conversationId: string): Promise<void> {
    await this.prisma.conversation.delete({
      where: {
        id: conversationId
      }
    });
  }

  async listCompletedSessions(): Promise<ConversationRecord[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        status: {
          in: [
            PrismaGameStatus.WON,
            PrismaGameStatus.LOST
          ]
        }
      }
    });

    return conversations.map(mapConversation);
  }
}

interface PrismaConversation {
  codexThreadId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  id: string;
  model: string;
  ownerId: string | null;
  questionsAsked: number;
  sessionId: string;
  status: PrismaGameStatus;
  updatedAt: Date;
}

interface PrismaMessage {
  content: string;
  conversationId: string;
  createdAt: Date;
  errorMessage: string | null;
  guess: PrismaGuess | null;
  id: string;
  kind: PrismaMessageKind;
  model: string | null;
  role: MessageRole;
  status: MessageStatus;
}

interface PrismaGuess {
  articleExtract: string;
  articleTitle: string;
  articleUrl: string;
  confidence: string;
  conversationId: string;
  createdAt: Date;
  id: string;
  imageHeight: number | null;
  imageUrl: string;
  imageWidth: number | null;
  messageId: string;
  name: string;
  rationale: string;
  status: PrismaGuessStatus;
}

function mapConversation(conversation: PrismaConversation): ConversationRecord {
  return {
    codexThreadId: conversation.codexThreadId,
    completedAt: conversation.completedAt,
    createdAt: conversation.createdAt,
    id: conversation.id,
    model: conversation.model,
    ownerId: conversation.ownerId,
    questionsAsked: conversation.questionsAsked,
    sessionId: conversation.sessionId,
    status: fromPrismaGameStatus(conversation.status),
    updatedAt: conversation.updatedAt
  };
}

function mapMessage(message: PrismaMessage): MessageRecord {
  return {
    content: message.content,
    conversationId: message.conversationId,
    createdAt: message.createdAt,
    errorMessage: message.errorMessage,
    guess: message.guess === null ? null : mapGuess(message.guess),
    id: message.id,
    kind: fromPrismaKind(message.kind),
    model: message.model,
    role: fromPrismaRole(message.role),
    status: fromPrismaStatus(message.status)
  };
}

function mapGuess(guess: PrismaGuess): GuessRecord {
  return {
    articleExtract: guess.articleExtract,
    articleTitle: guess.articleTitle,
    articleUrl: guess.articleUrl,
    confidence: guess.confidence,
    conversationId: guess.conversationId,
    createdAt: guess.createdAt,
    id: guess.id,
    imageHeight: guess.imageHeight,
    imageUrl: guess.imageUrl,
    imageWidth: guess.imageWidth,
    messageId: guess.messageId,
    name: guess.name,
    rationale: guess.rationale,
    status: fromPrismaGuessStatus(guess.status)
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

function toPrismaKind(kind: MessageKind): PrismaMessageKind {
  if (kind === "answer") {
    return PrismaMessageKind.ANSWER;
  }

  if (kind === "question") {
    return PrismaMessageKind.QUESTION;
  }

  if (kind === "guess") {
    return PrismaMessageKind.GUESS;
  }

  return PrismaMessageKind.CHAT;
}

function fromPrismaKind(kind: PrismaMessageKind): MessageKind {
  if (kind === PrismaMessageKind.ANSWER) {
    return "answer";
  }

  if (kind === PrismaMessageKind.QUESTION) {
    return "question";
  }

  if (kind === PrismaMessageKind.GUESS) {
    return "guess";
  }

  return "chat";
}

function toPrismaGameStatus(status: GameStatus): PrismaGameStatus {
  if (status === "won") {
    return PrismaGameStatus.WON;
  }

  if (status === "lost") {
    return PrismaGameStatus.LOST;
  }

  return PrismaGameStatus.ACTIVE;
}

function fromPrismaGameStatus(status: PrismaGameStatus): GameStatus {
  if (status === PrismaGameStatus.WON) {
    return "won";
  }

  if (status === PrismaGameStatus.LOST) {
    return "lost";
  }

  return "active";
}

function toPrismaGuessStatus(status: GuessStatus): PrismaGuessStatus {
  if (status === "correct") {
    return PrismaGuessStatus.CORRECT;
  }

  if (status === "wrong") {
    return PrismaGuessStatus.WRONG;
  }

  return PrismaGuessStatus.PENDING;
}

function fromPrismaGuessStatus(status: PrismaGuessStatus): GuessStatus {
  if (status === PrismaGuessStatus.CORRECT) {
    return "correct";
  }

  if (status === PrismaGuessStatus.WRONG) {
    return "wrong";
  }

  return "pending";
}
