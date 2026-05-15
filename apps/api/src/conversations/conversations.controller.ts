import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post
} from "@nestjs/common";
import { ModelCatalog } from "../config/model-catalog.service.js";
import { ConversationService } from "./conversation.service.js";
import { CreateSessionDto } from "./dto/create-session.dto.js";
import { JudgeGuessDto } from "./dto/judge-guess.dto.js";
import { SubmitAnswerDto } from "./dto/submit-answer.dto.js";

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

  @Get("leaderboard")
  async getLeaderboard(): ReturnType<ConversationService["getLeaderboardResponse"]> {
    return this.conversations.getLeaderboardResponse();
  }

  @Get("sessions")
  async listSessions(
    @Headers("x-hero-owner-id") ownerId: string | undefined
  ): ReturnType<ConversationService["listSessions"]> {
    return this.conversations.listSessions({
      ownerId: readOwnerId(ownerId)
    });
  }

  @Post("sessions")
  async createSession(
    @Headers("x-hero-owner-id") ownerId: string | undefined,
    @Body() dto: CreateSessionDto
  ): ReturnType<ConversationService["startSession"]> {
    return this.conversations.startSession({
      model: dto.model,
      ownerId: readOwnerId(ownerId)
    });
  }

  @Get("sessions/:sessionId")
  async getSession(
    @Headers("x-hero-owner-id") ownerId: string | undefined,
    @Param("sessionId") sessionId: string
  ): ReturnType<ConversationService["getSession"]> {
    return this.conversations.getSession({
      ownerId: readOwnerId(ownerId),
      sessionId
    });
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @Headers("x-hero-owner-id") ownerId: string | undefined,
    @Param("sessionId") sessionId: string
  ): ReturnType<ConversationService["deleteSession"]> {
    return this.conversations.deleteSession({
      ownerId: readOwnerId(ownerId),
      sessionId
    });
  }

  @Post("sessions/:sessionId/answers")
  async submitAnswer(
    @Headers("x-hero-owner-id") ownerId: string | undefined,
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitAnswerDto
  ): ReturnType<ConversationService["submitAnswer"]> {
    return this.conversations.submitAnswer({
      answer: dto.answer,
      ownerId: readOwnerId(ownerId),
      sessionId
    });
  }

  @Post("sessions/:sessionId/guesses/:guessId/judgment")
  async judgeGuess(
    @Headers("x-hero-owner-id") ownerId: string | undefined,
    @Param("sessionId") sessionId: string,
    @Param("guessId") guessId: string,
    @Body() dto: JudgeGuessDto
  ): ReturnType<ConversationService["judgeGuess"]> {
    return this.conversations.judgeGuess({
      guessId,
      ownerId: readOwnerId(ownerId),
      sessionId,
      verdict: dto.verdict
    });
  }
}

function readOwnerId(ownerId: string | undefined): string {
  const normalizedOwnerId = ownerId?.trim();

  if (!normalizedOwnerId) {
    throw new BadRequestException("Missing X-Hero-Owner-Id header.");
  }

  return normalizedOwnerId;
}
