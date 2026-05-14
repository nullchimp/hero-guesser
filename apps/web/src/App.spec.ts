import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import type {
  GameSession,
  GuessRecord,
  LeaderboardEntry,
  SessionSummary
} from "./services/api";

const api = vi.hoisted(() => ({
  createSession: vi.fn(),
  fetchLeaderboard: vi.fn(),
  fetchModels: vi.fn(),
  fetchSession: vi.fn(),
  fetchSessions: vi.fn(),
  getOwnerId: vi.fn(),
  judgeGuess: vi.fn(),
  submitAnswer: vi.fn()
}));

vi.mock("./services/api", () => api);

describe("App", () => {
  beforeEach(() => {
    api.createSession.mockReset();
    api.fetchLeaderboard.mockReset();
    api.fetchModels.mockReset();
    api.fetchSession.mockReset();
    api.fetchSessions.mockReset();
    api.getOwnerId.mockReturnValue("browser-owner-1");
    api.judgeGuess.mockReset();
    api.submitAnswer.mockReset();
    Element.prototype.scrollIntoView = vi.fn();

    api.fetchModels.mockResolvedValue({
      defaultModel: "gpt-5.3-codex",
      models: [
        { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
        { id: "gpt-5.4-mini", label: "gpt-5.4-mini" }
      ]
    });
    api.fetchLeaderboard.mockResolvedValue({
      leaderboard: []
    });
  });

  it("loads server-backed sessions and the global model leaderboard", async () => {
    api.fetchSessions.mockResolvedValue({
      sessions: [
        summary({
          lastMessage: "Is your character from DC Comics?",
          sessionId: "session-1"
        })
      ]
    });
    api.fetchSession.mockResolvedValue(session({
      messages: [
        message({
          content: "Is your character from DC Comics?",
          kind: "question",
          role: "assistant"
        })
      ],
      sessionId: "session-1"
    }));
    api.fetchLeaderboard.mockResolvedValue({
      leaderboard: [
        leaderboardEntry({
          model: "gpt-5.4-mini",
          rank: 1,
          winRate: 1
        })
      ]
    });

    render(App);

    expect(await screen.findByText("Is your character from DC Comics?")).not.toBeNull();
    expect(screen.getAllByText("gpt-5.4-mini").length).toBeGreaterThan(0);
    expect(screen.getByText("100%")).not.toBeNull();
  });

  it("starts a new game with the selected model and renders answer buttons only", async () => {
    api.fetchModels.mockResolvedValue({
      defaultModel: "gpt-5.4-mini",
      models: [
        { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
        { id: "gpt-5.4-mini", label: "gpt-5.4-mini" }
      ]
    });
    api.fetchSessions.mockResolvedValue({
      sessions: []
    });
    api.createSession.mockResolvedValue(session({
      messages: [
        message({
          content: "Is your character human?",
          kind: "question",
          role: "assistant"
        })
      ],
      model: "gpt-5.4-mini",
      questionsAsked: 1,
      sessionId: "session-2"
    }));

    render(App);

    const newGameButton = screen.getByRole<HTMLButtonElement>("button", { name: "New Game" });
    await waitFor(() => {
      expect(newGameButton.disabled).toBe(false);
    });
    await fireEvent.click(newGameButton);

    expect(await screen.findByText("Is your character human?")).not.toBeNull();
    expect(await screen.findByRole("button", { name: "Yes" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "No" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Unknown" })).not.toBeNull();
    expect(api.createSession).toHaveBeenCalledWith("browser-owner-1", "gpt-5.4-mini");
  });

  it("submits a judgment from a Wikipedia-backed guess card", async () => {
    const guess = guessRecord({
      name: "Batman"
    });
    api.fetchSessions.mockResolvedValue({
      sessions: [
        summary({
          pendingGuessName: "Batman",
          sessionId: "session-1"
        })
      ]
    });
    api.fetchSession.mockResolvedValue(session({
      messages: [
        message({
          content: "The answers point to Batman.",
          guess,
          kind: "guess",
          role: "assistant"
        })
      ],
      sessionId: "session-1"
    }));
    api.judgeGuess.mockResolvedValue(session({
      messages: [
        message({
          content: "The answers point to Batman.",
          guess: {
            ...guess,
            status: "correct"
          },
          kind: "guess",
          role: "assistant"
        })
      ],
      sessionId: "session-1",
      status: "won"
    }));

    render(App);

    expect(await screen.findByText("Batman on Wikipedia")).not.toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Correct" }));

    await waitFor(() => {
      expect(api.judgeGuess).toHaveBeenCalledWith(
        "browser-owner-1",
        "session-1",
        "guess-1",
        "correct"
      );
    });
    expect(await screen.findByText("The model won this round.")).not.toBeNull();
  });
});

function session(overrides: Partial<GameSession> = {}): GameSession {
  return {
    completedAt: null,
    createdAt: "2026-05-15T12:00:00.000Z",
    guesses: [],
    maxQuestions: 10,
    messages: [],
    model: "gpt-5.3-codex",
    ownerId: "browser-owner-1",
    questionsAsked: 0,
    sessionId: "session-1",
    status: "active",
    updatedAt: "2026-05-15T12:00:00.000Z",
    ...overrides
  };
}

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    completedAt: null,
    createdAt: "2026-05-15T12:00:00.000Z",
    lastMessage: null,
    maxQuestions: 10,
    model: "gpt-5.3-codex",
    pendingGuessName: null,
    questionsAsked: 0,
    sessionId: "session-1",
    status: "active",
    updatedAt: "2026-05-15T12:00:00.000Z",
    ...overrides
  };
}

function message(overrides: Partial<GameSession["messages"][number]> = {}): GameSession["messages"][number] {
  return {
    content: "",
    createdAt: "2026-05-15T12:00:00.000Z",
    errorMessage: null,
    guess: null,
    id: "message-1",
    kind: "question",
    model: "gpt-5.3-codex",
    role: "assistant",
    status: "complete",
    ...overrides
  };
}

function guessRecord(overrides: Partial<GuessRecord> = {}): GuessRecord {
  return {
    articleExtract: "Batman is a superhero who appears in American comic books.",
    articleTitle: "Batman",
    articleUrl: "https://en.wikipedia.org/wiki/Batman",
    confidence: "high",
    createdAt: "2026-05-15T12:00:00.000Z",
    id: "guess-1",
    imageHeight: 406,
    imageUrl: "https://upload.wikimedia.org/Batman.jpg",
    imageWidth: 245,
    name: "Batman",
    rationale: "The answers point to Batman.",
    status: "pending",
    ...overrides
  };
}

function leaderboardEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    averageQuestionsToWin: 5,
    games: 1,
    losses: 0,
    model: "gpt-5.3-codex",
    rank: 1,
    winRate: 1,
    wins: 1,
    ...overrides
  };
}
