import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import type {
  AuthSession,
  GameSession,
  GuessRecord,
  LeaderboardEntry,
  SessionSummary
} from "./services/api";

const api = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }

  return {
    ApiError,
    clearSavedAuth: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    fetchMe: vi.fn(),
    fetchLeaderboard: vi.fn(),
    fetchModels: vi.fn(),
    fetchSession: vi.fn(),
    fetchSessions: vi.fn(),
    getSavedAuth: vi.fn(),
    judgeGuess: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    saveAuth: vi.fn(),
    submitAnswer: vi.fn()
  };
});

vi.mock("./services/api", () => api);

const scrollIntoView = vi.fn();

describe("App", () => {
  beforeEach(() => {
    api.clearSavedAuth.mockReset();
    api.createSession.mockReset();
    api.deleteSession.mockReset();
    api.fetchMe.mockReset();
    api.fetchLeaderboard.mockReset();
    api.fetchModels.mockReset();
    api.fetchSession.mockReset();
    api.fetchSessions.mockReset();
    api.judgeGuess.mockReset();
    api.login.mockReset();
    api.register.mockReset();
    api.saveAuth.mockReset();
    api.submitAnswer.mockReset();
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;

    api.getSavedAuth.mockReturnValue(authSession());
    api.fetchMe.mockResolvedValue({
      user: authSession().user
    });
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
    api.deleteSession.mockResolvedValue(undefined);
  });

  it("shows the login/register screen when no auth is saved and does not load game data", () => {
    api.getSavedAuth.mockReturnValue(null);

    render(App);

    expect(screen.getByLabelText("Heroname")).not.toBeNull();
    expect(screen.getByLabelText("Password")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Log In" })).not.toBeNull();
    expect(api.fetchMe).not.toHaveBeenCalled();
    expect(api.fetchModels).not.toHaveBeenCalled();
    expect(api.fetchSessions).not.toHaveBeenCalled();
  });

  it("registers a new heroname, saves auth, and loads the game", async () => {
    const freshAuth = authSession({
      token: "fresh-token",
      user: {
        heroname: "ShadowFox",
        id: "user-1"
      }
    });
    api.getSavedAuth.mockReturnValue(null);
    api.register.mockResolvedValue(freshAuth);
    api.fetchSessions.mockResolvedValue({
      sessions: []
    });

    render(App);

    await fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await fireEvent.update(screen.getByLabelText("Heroname"), "ShadowFox");
    await fireEvent.update(screen.getByLabelText("Password"), "secret123");
    await fireEvent.update(screen.getByLabelText("Confirm Password"), "secret123");
    await fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(api.register).toHaveBeenCalledWith("ShadowFox", "secret123");
    });
    expect(api.saveAuth).toHaveBeenCalledWith(freshAuth);
    expect(api.fetchModels).toHaveBeenCalledWith("fresh-token");
    expect(await screen.findByText("Think of a hero or villain, choose a model, and start a game.")).not.toBeNull();
  });

  it("clears stale saved auth and returns to login", async () => {
    api.fetchMe.mockRejectedValue(new api.ApiError("Invalid or expired authentication token.", 401));

    render(App);

    expect(await screen.findByRole("button", { name: "Log In" })).not.toBeNull();
    expect(api.clearSavedAuth).toHaveBeenCalled();
    expect(screen.getByText("Your session expired. Log in again.")).not.toBeNull();
  });

  it("logs out and hides gameplay", async () => {
    api.fetchSessions.mockResolvedValue({
      sessions: []
    });

    render(App);

    expect(await screen.findByText("Think of a hero or villain, choose a model, and start a game.")).not.toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(api.clearSavedAuth).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Log In" })).not.toBeNull();
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
    expect(api.createSession).toHaveBeenCalledWith("token-1", "gpt-5.4-mini");
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
        "token-1",
        "session-1",
        "guess-1",
        "correct"
      );
    });
    expect(await screen.findByText("The model won this round.")).not.toBeNull();
  });

  it("deletes the active session from a compact trash action and selects the next saved session", async () => {
    api.fetchSessions
      .mockResolvedValueOnce({
        sessions: [
          summary({
            lastMessage: "Is your character from DC Comics?",
            sessionId: "session-1"
          }),
          summary({
            lastMessage: "Can your character fly?",
            model: "gpt-5.4-mini",
            sessionId: "session-2"
          })
        ]
      })
      .mockResolvedValueOnce({
        sessions: [
          summary({
            lastMessage: "Can your character fly?",
            model: "gpt-5.4-mini",
            sessionId: "session-2"
          })
        ]
      });
    api.fetchSession
      .mockResolvedValueOnce(session({
        messages: [
          message({
            content: "Is your character from DC Comics?",
            kind: "question",
            role: "assistant"
          })
        ],
        sessionId: "session-1"
      }))
      .mockResolvedValueOnce(session({
        messages: [
          message({
            content: "Can your character fly?",
            kind: "question",
            role: "assistant"
          })
        ],
        model: "gpt-5.4-mini",
        sessionId: "session-2"
      }));

    render(App);

    expect(await screen.findByText("Is your character from DC Comics?")).not.toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Delete session session-1" }));

    await waitFor(() => {
      expect(api.deleteSession).toHaveBeenCalledWith("token-1", "session-1");
    });
    expect(screen.queryByRole("button", { name: "Confirm delete session session-1" })).toBeNull();
    expect(await screen.findByText("Can your character fly?")).not.toBeNull();
    expect(api.fetchSession).toHaveBeenLastCalledWith("token-1", "session-2");
  });

  it("clears the play area when the only saved session is deleted", async () => {
    api.fetchSessions
      .mockResolvedValueOnce({
        sessions: [
          summary({
            lastMessage: "Is your character from DC Comics?",
            sessionId: "session-1"
          })
        ]
      })
      .mockResolvedValueOnce({
        sessions: []
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

    render(App);

    expect(await screen.findByText("Is your character from DC Comics?")).not.toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Delete session session-1" }));

    expect(await screen.findByText("Think of a hero or villain, choose a model, and start a game.")).not.toBeNull();
  });

  it("attaches player answers to the question instead of rendering separate answer bubbles", async () => {
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
          id: "message-1",
          kind: "question",
          role: "assistant"
        }),
        message({
          content: "yes",
          id: "message-2",
          kind: "answer",
          role: "user"
        }),
        message({
          content: "Can your character fly?",
          id: "message-3",
          kind: "question",
          role: "assistant"
        })
      ],
      sessionId: "session-1"
    }));

    render(App);

    expect(await screen.findByText("Is your character from DC Comics?")).not.toBeNull();
    expect(screen.getByLabelText("You answered yes")).not.toBeNull();
    expect(screen.queryByText("You")).toBeNull();
  });

  it("anchors the guess card to the top of the panel after the image loads", async () => {
    const offsetTopSpy = vi.spyOn(HTMLElement.prototype, "offsetTop", "get");
    offsetTopSpy.mockReturnValue(640);
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
          guess: guessRecord({
            name: "Batman"
          }),
          kind: "guess",
          role: "assistant"
        })
      ],
      sessionId: "session-1"
    }));

    render(App);

    const image = await screen.findByAltText("Batman");
    await fireEvent.load(image);

    await waitFor(() => {
      expect(image.closest(".messages")?.scrollTop).toBe(628);
    });
    offsetTopSpy.mockRestore();
  });

  it("locks the model picker while a session is active and unlocks it once the game ends", async () => {
    api.fetchSessions
      .mockResolvedValueOnce({
        sessions: [
          summary({
            model: "gpt-5.4-mini",
            sessionId: "session-1",
            status: "active"
          })
        ]
      })
      .mockResolvedValue({
        sessions: [
          summary({
            model: "gpt-5.4-mini",
            sessionId: "session-1",
            status: "won"
          })
        ]
      });
    const guess = guessRecord({ name: "Batman" });
    api.fetchSession.mockResolvedValue(session({
      messages: [
        message({
          content: "The answers point to Batman.",
          guess,
          kind: "guess",
          role: "assistant"
        })
      ],
      model: "gpt-5.4-mini",
      sessionId: "session-1"
    }));
    api.judgeGuess.mockResolvedValue(session({
      messages: [
        message({
          content: "The answers point to Batman.",
          guess: { ...guess, status: "correct" },
          kind: "guess",
          role: "assistant"
        })
      ],
      model: "gpt-5.4-mini",
      sessionId: "session-1",
      status: "won"
    }));

    render(App);

    const picker = await screen.findByLabelText<HTMLSelectElement>(/Model in play|Model for new games/);
    await waitFor(() => {
      expect(picker.disabled).toBe(true);
    });
    expect(screen.getByText("Model in play")).not.toBeNull();
    expect(picker.value).toBe("gpt-5.4-mini");

    await fireEvent.click(screen.getByRole("button", { name: "Correct" }));

    await waitFor(() => {
      expect(picker.disabled).toBe(false);
    });
    expect(screen.getByText("Model for new games")).not.toBeNull();
  });

  it("keeps active session updates from scrolling the full page", async () => {
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

    render(App);

    expect(await screen.findByText("Is your character from DC Comics?")).not.toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

function authSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    token: "token-1",
    user: {
      heroname: "ShadowFox",
      id: "user-1"
    },
    ...overrides
  };
}

function session(overrides: Partial<GameSession> = {}): GameSession {
  return {
    completedAt: null,
    createdAt: "2026-05-15T12:00:00.000Z",
    guesses: [],
    maxQuestions: 20,
    messages: [],
    model: "gpt-5.3-codex",
    ownerId: "user-1",
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
    maxQuestions: 20,
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
