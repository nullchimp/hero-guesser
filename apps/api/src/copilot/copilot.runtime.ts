import {
  CopilotClient,
  type PermissionHandler,
  type PermissionRequestResult,
  type SystemMessageConfig
} from "@github/copilot-sdk";
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit
} from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service.js";

/**
 * Narrow seam over the GitHub Copilot SDK. Tests inject a fake; production
 * binds {@link CopilotRuntime}.
 */
export interface CopilotRuntimePort {
  sendGameMove(input: SendGameMoveInput): Promise<SendGameMoveResult>;
}

export interface SendGameMoveInput {
  copilotSessionId: string | null;
  model: string;
  prompt: string;
}

export interface SendGameMoveResult {
  content: string;
  copilotSessionId: string;
}

export const COPILOT_RUNTIME = Symbol("COPILOT_RUNTIME");

const SEND_TIMEOUT_MS = 120_000;

export const HERO_SYSTEM_MESSAGE: string = [
  "You are Hero Guesser. The user is silently thinking of one superhero or villain and you must identify it.",
  "",
  "Each turn you choose exactly one move and respond with a single JSON object only.",
  "Do not include any prose, explanation, markdown, or code fences — only the raw JSON object.",
  "",
  "Allowed JSON schemas:",
  "",
  "1) Question move:",
  '   {"move":"question","question":"<a yes/no/unknown question>"}',
  "",
  "2) Guess move:",
  '   {"move":"guess","name":"<exact hero or villain name>","confidence":"low"|"medium"|"high","rationale":"<one short sentence>","wikipediaSearchTitle":"<English Wikipedia title likely to identify this specific comics character>"}',
  "",
  "Rules:",
  "- The user can answer only yes, no, or unknown.",
  "- Questions must be answerable with yes, no, or unknown.",
  "- Never repeat a previously rejected guess.",
  "- Prefer a question when more information would materially reduce ambiguity; prefer a guess when you are confident.",
  "- When the host tells you the question budget is exhausted, submit a guess.",
  "- When the host tells you the opening move must be a question, return a question.",
  "- When the host rejects a guess (e.g. unknown Wikipedia article), choose a different specific guess or a clarifying question if questions remain."
].join("\n");

const denyAll: PermissionHandler = (): PermissionRequestResult => ({
  kind: "reject",
  feedback: "Tool calls are disabled for hero-guesser sessions."
});

@Injectable()
export class CopilotRuntime implements CopilotRuntimePort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopilotRuntime.name);
  private client: CopilotClient | null = null;

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    const token = this.config.copilotToken.trim();

    if (token.length === 0) {
      this.logger.warn(
        "COPILOT_GITHUB_TOKEN is not configured; CopilotRuntime will not start. Game requests will fail until it is set."
      );
      return;
    }

    const client = new CopilotClient({
      gitHubToken: token,
      logLevel: "warning",
      baseDirectory: this.config.copilotHome
    });

    try {
      await client.start();
    } catch (error) {
      this.logger.error(`Failed to start Copilot CLI runtime: ${toMessage(error)}`);
      throw error;
    }

    this.client = client;
    this.logger.log("Copilot SDK runtime started.");
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;

    if (client === null) {
      return;
    }

    try {
      const errors = await client.stop();
      for (const error of errors) {
        this.logger.warn(`Copilot runtime shutdown error: ${toMessage(error)}`);
      }
    } catch (error) {
      this.logger.warn(`Copilot runtime stop() failed (${toMessage(error)}); forcing shutdown.`);
      try {
        await client.forceStop();
      } catch (forceError) {
        this.logger.error(`Copilot runtime forceStop() also failed: ${toMessage(forceError)}`);
      }
    }
  }

  async sendGameMove(input: SendGameMoveInput): Promise<SendGameMoveResult> {
    const client = this.requireClient();
    const session =
      input.copilotSessionId === null
        ? await client.createSession({
            model: input.model,
            onPermissionRequest: denyAll,
            systemMessage: heroSystemMessage()
          })
        : await client.resumeSession(input.copilotSessionId, {
            model: input.model,
            onPermissionRequest: denyAll,
            systemMessage: heroSystemMessage()
          });

    try {
      const response = await session.sendAndWait({ prompt: input.prompt }, SEND_TIMEOUT_MS);

      if (response === undefined) {
        throw new Error("Copilot session produced no assistant message.");
      }

      return {
        content: response.data.content,
        copilotSessionId: session.sessionId
      };
    } finally {
      await session.disconnect().catch((error: unknown) => {
        this.logger.debug(`sendGameMove disconnect failed: ${toMessage(error)}`);
      });
    }
  }

  private requireClient(): CopilotClient {
    if (this.client === null) {
      throw new Error("Copilot SDK runtime is not started (is COPILOT_GITHUB_TOKEN set?).");
    }

    return this.client;
  }
}

function heroSystemMessage(): SystemMessageConfig {
  return { mode: "replace", content: HERO_SYSTEM_MESSAGE };
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
