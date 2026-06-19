import {
  CopilotGateway,
  CopilotMoveRequest,
  buildTurnPrompt,
  parseHeroGameMove
} from "../src/copilot/copilot.gateway.js";
import type { CopilotRuntimePort } from "../src/copilot/copilot.runtime.js";
import { AppConfigService } from "../src/config/app-config.service.js";

describe("CopilotGateway game moves", () => {
  it("creates a new SDK session on the opening move and returns the parsed question", async () => {
    const runtime = new FakeCopilotRuntime({
      newSessionId: "copilot-session-abc",
      responses: [JSON.stringify({
        move: "question",
        question: "Is your character from Marvel Comics?"
      })]
    });
    const gateway = new CopilotGateway(fakeConfig(), runtime);

    const result = await gateway.requestMove(openingRequest({
      maxQuestions: 10,
      model: "gpt-5.4-mini"
    }));

    expect(runtime.sendCalls).toHaveLength(1);
    expect(runtime.sendCalls[0]).toMatchObject({
      copilotSessionId: null,
      model: "gpt-5.4-mini"
    });
    expect(runtime.sendCalls[0].prompt).toContain("opening question");
    expect(result).toEqual({
      copilotSessionId: "copilot-session-abc",
      move: {
        move: "question",
        question: "Is your character from Marvel Comics?"
      }
    });
  });

  it("resumes the persisted SDK session on subsequent turns and forwards the last user answer", async () => {
    const runtime = new FakeCopilotRuntime({
      newSessionId: "should-not-be-used",
      responses: [JSON.stringify({
        confidence: "medium",
        move: "guess",
        name: "Batman",
        rationale: "The answers fit a Gotham detective.",
        wikipediaSearchTitle: "Batman"
      })]
    });
    const gateway = new CopilotGateway(fakeConfig(), runtime);

    const result = await gateway.requestMove({
      copilotSessionId: "existing-session",
      lastAnswer: "yes",
      maxQuestions: 10,
      model: "gpt-5.3-codex",
      questionsAsked: 5
    });

    expect(runtime.sendCalls).toHaveLength(1);
    expect(runtime.sendCalls[0].copilotSessionId).toBe("existing-session");
    expect(runtime.sendCalls[0].prompt).toContain("User answered: yes");
    expect(result).toEqual({
      copilotSessionId: "existing-session",
      move: {
        confidence: "medium",
        move: "guess",
        name: "Batman",
        rationale: "The answers fit a Gotham detective.",
        wikipediaSearchTitle: "Batman"
      }
    });
  });

  it("throws ServiceUnavailableException when token is empty — before any runtime call", async () => {
    const runtime = new FakeCopilotRuntime({ newSessionId: "unused", responses: ["{}"] });
    const gateway = new CopilotGateway(
      { copilotToken: "" } as AppConfigService,
      runtime
    );

    await expect(gateway.requestMove(openingRequest())).rejects.toThrow(
      "COPILOT_GITHUB_TOKEN is not configured."
    );

    expect(runtime.sendCalls).toEqual([]);
  });

  it("turns runtime failures into service-unavailable responses", async () => {
    const runtime = new FailingCopilotRuntime();
    const gateway = new CopilotGateway(fakeConfig(), runtime);

    await expect(gateway.requestMove(openingRequest())).rejects.toThrow(
      "Copilot request failed: Structured output rejected."
    );
  });

  it("rejects malformed structured output", () => {
    expect(() => parseHeroGameMove("{\"move\":\"question\"}")).toThrow(
      "Copilot returned an invalid game move."
    );
  });

  it("rejects non-JSON output", () => {
    expect(() => parseHeroGameMove("Sure, here is the JSON: {\"move\":\"question\",\"question\":\"test\"}")).toThrow(
      "Copilot returned an invalid game move."
    );
  });

  it("builds the opening prompt without referencing prior answers", () => {
    const prompt = buildTurnPrompt({
      forceQuestion: true,
      isOpeningTurn: true,
      maxQuestions: 10,
      questionsAsked: 0
    });

    expect(prompt).toContain("New game.");
    expect(prompt).toContain("opening question");
    expect(prompt).not.toContain("User answered");
  });

  it("builds a budget-exhausted prompt that demands a guess", () => {
    const prompt = buildTurnPrompt({
      forceQuestion: false,
      isOpeningTurn: false,
      lastAnswer: "no",
      maxQuestions: 5,
      questionsAsked: 5
    });

    expect(prompt).toContain("question budget is exhausted");
    expect(prompt).toContain("User answered: no");
  });

  it("threads blocked-guess feedback into the follow-up prompt", () => {
    const prompt = buildTurnPrompt({
      blockedGuessFeedback: "The guess \"Foo\" could not be matched.",
      forceQuestion: false,
      isOpeningTurn: false,
      maxQuestions: 10,
      questionsAsked: 4
    });

    expect(prompt).toContain("could not be matched");
  });
});

function openingRequest(overrides: Partial<CopilotMoveRequest> = {}): CopilotMoveRequest {
  return {
    copilotSessionId: null,
    forceQuestion: true,
    maxQuestions: 10,
    model: "gpt-5.4",
    questionsAsked: 0,
    ...overrides
  };
}

function fakeConfig(): AppConfigService {
  return {
    copilotToken: "test-token"
  } as AppConfigService;
}

class FakeCopilotRuntime implements CopilotRuntimePort {
  readonly sendCalls: Array<{ copilotSessionId: string | null; model: string; prompt: string }> = [];

  constructor(private readonly options: { newSessionId: string; responses: string[] }) {}

  async sendGameMove(input: {
    copilotSessionId: string | null;
    model: string;
    prompt: string;
  }): Promise<{ content: string; copilotSessionId: string }> {
    this.sendCalls.push({
      copilotSessionId: input.copilotSessionId,
      model: input.model,
      prompt: input.prompt
    });
    const response = this.options.responses.shift();

    if (response === undefined) {
      throw new Error("FakeCopilotRuntime ran out of canned responses.");
    }

    return {
      content: response,
      copilotSessionId: input.copilotSessionId ?? this.options.newSessionId
    };
  }
}

class FailingCopilotRuntime implements CopilotRuntimePort {
  async sendGameMove(): Promise<{ content: string; copilotSessionId: string }> {
    throw new Error("Structured output rejected.");
  }
}
