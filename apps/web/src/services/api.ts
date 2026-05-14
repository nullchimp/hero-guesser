const SESSION_STORAGE_KEY = "hero-guesser-session-id";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ModelsResponse {
  defaultModel: string;
  models: ModelOption[];
}

export type MessageRole = "user" | "assistant";
export type MessageStatus = "complete" | "streaming" | "failed";

export interface ConversationMessage {
  content: string;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  model: string | null;
  role: MessageRole;
  status: MessageStatus;
}

export interface ConversationResponse {
  messages: ConversationMessage[];
  model: string;
  sessionId: string;
}

export type StreamEvent =
  | { message: ConversationMessage; type: "user-message" }
  | { message: ConversationMessage; type: "assistant-message-start" }
  | { content: string; type: "assistant-delta" }
  | { message?: string; sdkType: string; type: "codex-event" }
  | { message: ConversationMessage; type: "assistant-message-complete" }
  | { error: string; message?: ConversationMessage; type: "error" };

export function getSessionId(): string {
  const savedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (savedSessionId !== null && savedSessionId.trim().length > 0) {
    return savedSessionId;
  }

  const sessionId = createSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export async function fetchModels(sessionId: string): Promise<ModelsResponse> {
  const response = await fetch("/api/models", {
    headers: sessionHeaders(sessionId)
  });
  return readJson<ModelsResponse>(response);
}

export async function fetchConversation(sessionId: string): Promise<ConversationResponse> {
  const response = await fetch("/api/conversation", {
    headers: sessionHeaders(sessionId)
  });
  return readJson<ConversationResponse>(response);
}

export async function sendMessageStream(
  sessionId: string,
  content: string,
  model: string,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const response = await fetch("/api/conversation/messages", {
    body: JSON.stringify({
      content,
      model
    }),
    headers: {
      ...sessionHeaders(sessionId),
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  if (response.body === null) {
    throw new Error("The browser did not provide a response stream.");
  }

  await readSseStream(response.body, onEvent);
}

function sessionHeaders(sessionId: string): Record<string, string> {
  return {
    "X-Hero-Session-Id": sessionId
  };
}

function createSessionId(): string {
  if ("randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      emitSseEvent(eventText, onEvent);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim().length > 0) {
    emitSseEvent(buffer, onEvent);
  }
}

function emitSseEvent(eventText: string, onEvent: (event: StreamEvent) => void): void {
  const parsed = parseSseEvent(eventText);

  if (parsed !== undefined) {
    onEvent(parsed);
  }
}

function parseSseEvent(eventText: string): StreamEvent | undefined {
  const lines = eventText.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n");

  if (event === undefined || data.length === 0) {
    return undefined;
  }

  const parsed = JSON.parse(data) as Record<string, unknown>;
  return {
    ...parsed,
    type: event as StreamEvent["type"]
  } as StreamEvent;
}
