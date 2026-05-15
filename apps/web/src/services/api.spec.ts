import {
  AuthSession,
  clearSavedAuth,
  createSession,
  fetchMe,
  getSavedAuth,
  saveAuth
} from "./api";

describe("api service", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and clears the saved auth session", () => {
    const session = authSession();

    saveAuth(session);

    expect(getSavedAuth()).toEqual(session);

    clearSavedAuth();

    expect(getSavedAuth()).toBeNull();
  });

  it("sends bearer tokens to authenticated game endpoints", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({
      completedAt: null,
      createdAt: "2026-05-15T12:00:00.000Z",
      guesses: [],
      maxQuestions: 20,
      messages: [],
      model: "gpt-5.4-mini",
      ownerId: "user-1",
      questionsAsked: 0,
      sessionId: "session-1",
      status: "active",
      updatedAt: "2026-05-15T12:00:00.000Z"
    }));

    await createSession("token-1", "gpt-5.4-mini");

    expect(fetchMock).toHaveBeenCalledWith("/api/sessions", {
      body: JSON.stringify({
        model: "gpt-5.4-mini"
      }),
      headers: {
        Authorization: "Bearer token-1",
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  });

  it("sends bearer tokens to the current-user endpoint", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({
      user: {
        heroname: "ShadowFox",
        id: "user-1"
      }
    }));

    await fetchMe("token-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      headers: {
        Authorization: "Bearer token-1"
      }
    });
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: 200
  });
}
