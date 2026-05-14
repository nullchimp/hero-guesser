import {
  BadGatewayException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import { Codex } from "@openai/codex-sdk";
import { mkdir } from "node:fs/promises";
import { AppConfigService } from "../config/app-config.service.js";
import { GuessRecord, MessageRecord } from "../conversations/conversation.types.js";
import { buildHeroGamePrompt } from "./hero-guess.prompt.js";

export type HeroGameMove =
  | {
      move: "question";
      question: string;
    }
  | {
      confidence: "low" | "medium" | "high";
      move: "guess";
      name: string;
      rationale: string;
      wikipediaSearchTitle: string;
    };

export interface CodexMoveRequest {
  blockedGuessFeedback?: string;
  codexThreadId?: string | null;
  forceQuestion?: boolean;
  guesses?: GuessRecord[];
  history: MessageRecord[];
  maxQuestions: number;
  model: string;
  questionsAsked: number;
}

export interface CodexMoveResult {
  codexThreadId: string | null;
  move: HeroGameMove;
}

export const heroMoveOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    confidence: {
      enum: [
        "none",
        "low",
        "medium",
        "high"
      ],
      type: "string"
    },
    move: {
      enum: [
        "question",
        "guess"
      ],
      type: "string"
    },
    name: {
      type: "string"
    },
    question: {
      type: "string"
    },
    rationale: {
      type: "string"
    },
    wikipediaSearchTitle: {
      type: "string"
    }
  },
  required: [
    "confidence",
    "move",
    "name",
    "question",
    "rationale",
    "wikipediaSearchTitle"
  ]
} as const;

export const CODEX_FACTORY = Symbol("CODEX_FACTORY");

type CodexFactory = (options: { apiKey: string }) => CodexClient;

interface CodexClient {
  resumeThread(id: string, options?: unknown): CodexThread;
  startThread(options?: unknown): CodexThread;
}

interface CodexThread {
  id: string | null;
  run(input: string, options?: { outputSchema: unknown }): Promise<{ finalResponse: string }>;
}

@Injectable()
export class CodexGateway {
  constructor(
    private readonly config: AppConfigService,
    @Optional()
    @Inject(CODEX_FACTORY)
    private readonly createCodex: CodexFactory = (options) => new Codex(options)
  ) {}

  async requestMove(request: CodexMoveRequest): Promise<CodexMoveResult> {
    if (this.config.openAiApiKey.trim().length === 0) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured.");
    }

    await mkdir(this.config.codexWorkspace, { recursive: true });

    const codex = this.createCodex({
      apiKey: this.config.openAiApiKey
    });
    const threadOptions = {
      model: request.model,
      networkAccessEnabled: false,
      skipGitRepoCheck: true,
      workingDirectory: this.config.codexWorkspace
    };
    const thread = request.codexThreadId
      ? codex.resumeThread(request.codexThreadId, threadOptions)
      : codex.startThread(threadOptions);
    const prompt = buildHeroGamePrompt({
      blockedGuessFeedback: request.blockedGuessFeedback,
      forceQuestion: request.forceQuestion ?? false,
      guesses: request.guesses ?? [],
      maxQuestions: request.maxQuestions,
      messages: request.history,
      questionsAsked: request.questionsAsked
    });

    let turn: { finalResponse: string };

    try {
      turn = await thread.run(prompt, {
        outputSchema: heroMoveOutputSchema
      });
    } catch (error) {
      throw new ServiceUnavailableException(`Codex request failed: ${toErrorMessage(error)}`);
    }

    return {
      codexThreadId: thread.id,
      move: parseHeroGameMove(turn.finalResponse)
    };
  }
}

export function parseHeroGameMove(value: string): HeroGameMove {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadGatewayException("Codex returned an invalid game move.");
  }

  if (!isRecord(parsed) || typeof parsed.move !== "string") {
    throw new BadGatewayException("Codex returned an invalid game move.");
  }

  if (parsed.move === "question") {
    if (typeof parsed.question !== "string" || parsed.question.trim().length === 0) {
      throw new BadGatewayException("Codex returned an invalid game move.");
    }

    return {
      move: "question",
      question: parsed.question.trim()
    };
  }

  if (parsed.move === "guess") {
    if (
      !isConfidence(parsed.confidence) ||
      typeof parsed.name !== "string" ||
      parsed.name.trim().length === 0 ||
      typeof parsed.rationale !== "string" ||
      parsed.rationale.trim().length === 0 ||
      typeof parsed.wikipediaSearchTitle !== "string" ||
      parsed.wikipediaSearchTitle.trim().length === 0
    ) {
      throw new BadGatewayException("Codex returned an invalid game move.");
    }

    return {
      confidence: parsed.confidence,
      move: "guess",
      name: parsed.name.trim(),
      rationale: parsed.rationale.trim(),
      wikipediaSearchTitle: parsed.wikipediaSearchTitle.trim()
    };
  }

  throw new BadGatewayException("Codex returned an invalid game move.");
}

function isConfidence(value: unknown): value is "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Codex request failed.";
}
