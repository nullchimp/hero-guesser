import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ModelCatalog } from "../config/model-catalog.service.js";
import { ConversationService } from "./conversation.service.js";
import { CreateSessionDto } from "./dto/create-session.dto.js";
import { JudgeGuessDto } from "./dto/judge-guess.dto.js";
import { SubmitAnswerDto } from "./dto/submit-answer.dto.js";

@Controller()
@UseGuards(JwtAuthGuard)
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
    @CurrentUser() user: AuthUser
  ): ReturnType<ConversationService["listSessions"]> {
    return this.conversations.listSessions({
      ownerId: user.id
    });
  }

  @Post("sessions")
  async createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionDto
  ): ReturnType<ConversationService["startSession"]> {
    return this.conversations.startSession({
      model: dto.model,
      ownerId: user.id
    });
  }

  @Get("sessions/:sessionId")
  async getSession(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string
  ): ReturnType<ConversationService["getSession"]> {
    return this.conversations.getSession({
      ownerId: user.id,
      sessionId
    });
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string
  ): ReturnType<ConversationService["deleteSession"]> {
    return this.conversations.deleteSession({
      ownerId: user.id,
      sessionId
    });
  }

  @Post("sessions/:sessionId/answers")
  async submitAnswer(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitAnswerDto
  ): ReturnType<ConversationService["submitAnswer"]> {
    return this.conversations.submitAnswer({
      answer: dto.answer,
      ownerId: user.id,
      sessionId
    });
  }

  @Post("sessions/:sessionId/guesses/:guessId/judgment")
  async judgeGuess(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Param("guessId") guessId: string,
    @Body() dto: JudgeGuessDto
  ): ReturnType<ConversationService["judgeGuess"]> {
    return this.conversations.judgeGuess({
      guessId,
      ownerId: user.id,
      sessionId,
      verdict: dto.verdict
    });
  }
}
