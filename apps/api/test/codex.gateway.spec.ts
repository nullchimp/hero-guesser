import { CodexGateway, heroMoveOutputSchema, parseHeroGameMove } from "../src/codex/codex.gateway.js";
import { AppConfigService } from "../src/config/app-config.service.js";

describe("CodexGateway game moves", () => {
  it("requests structured output on a new Codex thread", async () => {
    const thread = new FakeThread(JSON.stringify({
      move: "question",
      question: "Is your character from Marvel Comics?"
    }));
    const codex = new FakeCodex(thread);
    const gateway = new CodexGateway(fakeConfig(), () => codex);

    const result = await gateway.requestMove({
      codexThreadId: null,
      history: [],
      maxQuestions: 10,
      model: "gpt-5.4-mini",
      questionsAsked: 0
    });

    expect(codex.startedWith).toMatchObject({
      model: "gpt-5.4-mini",
      networkAccessEnabled: false,
      skipGitRepoCheck: true,
      workingDirectory: "/tmp/hero-guesser-codex"
    });
    expect(thread.runOptions).toEqual({
      outputSchema: heroMoveOutputSchema
    });
    expect(result).toEqual({
      codexThreadId: "thread-1",
      move: {
        move: "question",
        question: "Is your character from Marvel Comics?"
      }
    });
  });

  it("resumes the persisted Codex thread for later moves", async () => {
    const thread = new FakeThread(JSON.stringify({
      confidence: "medium",
      move: "guess",
      name: "Batman",
      rationale: "The answers fit a Gotham detective.",
      wikipediaSearchTitle: "Batman"
    }));
    const codex = new FakeCodex(thread);
    const gateway = new CodexGateway(fakeConfig(), () => codex);

    await gateway.requestMove({
      codexThreadId: "existing-thread",
      history: [],
      maxQuestions: 10,
      model: "gpt-5.3-codex",
      questionsAsked: 5
    });

    expect(codex.resumedWith).toMatchObject({
      id: "existing-thread",
      options: {
        model: "gpt-5.3-codex"
      }
    });
  });

  it("rejects malformed structured output", () => {
    expect(() => parseHeroGameMove("{\"move\":\"question\"}")).toThrow(
      "Codex returned an invalid game move."
    );
  });

  it("uses a conservative structured-output schema without conditional branches", () => {
    expect(JSON.stringify(heroMoveOutputSchema)).not.toContain("\"allOf\"");
    expect(JSON.stringify(heroMoveOutputSchema)).not.toContain("\"if\"");
    expect(heroMoveOutputSchema.required).toEqual([
      "confidence",
      "move",
      "name",
      "question",
      "rationale",
      "wikipediaSearchTitle"
    ]);
  });

  it("turns Codex SDK failures into service-unavailable responses", async () => {
    const gateway = new CodexGateway(fakeConfig(), () => new FakeCodex(new FailingThread()));

    await expect(gateway.requestMove({
      codexThreadId: null,
      history: [],
      maxQuestions: 10,
      model: "gpt-5.3-codex",
      questionsAsked: 0
    })).rejects.toThrow("Codex request failed: Structured output rejected.");
  });
});

class FakeCodex {
  resumedWith: unknown;
  startedWith: unknown;

  constructor(private readonly thread: FakeCodexThread) {}

  startThread(options: unknown): FakeCodexThread {
    this.startedWith = options;
    return this.thread;
  }

  resumeThread(id: string, options: unknown): FakeCodexThread {
    this.resumedWith = {
      id,
      options
    };
    return this.thread;
  }
}

interface FakeCodexThread {
  id: string;
  run(input: unknown, options: unknown): Promise<{ finalResponse: string }>;
}

class FakeThread {
  readonly id = "thread-1";
  runInput: unknown;
  runOptions: unknown;

  constructor(private readonly response: string) {}

  async run(input: unknown, options: unknown): Promise<{ finalResponse: string }> {
    this.runInput = input;
    this.runOptions = options;

    return {
      finalResponse: this.response
    };
  }
}

class FailingThread {
  readonly id = "thread-1";

  async run(): Promise<{ finalResponse: string }> {
    throw new Error("Structured output rejected.");
  }
}

function fakeConfig(): AppConfigService {
  return {
    codexWorkspace: "/tmp/hero-guesser-codex",
    openAiApiKey: "test-key"
  } as AppConfigService;
}
