import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CodexGateway, HeroGameMove } from "../codex/codex.gateway.js";
import { ModelCatalog } from "../config/model-catalog.service.js";
import { WikipediaService } from "../wikipedia/wikipedia.service.js";
import { ConversationRepository } from "./conversation.repository.js";
import {
  ConversationRecord,
  GameSessionResponse,
  GuessRecord,
  GuessVerdict,
  LeaderboardEntry,
  LeaderboardResponse,
  MessageRecord,
  PlayerAnswer,
  SerializedGuessRecord,
  SerializedMessageRecord,
  SessionSummaryResponse,
  SessionsResponse
} from "./conversation.types.js";

const MAX_QUESTIONS = 10;

interface OwnerInput {
  ownerId: string;
}

interface StartSessionInput extends OwnerInput {
  model?: string;
}

interface SessionInput extends OwnerInput {
  sessionId: string;
}

interface SubmitAnswerInput extends SessionInput {
  answer: PlayerAnswer;
}

interface JudgeGuessInput extends SessionInput {
  guessId: string;
  verdict: GuessVerdict;
}

@Injectable()
export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly codexGateway: CodexGateway,
    private readonly modelCatalog: ModelCatalog,
    private readonly wikipedia: WikipediaService
  ) {}

  async listSessions(input: OwnerInput): Promise<SessionsResponse> {
    const conversations = await this.repository.listSessionSummaries(input.ownerId);
    const sessions = await Promise.all(
      conversations.map(async (conversation) => this.toSessionSummary(conversation))
    );

    return {
      sessions
    };
  }

  async startSession(input: StartSessionInput): Promise<GameSessionResponse> {
    const model = this.modelCatalog.resolve(input.model);
    const conversation = await this.repository.createSession({
      model,
      ownerId: input.ownerId,
      sessionId: createSessionId()
    });

    return this.advanceAi(conversation, {
      forceQuestion: true
    });
  }

  async getSession(input: SessionInput): Promise<GameSessionResponse> {
    const conversation = await this.readSession(input.ownerId, input.sessionId);
    return this.toSessionResponse(conversation);
  }

  async submitAnswer(input: SubmitAnswerInput): Promise<GameSessionResponse> {
    const conversation = await this.readActiveSession(input.ownerId, input.sessionId);
    const messages = await this.repository.listMessages(conversation.id);
    const guesses = await this.repository.listGuesses(conversation.id);
    const pendingGuess = guesses.find((guess) => guess.status === "pending");

    if (pendingGuess !== undefined) {
      throw new BadRequestException("Judge the pending guess before answering another question.");
    }

    if (messages.at(-1)?.kind !== "question") {
      throw new BadRequestException("The session is not waiting for an answer.");
    }

    await this.repository.createMessage({
      content: input.answer,
      conversationId: conversation.id,
      kind: "answer",
      model: conversation.model,
      role: "user",
      status: "complete"
    });

    return this.advanceAi(conversation);
  }

  async judgeGuess(input: JudgeGuessInput): Promise<GameSessionResponse> {
    const conversation = await this.readActiveSession(input.ownerId, input.sessionId);
    const guesses = await this.repository.listGuesses(conversation.id);
    const guess = guesses.find((candidate) => candidate.id === input.guessId);

    if (guess === undefined) {
      throw new NotFoundException("Guess not found.");
    }

    if (guess.status !== "pending") {
      throw new BadRequestException("This guess has already been judged.");
    }

    if (input.verdict === "correct") {
      await this.repository.updateGuessStatus(guess.id, "correct");
      const completed = await this.repository.completeSession(conversation.id, "won");
      return this.toSessionResponse(completed);
    }

    await this.repository.updateGuessStatus(guess.id, "wrong");

    if (conversation.questionsAsked >= MAX_QUESTIONS) {
      const completed = await this.repository.completeSession(conversation.id, "lost");
      return this.toSessionResponse(completed);
    }

    return this.advanceAi(conversation);
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const completedSessions = await this.repository.listCompletedSessions();
    const byModel = new Map<string, {
      games: number;
      losses: number;
      totalWinningQuestions: number;
      wins: number;
    }>();

    for (const session of completedSessions) {
      const stats = byModel.get(session.model) ?? {
        games: 0,
        losses: 0,
        totalWinningQuestions: 0,
        wins: 0
      };

      stats.games += 1;

      if (session.status === "won") {
        stats.wins += 1;
        stats.totalWinningQuestions += session.questionsAsked;
      } else {
        stats.losses += 1;
      }

      byModel.set(session.model, stats);
    }

    return [...byModel.entries()]
      .map(([model, stats]) => ({
        averageQuestionsToWin: stats.wins === 0 ? null : stats.totalWinningQuestions / stats.wins,
        games: stats.games,
        losses: stats.losses,
        model,
        rank: 0,
        winRate: stats.games === 0 ? 0 : stats.wins / stats.games,
        wins: stats.wins
      }))
      .sort(compareLeaderboardEntries)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
  }

  async getLeaderboardResponse(): Promise<LeaderboardResponse> {
    return {
      leaderboard: await this.getLeaderboard()
    };
  }

  private async advanceAi(
    conversation: ConversationRecord,
    options: { forceQuestion?: boolean } = {}
  ): Promise<GameSessionResponse> {
    let blockedGuessFeedback: string | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const messages = await this.repository.listMessages(conversation.id);
      const guesses = await this.repository.listGuesses(conversation.id);
      const result = await this.codexGateway.requestMove({
        blockedGuessFeedback,
        codexThreadId: conversation.codexThreadId,
        forceQuestion: options.forceQuestion === true && attempt === 0,
        guesses,
        history: messages,
        maxQuestions: MAX_QUESTIONS,
        model: conversation.model,
        questionsAsked: conversation.questionsAsked
      });

      if (result.codexThreadId !== null && result.codexThreadId !== conversation.codexThreadId) {
        await this.repository.updateCodexThread(conversation.id, result.codexThreadId);
        conversation = {
          ...conversation,
          codexThreadId: result.codexThreadId
        };
      }

      if (result.move.move === "question") {
        if (conversation.questionsAsked >= MAX_QUESTIONS) {
          blockedGuessFeedback = "You returned a question, but the question budget is exhausted. Submit a specific guess.";
          continue;
        }

        await this.repository.createMessage({
          content: result.move.question,
          conversationId: conversation.id,
          kind: "question",
          model: conversation.model,
          role: "assistant",
          status: "complete"
        });
        conversation = await this.repository.incrementQuestions(conversation.id);
        return this.toSessionResponse(conversation);
      }

      if (options.forceQuestion === true && attempt === 0) {
        blockedGuessFeedback = "You returned a guess, but the opening move must be a yes/no/unknown question.";
        continue;
      }

      const persistedGuess = await this.persistGuessMove(conversation, result.move);

      if (persistedGuess !== null) {
        return this.toSessionResponse(conversation);
      }

      blockedGuessFeedback = [
        `The guess "${result.move.name}" could not be matched to a specific English Wikipedia superhero or villain article with an image.`,
        "Return a better specific guess with a precise Wikipedia title, or ask another yes/no/unknown question if questions remain."
      ].join(" ");
    }

    throw new BadGatewayException("Codex did not return a playable move.");
  }

  private async persistGuessMove(
    conversation: ConversationRecord,
    move: Extract<HeroGameMove, { move: "guess" }>
  ): Promise<GuessRecord | null> {
    const article = await this.wikipedia.enrichGuess(move.name, move.wikipediaSearchTitle);

    if (article === null) {
      return null;
    }

    const message = await this.repository.createMessage({
      content: move.rationale,
      conversationId: conversation.id,
      kind: "guess",
      model: conversation.model,
      role: "assistant",
      status: "complete"
    });

    return this.repository.createGuess({
      article,
      confidence: move.confidence,
      conversationId: conversation.id,
      messageId: message.id,
      name: move.name,
      rationale: move.rationale
    });
  }

  private async readSession(ownerId: string, sessionId: string): Promise<ConversationRecord> {
    const conversation = await this.repository.getSession(ownerId, sessionId);

    if (conversation === null) {
      throw new NotFoundException("Session not found.");
    }

    return conversation;
  }

  private async readActiveSession(ownerId: string, sessionId: string): Promise<ConversationRecord> {
    const conversation = await this.readSession(ownerId, sessionId);

    if (conversation.status !== "active") {
      throw new BadRequestException("This session is already complete.");
    }

    return conversation;
  }

  private async toSessionSummary(conversation: ConversationRecord): Promise<SessionSummaryResponse> {
    const [messages, guesses] = await Promise.all([
      this.repository.listMessages(conversation.id),
      this.repository.listGuesses(conversation.id)
    ]);
    const lastMessage = messages.at(-1);
    const pendingGuess = guesses.find((guess) => guess.status === "pending");

    return {
      completedAt: serializeDate(conversation.completedAt),
      createdAt: conversation.createdAt.toISOString(),
      lastMessage: lastMessage === undefined ? null : summarizeMessage(lastMessage),
      maxQuestions: MAX_QUESTIONS,
      model: conversation.model,
      pendingGuessName: pendingGuess?.name ?? null,
      questionsAsked: conversation.questionsAsked,
      sessionId: conversation.sessionId,
      status: conversation.status,
      updatedAt: conversation.updatedAt.toISOString()
    };
  }

  private async toSessionResponse(conversation: ConversationRecord): Promise<GameSessionResponse> {
    const [messages, guesses] = await Promise.all([
      this.repository.listMessages(conversation.id),
      this.repository.listGuesses(conversation.id)
    ]);

    return {
      completedAt: serializeDate(conversation.completedAt),
      createdAt: conversation.createdAt.toISOString(),
      guesses: guesses.map(serializeGuess),
      maxQuestions: MAX_QUESTIONS,
      messages: messages.map(serializeMessage),
      model: conversation.model,
      ownerId: conversation.ownerId ?? "",
      questionsAsked: conversation.questionsAsked,
      sessionId: conversation.sessionId,
      status: conversation.status,
      updatedAt: conversation.updatedAt.toISOString()
    };
  }
}

export function serializeMessage(message: MessageRecord): SerializedMessageRecord {
  return {
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    errorMessage: message.errorMessage,
    guess: message.guess === null ? null : serializeGuess(message.guess),
    id: message.id,
    kind: message.kind,
    model: message.model,
    role: message.role,
    status: message.status
  };
}

function serializeGuess(guess: GuessRecord): SerializedGuessRecord {
  return {
    articleExtract: guess.articleExtract,
    articleTitle: guess.articleTitle,
    articleUrl: guess.articleUrl,
    confidence: guess.confidence,
    createdAt: guess.createdAt.toISOString(),
    id: guess.id,
    imageHeight: guess.imageHeight,
    imageUrl: guess.imageUrl,
    imageWidth: guess.imageWidth,
    name: guess.name,
    rationale: guess.rationale,
    status: guess.status
  };
}

function summarizeMessage(message: MessageRecord): string {
  if (message.kind === "guess" && message.guess !== null) {
    return `Guess: ${message.guess.name}`;
  }

  if (message.kind === "answer") {
    return `Answer: ${message.content}`;
  }

  return message.content;
}

function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.winRate !== b.winRate) {
    return b.winRate - a.winRate;
  }

  if (a.averageQuestionsToWin === null && b.averageQuestionsToWin !== null) {
    return 1;
  }

  if (a.averageQuestionsToWin !== null && b.averageQuestionsToWin === null) {
    return -1;
  }

  if (a.averageQuestionsToWin !== b.averageQuestionsToWin) {
    return (a.averageQuestionsToWin ?? 0) - (b.averageQuestionsToWin ?? 0);
  }

  return a.model.localeCompare(b.model);
}

function serializeDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function createSessionId(): string {
  return `session-${randomUUID()}`;
}
