import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import { mkdir } from "node:fs/promises";
import { AppConfigService } from "../config/app-config.service.js";
import { buildHeroGuessPrompt } from "./hero-guess.prompt.js";

export interface CodexStreamRequest {
  codexThreadId?: string | null;
  clue: string;
  model: string;
}

export type CodexStreamEvent =
  | { type: "thread"; threadId: string }
  | { type: "sdk-event"; sdkType: string; message?: string }
  | { type: "assistant-delta"; content: string }
  | { type: "assistant-final"; content: string };

interface CodexThread {
  id: string | null;
  run(input: string): Promise<{ finalResponse: string }>;
  runStreamed(input: string): Promise<{ events: AsyncIterable<ThreadEvent> }>;
}

@Injectable()
export class CodexGateway {
  constructor(private readonly config: AppConfigService) {}

  async *streamGuess(request: CodexStreamRequest): AsyncGenerator<CodexStreamEvent> {
    if (this.config.openAiApiKey.trim().length === 0) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured.");
    }

    await mkdir(this.config.codexWorkspace, { recursive: true });

    const codex = new Codex({
      apiKey: this.config.openAiApiKey
    });
    const threadOptions = {
      model: request.model,
      networkAccessEnabled: false,
      // The API container creates this isolated workspace only for Codex prompts.
      skipGitRepoCheck: true,
      workingDirectory: this.config.codexWorkspace
    };
    const thread = (request.codexThreadId
      ? codex.resumeThread(request.codexThreadId, threadOptions)
      : codex.startThread(threadOptions)) as CodexThread;

    const prompt = buildHeroGuessPrompt(request.clue);
    const streamedRun = await thread.runStreamed(prompt);
    let finalContent = "";
    let lastSdkErrorMessage: string | undefined;
    let reportedThreadId = request.codexThreadId ?? undefined;

    try {
      for await (const sdkEvent of streamedRun.events) {
        const sdkType = sdkEvent.type;
        const sdkErrorMessage = readSdkEventMessage(sdkEvent);

        if (sdkErrorMessage !== undefined) {
          lastSdkErrorMessage = sdkErrorMessage;
        }

        yield {
          message: sdkErrorMessage,
          type: "sdk-event",
          sdkType
        };

        if (sdkEvent.type === "thread.started") {
          reportedThreadId = sdkEvent.thread_id;

          yield {
            type: "thread",
            threadId: sdkEvent.thread_id
          };
        }

        if (sdkType === "turn.failed") {
          const failureMessage = readFailureMessage(sdkEvent, lastSdkErrorMessage);

          if (shouldRetryBuffered(failureMessage, finalContent)) {
            yield* this.runBufferedFallback(thread, prompt, reportedThreadId);
            return;
          }

          throw new ServiceUnavailableException(failureMessage);
        }

        const finalResponse = readAgentMessageText(sdkEvent);

        if (finalResponse !== undefined && finalResponse !== finalContent) {
          const delta = finalResponse.slice(finalContent.length);
          finalContent = finalResponse;

          if (delta.length > 0) {
            yield {
              type: "assistant-delta",
              content: delta
            };
          }
        }
      }
    } catch (error) {
      const failureMessage = toErrorMessage(error);

      if (shouldRetryBuffered(failureMessage, finalContent)) {
        yield* this.runBufferedFallback(thread, prompt, reportedThreadId);
        return;
      }

      throw error;
    }

    yield {
      type: "assistant-final",
      content: finalContent
    };
  }

  private async *runBufferedFallback(
    thread: CodexThread,
    prompt: string,
    reportedThreadId: string | undefined
  ): AsyncGenerator<CodexStreamEvent> {
    yield {
      message: "Streaming failed before any assistant text arrived; retrying with buffered Codex SDK run().",
      type: "sdk-event",
      sdkType: "fallback.started"
    };

    try {
      const turn = await thread.run(prompt);

      if (thread.id !== null && thread.id !== reportedThreadId) {
        yield {
          type: "thread",
          threadId: thread.id
        };
      }

      yield {
        content: turn.finalResponse,
        type: "assistant-delta"
      };

      yield {
        content: turn.finalResponse,
        type: "assistant-final"
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        `Streaming failed and buffered fallback failed: ${toErrorMessage(error)}`
      );
    }
  }
}

export function readAgentMessageText(value: unknown): string | undefined {
  const item = readRecord(value, "item");

  if (readString(item, "type") !== "agent_message") {
    return undefined;
  }

  return readString(item, "text");
}

export function readSdkEventMessage(value: unknown): string | undefined {
  return (
    readString(value, "message") ??
    readString(readRecord(value, "error"), "message") ??
    readString(readRecord(value, "item"), "message") ??
    readString(readRecord(readRecord(value, "item"), "error"), "message")
  );
}

function readFailureMessage(value: unknown, fallback: string | undefined): string {
  return readSdkEventMessage(value) ?? fallback ?? "Codex turn failed.";
}

export function shouldRetryBuffered(message: string, currentContent: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    currentContent.length === 0 &&
    (
      normalizedMessage.includes("stream disconnected before completion") ||
      normalizedMessage.includes("error sending request for url")
    )
  );
}

function readRecord(value: unknown, property: string): Record<string, unknown> | undefined {
  const record = toRecord(value);
  const child = record?.[property];
  return toRecord(child);
}

function readString(value: unknown, property: string): string | undefined {
  const record = toRecord(value);
  const child = record?.[property];
  return typeof child === "string" ? child : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Codex request failed.";
}
