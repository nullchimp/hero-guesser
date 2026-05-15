const OWNER_STORAGE_KEY = "hero-guesser-owner-id";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ModelsResponse {
  defaultModel: string;
  models: ModelOption[];
}

export type GameStatus = "active" | "won" | "lost";
export type MessageRole = "user" | "assistant";
export type MessageStatus = "complete" | "streaming" | "failed";
export type MessageKind = "chat" | "answer" | "question" | "guess";
export type PlayerAnswer = "yes" | "no" | "unknown";
export type GuessVerdict = "correct" | "wrong";

export interface GuessRecord {
  articleExtract: string;
  articleTitle: string;
  articleUrl: string;
  confidence: string;
  createdAt: string;
  id: string;
  imageHeight: number | null;
  imageUrl: string;
  imageWidth: number | null;
  name: string;
  rationale: string;
  status: "pending" | "correct" | "wrong";
}

export interface ConversationMessage {
  content: string;
  createdAt: string;
  errorMessage: string | null;
  guess: GuessRecord | null;
  id: string;
  kind: MessageKind;
  model: string | null;
  role: MessageRole;
  status: MessageStatus;
}

export interface GameSession {
  completedAt: string | null;
  createdAt: string;
  guesses: GuessRecord[];
  maxQuestions: number;
  messages: ConversationMessage[];
  model: string;
  ownerId: string;
  questionsAsked: number;
  sessionId: string;
  status: GameStatus;
  updatedAt: string;
}

export interface SessionSummary {
  completedAt: string | null;
  createdAt: string;
  lastMessage: string | null;
  maxQuestions: number;
  model: string;
  pendingGuessName: string | null;
  questionsAsked: number;
  sessionId: string;
  status: GameStatus;
  updatedAt: string;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface LeaderboardEntry {
  averageQuestionsToWin: number | null;
  games: number;
  losses: number;
  model: string;
  rank: number;
  winRate: number;
  wins: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export function getOwnerId(): string {
  const savedOwnerId = window.localStorage.getItem(OWNER_STORAGE_KEY);

  if (savedOwnerId !== null && savedOwnerId.trim().length > 0) {
    return savedOwnerId;
  }

  const ownerId = createOwnerId();
  window.localStorage.setItem(OWNER_STORAGE_KEY, ownerId);
  return ownerId;
}

export async function fetchModels(ownerId: string): Promise<ModelsResponse> {
  const response = await fetch("/api/models", {
    headers: ownerHeaders(ownerId)
  });
  return readJson<ModelsResponse>(response);
}

export async function fetchSessions(ownerId: string): Promise<SessionsResponse> {
  const response = await fetch("/api/sessions", {
    headers: ownerHeaders(ownerId)
  });
  return readJson<SessionsResponse>(response);
}

export async function createSession(ownerId: string, model: string): Promise<GameSession> {
  const response = await fetch("/api/sessions", {
    body: JSON.stringify({
      model
    }),
    headers: jsonHeaders(ownerId),
    method: "POST"
  });
  return readJson<GameSession>(response);
}

export async function fetchSession(ownerId: string, sessionId: string): Promise<GameSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    headers: ownerHeaders(ownerId)
  });
  return readJson<GameSession>(response);
}

export async function deleteSession(ownerId: string, sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    headers: ownerHeaders(ownerId),
    method: "DELETE"
  });
  await readEmpty(response);
}

export async function submitAnswer(
  ownerId: string,
  sessionId: string,
  answer: PlayerAnswer
): Promise<GameSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/answers`, {
    body: JSON.stringify({
      answer
    }),
    headers: jsonHeaders(ownerId),
    method: "POST"
  });
  return readJson<GameSession>(response);
}

export async function judgeGuess(
  ownerId: string,
  sessionId: string,
  guessId: string,
  verdict: GuessVerdict
): Promise<GameSession> {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/guesses/${encodeURIComponent(guessId)}/judgment`,
    {
      body: JSON.stringify({
        verdict
      }),
      headers: jsonHeaders(ownerId),
      method: "POST"
    }
  );
  return readJson<GameSession>(response);
}

export async function fetchLeaderboard(ownerId: string): Promise<LeaderboardResponse> {
  const response = await fetch("/api/leaderboard", {
    headers: ownerHeaders(ownerId)
  });
  return readJson<LeaderboardResponse>(response);
}

function ownerHeaders(ownerId: string): Record<string, string> {
  return {
    "X-Hero-Owner-Id": ownerId
  };
}

function jsonHeaders(ownerId: string): Record<string, string> {
  return {
    ...ownerHeaders(ownerId),
    "Content-Type": "application/json"
  };
}

function createOwnerId(): string {
  if ("randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function readEmpty(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}.`);
  }
}
