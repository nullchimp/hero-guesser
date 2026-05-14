export type ConversationRole = "user" | "assistant";
export type ConversationStatus = "complete" | "streaming" | "failed";

export interface ConversationRecord {
  codexThreadId: string | null;
  id: string;
  model: string;
  sessionId: string;
}

export interface MessageRecord {
  content: string;
  createdAt: Date;
  errorMessage: string | null;
  id: string;
  model: string | null;
  role: ConversationRole;
  status: ConversationStatus;
}

export interface ConversationResponse {
  messages: MessageRecord[];
  model: string;
  sessionId: string;
}

export interface StreamUserMessageEvent {
  message: MessageRecord;
  type: "user-message";
}

export interface StreamAssistantStartEvent {
  message: MessageRecord;
  type: "assistant-message-start";
}

export interface StreamAssistantDeltaEvent {
  content: string;
  type: "assistant-delta";
}

export interface StreamCodexEvent {
  message?: string;
  sdkType: string;
  type: "codex-event";
}

export interface StreamAssistantCompleteEvent {
  message: MessageRecord;
  type: "assistant-message-complete";
}

export interface StreamErrorEvent {
  error: string;
  message: MessageRecord;
  type: "error";
}

export type ConversationStreamEvent =
  | StreamUserMessageEvent
  | StreamAssistantStartEvent
  | StreamAssistantDeltaEvent
  | StreamCodexEvent
  | StreamAssistantCompleteEvent
  | StreamErrorEvent;
