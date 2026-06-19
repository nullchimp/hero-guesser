import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service.js";
import { COPILOT_RUNTIME, type CopilotRuntimePort } from "./copilot.runtime.js";

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

export type TurnKind = "opening" | "answer" | "blocked-guess" | "budget-exhausted";

export interface CopilotMoveRequest {
  blockedGuessFeedback?: string;
  copilotSessionId: string | null;
  forceQuestion?: boolean;
  lastAnswer?: string;
  maxQuestions: number;
  model: string;
  questionsAsked: number;
}

export interface CopilotMoveResult {
  copilotSessionId: string;
  move: HeroGameMove;
}

@Injectable()
export class CopilotGateway {
  constructor(
    private readonly config: AppConfigService,
    @Inject(COPILOT_RUNTIME)
    private readonly runtime: CopilotRuntimePort
  ) {}

  async requestMove(request: CopilotMoveRequest): Promise<CopilotMoveResult> {
    if (this.config.copilotToken.trim().length === 0) {
      throw new ServiceUnavailableException("COPILOT_GITHUB_TOKEN is not configured.");
    }

    const prompt = buildTurnPrompt({
      blockedGuessFeedback: request.blockedGuessFeedback,
      forceQuestion: request.forceQuestion ?? false,
      isOpeningTurn: request.copilotSessionId === null,
      lastAnswer: request.lastAnswer,
      maxQuestions: request.maxQuestions,
      questionsAsked: request.questionsAsked
    });

    let result;

    try {
      result = await this.runtime.sendGameMove({
        copilotSessionId: request.copilotSessionId,
        model: request.model,
        prompt
      });
    } catch (error) {
      throw new ServiceUnavailableException(`Copilot request failed: ${toErrorMessage(error)}`);
    }

    return {
      copilotSessionId: result.copilotSessionId,
      move: parseHeroGameMove(result.content)
    };
  }
}

export interface TurnPromptInput {
  blockedGuessFeedback?: string;
  forceQuestion: boolean;
  isOpeningTurn: boolean;
  lastAnswer?: string;
  maxQuestions: number;
  questionsAsked: number;
}

export function buildTurnPrompt(input: TurnPromptInput): string {
  const lines: string[] = [];

  if (input.isOpeningTurn) {
    lines.push(
      "New game.",
      `You may ask at most ${input.maxQuestions} yes/no/unknown questions before you must guess.`,
      "Ask your opening question now. Respond with the question-move JSON only."
    );
    return lines.join("\n");
  }

  lines.push(
    `Question budget: ${input.questionsAsked} of ${input.maxQuestions} used.`
  );

  if (input.lastAnswer !== undefined) {
    lines.push(`User answered: ${input.lastAnswer}.`);
  }

  if (input.blockedGuessFeedback !== undefined && input.blockedGuessFeedback.length > 0) {
    lines.push(input.blockedGuessFeedback);
  }

  if (input.questionsAsked >= input.maxQuestions) {
    lines.push("The question budget is exhausted: submit a guess now.");
  } else if (input.forceQuestion) {
    lines.push("This turn must be a yes/no/unknown question, not a guess.");
  }

  lines.push("Respond with a single JSON object matching the schema. No prose, no markdown.");

  return lines.join("\n");
}

export function parseHeroGameMove(value: string): HeroGameMove {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadGatewayException("Copilot returned an invalid game move.");
  }

  if (!isRecord(parsed) || typeof parsed.move !== "string") {
    throw new BadGatewayException("Copilot returned an invalid game move.");
  }

  if (parsed.move === "question") {
    if (typeof parsed.question !== "string" || parsed.question.trim().length === 0) {
      throw new BadGatewayException("Copilot returned an invalid game move.");
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
      throw new BadGatewayException("Copilot returned an invalid game move.");
    }

    return {
      confidence: parsed.confidence,
      move: "guess",
      name: parsed.name.trim(),
      rationale: parsed.rationale.trim(),
      wikipediaSearchTitle: parsed.wikipediaSearchTitle.trim()
    };
  }

  throw new BadGatewayException("Copilot returned an invalid game move.");
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

  return "Copilot request failed.";
}
