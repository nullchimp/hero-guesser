import { CopilotGateway, HeroGameMove } from "../src/copilot/copilot.gateway.js";
import { ModelCatalog } from "../src/config/model-catalog.service.js";
import { ConversationRepository } from "../src/conversations/conversation.repository.js";
import { ConversationService } from "../src/conversations/conversation.service.js";
import {
  ConversationRecord,
  ConversationStatus,
  GameStatus,
  GuessRecord,
  GuessStatus,
  MessageKind,
  MessageRecord,
  WikipediaArticleRecord
} from "../src/conversations/conversation.types.js";
import { WikipediaService } from "../src/wikipedia/wikipedia.service.js";

describe("ConversationService game sessions", () => {
  it("starts a model-locked session and lets the AI ask the opening question", async () => {
    const repository = new FakeConversationRepository();
    const service = createService({
      copilotMoves: [
        {
          move: "question",
          question: "Is your character from DC Comics?"
        }
      ],
      repository
    });

    const session = await service.startSession({
      model: "gpt-5.4-mini",
      ownerId: "browser-owner-1"
    });

    expect(session).toMatchObject({
      maxQuestions: 20,
      model: "gpt-5.4-mini",
      ownerId: "browser-owner-1",
      questionsAsked: 1,
      status: "active"
    });
    expect(session.messages).toMatchObject([
      {
        content: "Is your character from DC Comics?",
        kind: "question",
        role: "assistant"
      }
    ]);
    expect(repository.conversations[0].model).toBe("gpt-5.4-mini");
  });

  it("records a wrong guess and continues asking while question tries remain", async () => {
    const repository = new FakeConversationRepository();
    const service = createService({
      copilotMoves: [
        {
          move: "question",
          question: "Is your character usually heroic?"
        },
        {
          confidence: "high",
          move: "guess",
          name: "Batman",
          rationale: "The answers point to a human DC hero.",
          wikipediaSearchTitle: "Batman"
        },
        {
          move: "question",
          question: "Does your character have superhuman powers?"
        }
      ],
      repository
    });

    const started = await service.startSession({
      model: "gpt-5.3-codex",
      ownerId: "browser-owner-1"
    });
    const withGuess = await service.submitAnswer({
      answer: "yes",
      ownerId: "browser-owner-1",
      sessionId: started.sessionId
    });
    const guess = withGuess.messages.find((message) => message.kind === "guess")?.guess;

    expect(guess).toMatchObject({
      articleTitle: "Batman",
      name: "Batman",
      status: "pending"
    });

    const afterWrong = await service.judgeGuess({
      guessId: guess?.id ?? "missing",
      ownerId: "browser-owner-1",
      sessionId: started.sessionId,
      verdict: "wrong"
    });

    expect(afterWrong.status).toBe("active");
    expect(afterWrong.questionsAsked).toBe(2);
    expect(afterWrong.messages.at(-1)).toMatchObject({
      content: "Does your character have superhuman powers?",
      kind: "question"
    });
    expect(afterWrong.guesses[0]).toMatchObject({
      name: "Batman",
      status: "wrong"
    });
  });

  it("marks the session lost when a twentieth-question guess is judged wrong", async () => {
    const repository = new FakeConversationRepository();
    const conversation = repository.seedConversation({
      ownerId: "browser-owner-1",
      questionsAsked: 20
    });
    const message = await repository.createMessage({
      content: "The pattern points to Batman.",
      conversationId: conversation.id,
      kind: "guess",
      model: conversation.model,
      role: "assistant",
      status: "complete"
    });
    const guess = await repository.createGuess({
      article: fakeArticle("Batman"),
      confidence: "high",
      conversationId: conversation.id,
      messageId: message.id,
      name: "Batman",
      rationale: "The pattern points to Batman."
    });
    const copilot = new FakeCopilotGateway([]);
    const service = createService({
      copilotGateway: copilot,
      repository
    });

    const session = await service.judgeGuess({
      guessId: guess.id,
      ownerId: "browser-owner-1",
      sessionId: conversation.sessionId,
      verdict: "wrong"
    });

    expect(session.status).toBe("lost");
    expect(session.completedAt).not.toBeNull();
    expect(copilot.calls).toHaveLength(0);
  });

  it("deletes an owned session from future session lists", async () => {
    const repository = new FakeConversationRepository();
    const conversation = repository.seedConversation({
      ownerId: "browser-owner-1"
    });
    const service = createService({
      repository
    });

    await service.deleteSession({
      ownerId: "browser-owner-1",
      sessionId: conversation.sessionId
    });

    await expect(service.listSessions({
      ownerId: "browser-owner-1"
    })).resolves.toEqual({
      sessions: []
    });
    await expect(service.getSession({
      ownerId: "browser-owner-1",
      sessionId: conversation.sessionId
    })).rejects.toThrow("Session not found.");
  });

  it("does not delete a session owned by another player", async () => {
    const repository = new FakeConversationRepository();
    const conversation = repository.seedConversation({
      ownerId: "owner-a"
    });
    const service = createService({
      repository
    });

    await expect(service.deleteSession({
      ownerId: "owner-b",
      sessionId: conversation.sessionId
    })).rejects.toThrow("Session not found.");

    await expect(service.getSession({
      ownerId: "owner-a",
      sessionId: conversation.sessionId
    })).resolves.toMatchObject({
      sessionId: conversation.sessionId
    });
  });

  it("rolls back the persisted answer message when advancing the AI fails", async () => {
    const repository = new FakeConversationRepository();
    const error = new Error("Copilot exploded.");
    const service = createService({
      copilotGateway: new FakeCopilotGateway([
        {
          move: "question",
          question: "Is your character from Marvel Comics?"
        },
        error
      ]),
      repository
    });

    const started = await service.startSession({
      ownerId: "browser-owner-1"
    });

    await expect(service.submitAnswer({
      answer: "yes",
      ownerId: "browser-owner-1",
      sessionId: started.sessionId
    })).rejects.toThrow("Copilot exploded.");

    expect(repository.deletedMessageIds).toEqual(["message-2"]);
    expect(repository.messages).toHaveLength(1);
    expect(repository.messages[0]).toMatchObject({
      content: "Is your character from Marvel Comics?",
      kind: "question"
    });
  });

  it("restores a wrong guess to pending when advancing the AI fails", async () => {
    const repository = new FakeConversationRepository();
    const error = new Error("Copilot exploded.");
    const service = createService({
      copilotGateway: new FakeCopilotGateway([
        {
          move: "question",
          question: "Is your character usually heroic?"
        },
        {
          confidence: "high",
          move: "guess",
          name: "Batman",
          rationale: "The answers point to a human DC hero.",
          wikipediaSearchTitle: "Batman"
        },
        error
      ]),
      repository
    });

    const started = await service.startSession({
      ownerId: "browser-owner-1"
    });
    const withGuess = await service.submitAnswer({
      answer: "yes",
      ownerId: "browser-owner-1",
      sessionId: started.sessionId
    });
    const guess = withGuess.guesses[0];

    await expect(service.judgeGuess({
      guessId: guess.id,
      ownerId: "browser-owner-1",
      sessionId: started.sessionId,
      verdict: "wrong"
    })).rejects.toThrow("Copilot exploded.");

    expect(repository.guesses[0].status).toBe("pending");
    expect(repository.guessStatusUpdates).toEqual([
      {
        guessId: guess.id,
        status: "wrong"
      },
      {
        guessId: guess.id,
        status: "pending"
      }
    ]);
  });

  it("ranks the global model leaderboard by win rate and average winning tries", async () => {
    const repository = new FakeConversationRepository();
    repository.seedConversation({
      model: "gpt-5.4",
      ownerId: "owner-a",
      questionsAsked: 5,
      status: "won"
    });
    repository.seedConversation({
      model: "gpt-5.4",
      ownerId: "owner-b",
      questionsAsked: 8,
      status: "lost"
    });
    repository.seedConversation({
      model: "gpt-5.4-mini",
      ownerId: "owner-c",
      questionsAsked: 3,
      status: "won"
    });
    repository.seedConversation({
      model: "gpt-5.4-mini",
      ownerId: "owner-d",
      questionsAsked: 7,
      status: "won"
    });
    const service = createService({
      repository
    });

    await expect(service.getLeaderboard()).resolves.toEqual([
      {
        averageQuestionsToWin: 5,
        games: 2,
        losses: 0,
        model: "gpt-5.4-mini",
        rank: 1,
        winRate: 1,
        wins: 2
      },
      {
        averageQuestionsToWin: 5,
        games: 2,
        losses: 1,
        model: "gpt-5.4",
        rank: 2,
        winRate: 0.5,
        wins: 1
      }
    ]);
  });
});

function createService(options: {
  copilotGateway?: FakeCopilotGateway;
  copilotMoves?: HeroGameMove[];
  repository?: FakeConversationRepository;
  wikipedia?: FakeWikipediaService;
} = {}): ConversationService {
  return new ConversationService(
    (options.repository ?? new FakeConversationRepository()) as unknown as ConversationRepository,
    (options.copilotGateway ?? new FakeCopilotGateway(options.copilotMoves ?? [])) as unknown as CopilotGateway,
    new FakeModelCatalog() as unknown as ModelCatalog,
    (options.wikipedia ?? new FakeWikipediaService()) as unknown as WikipediaService
  );
}

class FakeConversationRepository {
  readonly conversations: ConversationRecord[] = [];
  readonly deletedMessageIds: string[] = [];
  readonly guessStatusUpdates: Array<{ guessId: string; status: GuessStatus }> = [];
  readonly guesses: GuessRecord[] = [];
  readonly messages: MessageRecord[] = [];

  async createSession(input: {
    model: string;
    ownerId: string;
    sessionId: string;
  }): Promise<ConversationRecord> {
    const conversation = this.seedConversation(input);
    return conversation;
  }

  seedConversation(input: {
    copilotSessionId?: string | null;
    model?: string;
    ownerId: string;
    questionsAsked?: number;
    sessionId?: string;
    status?: GameStatus;
  }): ConversationRecord {
    const now = new Date("2026-05-15T12:00:00.000Z");
    const conversation: ConversationRecord = {
      completedAt: input.status === "won" || input.status === "lost" ? now : null,
      copilotSessionId: input.copilotSessionId ?? null,
      createdAt: now,
      id: `conversation-${this.conversations.length + 1}`,
      model: input.model ?? "gpt-5.3-codex",
      ownerId: input.ownerId,
      questionsAsked: input.questionsAsked ?? 0,
      sessionId: input.sessionId ?? `session-${this.conversations.length + 1}`,
      status: input.status ?? "active",
      updatedAt: now
    };

    this.conversations.push(conversation);
    return conversation;
  }

  async listSessionSummaries(ownerId: string): Promise<ConversationRecord[]> {
    return this.conversations.filter((conversation) => conversation.ownerId === ownerId);
  }

  async getSession(ownerId: string, sessionId: string): Promise<ConversationRecord | null> {
    return (
      this.conversations.find(
        (conversation) => conversation.ownerId === ownerId && conversation.sessionId === sessionId
      ) ?? null
    );
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    return this.messages.filter((message) => message.conversationId === conversationId);
  }

  async listGuesses(conversationId: string): Promise<GuessRecord[]> {
    return this.guesses.filter((guess) => guess.conversationId === conversationId);
  }

  async createMessage(input: {
    content: string;
    conversationId: string;
    kind: MessageKind;
    model?: string;
    role: "user" | "assistant";
    status: ConversationStatus;
  }): Promise<MessageRecord> {
    const message: MessageRecord = {
      content: input.content,
      conversationId: input.conversationId,
      createdAt: new Date("2026-05-15T12:00:00.000Z"),
      errorMessage: null,
      guess: null,
      id: `message-${this.messages.length + 1}`,
      kind: input.kind,
      model: input.model ?? null,
      role: input.role,
      status: input.status
    };

    this.messages.push(message);
    return message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const index = this.messages.findIndex((message) => message.id === messageId);

    if (index < 0) {
      throw new Error(`Missing message ${messageId}.`);
    }

    this.deletedMessageIds.push(messageId);
    this.messages.splice(index, 1);
  }

  async incrementQuestions(conversationId: string): Promise<ConversationRecord> {
    const conversation = this.readConversation(conversationId);
    conversation.questionsAsked += 1;
    return conversation;
  }

  async setCopilotSessionId(
    conversationId: string,
    copilotSessionId: string
  ): Promise<ConversationRecord> {
    const conversation = this.readConversation(conversationId);
    conversation.copilotSessionId = copilotSessionId;
    return conversation;
  }

  async createGuess(input: {
    article: WikipediaArticleRecord;
    confidence: string;
    conversationId: string;
    messageId: string;
    name: string;
    rationale: string;
  }): Promise<GuessRecord> {
    const guess: GuessRecord = {
      articleExtract: input.article.extract,
      articleTitle: input.article.title,
      articleUrl: input.article.url,
      confidence: input.confidence,
      conversationId: input.conversationId,
      createdAt: new Date("2026-05-15T12:00:00.000Z"),
      id: `guess-${this.guesses.length + 1}`,
      imageHeight: input.article.imageHeight,
      imageUrl: input.article.imageUrl,
      imageWidth: input.article.imageWidth,
      messageId: input.messageId,
      name: input.name,
      rationale: input.rationale,
      status: "pending"
    };

    this.guesses.push(guess);
    const message = this.messages.find((candidate) => candidate.id === input.messageId);

    if (message !== undefined) {
      message.guess = guess;
    }

    return guess;
  }

  async updateGuessStatus(guessId: string, status: GuessStatus): Promise<GuessRecord> {
    const guess = this.guesses.find((candidate) => candidate.id === guessId);

    if (guess === undefined) {
      throw new Error(`Missing guess ${guessId}.`);
    }

    this.guessStatusUpdates.push({
      guessId,
      status
    });
    guess.status = status;
    return guess;
  }

  async completeSession(conversationId: string, status: Exclude<GameStatus, "active">): Promise<ConversationRecord> {
    const conversation = this.readConversation(conversationId);
    conversation.status = status;
    conversation.completedAt = new Date("2026-05-15T12:00:00.000Z");
    return conversation;
  }

  async listCompletedSessions(): Promise<ConversationRecord[]> {
    return this.conversations.filter((conversation) => conversation.status !== "active");
  }

  async deleteSession(conversationId: string): Promise<void> {
    const index = this.conversations.findIndex((candidate) => candidate.id === conversationId);

    if (index < 0) {
      throw new Error(`Missing conversation ${conversationId}.`);
    }

    this.conversations.splice(index, 1);

    for (let messageIndex = this.messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
      if (this.messages[messageIndex].conversationId === conversationId) {
        this.messages.splice(messageIndex, 1);
      }
    }

    for (let guessIndex = this.guesses.length - 1; guessIndex >= 0; guessIndex -= 1) {
      if (this.guesses[guessIndex].conversationId === conversationId) {
        this.guesses.splice(guessIndex, 1);
      }
    }
  }

  private readConversation(conversationId: string): ConversationRecord {
    const conversation = this.conversations.find((candidate) => candidate.id === conversationId);

    if (conversation === undefined) {
      throw new Error(`Missing conversation ${conversationId}.`);
    }

    return conversation;
  }
}

class FakeCopilotGateway {
  readonly calls: Array<{ copilotSessionId: string | null; lastAnswer?: string; forceQuestion?: boolean; blockedGuessFeedback?: string }> = [];
  private nextSessionIndex = 0;

  constructor(private readonly moves: Array<HeroGameMove | Error>) {}

  async requestMove(input: {
    blockedGuessFeedback?: string;
    copilotSessionId: string | null;
    forceQuestion?: boolean;
    lastAnswer?: string;
  }): Promise<{ copilotSessionId: string; move: HeroGameMove }> {
    this.calls.push({
      blockedGuessFeedback: input.blockedGuessFeedback,
      copilotSessionId: input.copilotSessionId,
      forceQuestion: input.forceQuestion,
      lastAnswer: input.lastAnswer
    });
    const move = this.moves.shift();

    if (move === undefined) {
      throw new Error("No fake Copilot move queued.");
    }

    if (move instanceof Error) {
      throw move;
    }

    const copilotSessionId = input.copilotSessionId ?? `copilot-session-${++this.nextSessionIndex}`;

    return {
      copilotSessionId,
      move
    };
  }
}

class FakeWikipediaService {
  async enrichGuess(name: string): Promise<WikipediaArticleRecord | null> {
    return fakeArticle(name);
  }
}

class FakeModelCatalog {
  resolve(model: string | undefined): string {
    return model ?? "gpt-5.3-codex";
  }
}

function fakeArticle(title: string): WikipediaArticleRecord {
  return {
    extract: `${title} is a superhero who appears in comic books.`,
    imageHeight: 406,
    imageUrl: `https://upload.wikimedia.org/${title}.jpg`,
    imageWidth: 245,
    title,
    url: `https://en.wikipedia.org/wiki/${title}`
  };
}
