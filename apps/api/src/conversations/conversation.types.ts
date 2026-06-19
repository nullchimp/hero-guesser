export type ConversationRole = "user" | "assistant";
export type ConversationStatus = "complete" | "streaming" | "failed";
export type MessageKind = "chat" | "answer" | "question" | "guess";
export type GameStatus = "active" | "won" | "lost";
export type GuessStatus = "pending" | "correct" | "wrong";
export type PlayerAnswer = "yes" | "no" | "unknown";
export type GuessVerdict = "correct" | "wrong";

export interface ConversationRecord {
  completedAt: Date | null;
  copilotSessionId: string | null;
  createdAt: Date;
  id: string;
  model: string;
  ownerId: string | null;
  questionsAsked: number;
  sessionId: string;
  status: GameStatus;
  updatedAt: Date;
}

export interface MessageRecord {
  content: string;
  conversationId: string;
  createdAt: Date;
  errorMessage: string | null;
  guess: GuessRecord | null;
  id: string;
  kind: MessageKind;
  model: string | null;
  role: ConversationRole;
  status: ConversationStatus;
}

export interface WikipediaArticleRecord {
  extract: string;
  imageHeight: number | null;
  imageUrl: string;
  imageWidth: number | null;
  title: string;
  url: string;
}

export interface GuessRecord {
  articleExtract: string;
  articleTitle: string;
  articleUrl: string;
  confidence: string;
  conversationId: string;
  createdAt: Date;
  id: string;
  imageHeight: number | null;
  imageUrl: string;
  imageWidth: number | null;
  messageId: string;
  name: string;
  rationale: string;
  status: GuessStatus;
}

export interface GameSessionResponse {
  completedAt: string | null;
  createdAt: string;
  guesses: SerializedGuessRecord[];
  maxQuestions: number;
  messages: SerializedMessageRecord[];
  model: string;
  ownerId: string;
  questionsAsked: number;
  sessionId: string;
  status: GameStatus;
  updatedAt: string;
}

export interface SessionSummaryResponse {
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
  sessions: SessionSummaryResponse[];
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

export interface SerializedGuessRecord {
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
  status: GuessStatus;
}

export interface SerializedMessageRecord {
  content: string;
  createdAt: string;
  errorMessage: string | null;
  guess: SerializedGuessRecord | null;
  id: string;
  kind: MessageKind;
  model: string | null;
  role: ConversationRole;
  status: ConversationStatus;
}
