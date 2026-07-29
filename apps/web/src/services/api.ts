const AUTH_STORAGE_KEY = "hero-guesser-auth";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface AuthUser {
  heroname: string;
  id: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface AuthUserResponse {
  user: AuthUser;
}

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

export function getSavedAuth(): AuthSession | null {
  const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (savedAuth === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(savedAuth) as Partial<AuthSession>;

    if (
      typeof parsed.token === "string" &&
      typeof parsed.user?.id === "string" &&
      typeof parsed.user.heroname === "string"
    ) {
      return {
        token: parsed.token,
        user: {
          heroname: parsed.user.heroname,
          id: parsed.user.id
        }
      };
    }
  } catch {
    // Invalid local storage data is treated as logged out.
  }

  clearSavedAuth();
  return null;
}

export function saveAuth(auth: AuthSession): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearSavedAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function register(heroname: string, password: string): Promise<AuthSession> {
  const response = await fetch("/api/auth/register", {
    body: JSON.stringify({
      heroname,
      password
    }),
    headers: unauthenticatedJsonHeaders(),
    method: "POST"
  });
  return readJson<AuthSession>(response);
}

export async function login(heroname: string, password: string): Promise<AuthSession> {
  const response = await fetch("/api/auth/login", {
    body: JSON.stringify({
      heroname,
      password
    }),
    headers: unauthenticatedJsonHeaders(),
    method: "POST"
  });
  return readJson<AuthSession>(response);
}

export async function exchangeCanvasCode(code: string): Promise<AuthSession> {
  const response = await fetch("/api/auth/canvas/exchange", {
    body: JSON.stringify({
      code
    }),
    headers: unauthenticatedJsonHeaders(),
    method: "POST"
  });
  return readJson<AuthSession>(response);
}

export async function fetchMe(token: string): Promise<AuthUserResponse> {
  const response = await fetch("/api/auth/me", {
    headers: authHeaders(token)
  });
  return readJson<AuthUserResponse>(response);
}

export async function fetchModels(token: string): Promise<ModelsResponse> {
  const response = await fetch("/api/models", {
    headers: authHeaders(token)
  });
  return readJson<ModelsResponse>(response);
}

export async function fetchSessions(token: string): Promise<SessionsResponse> {
  const response = await fetch("/api/sessions", {
    headers: authHeaders(token)
  });
  return readJson<SessionsResponse>(response);
}

export async function createSession(token: string, model: string): Promise<GameSession> {
  const response = await fetch("/api/sessions", {
    body: JSON.stringify({
      model
    }),
    headers: jsonHeaders(token),
    method: "POST"
  });
  return readJson<GameSession>(response);
}

export async function fetchSession(token: string, sessionId: string): Promise<GameSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(token)
  });
  return readJson<GameSession>(response);
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    headers: authHeaders(token),
    method: "DELETE"
  });
  await readEmpty(response);
}

export async function submitAnswer(
  token: string,
  sessionId: string,
  answer: PlayerAnswer
): Promise<GameSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/answers`, {
    body: JSON.stringify({
      answer
    }),
    headers: jsonHeaders(token),
    method: "POST"
  });
  return readJson<GameSession>(response);
}

export async function judgeGuess(
  token: string,
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
      headers: jsonHeaders(token),
      method: "POST"
    }
  );
  return readJson<GameSession>(response);
}

export async function fetchLeaderboard(token: string): Promise<LeaderboardResponse> {
  const response = await fetch("/api/leaderboard", {
    headers: authHeaders(token)
  });
  return readJson<LeaderboardResponse>(response);
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`
  };
}

function jsonHeaders(token: string): Record<string, string> {
  return {
    ...authHeaders(token),
    "Content-Type": "application/json"
  };
}

function unauthenticatedJsonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json"
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function readEmpty(response: Response): Promise<void> {
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.text();

  if (!body) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(body) as { message?: unknown };

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (Array.isArray(parsed.message) && parsed.message.every((entry) => typeof entry === "string")) {
      return parsed.message.join(" ");
    }
  } catch {
    return body;
  }

  return body;
}
