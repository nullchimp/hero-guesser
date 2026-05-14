import { GuessRecord, MessageRecord } from "../conversations/conversation.types.js";

export interface HeroGamePromptInput {
  blockedGuessFeedback?: string;
  forceQuestion: boolean;
  guesses: GuessRecord[];
  maxQuestions: number;
  messages: MessageRecord[];
  questionsAsked: number;
}

export function buildHeroGamePrompt(input: HeroGamePromptInput): string {
  const history = input.messages.length === 0
    ? "No questions have been asked yet."
    : input.messages.map(formatMessage).join("\n");
  const rejectedGuesses = input.guesses
    .filter((guess) => guess.status === "wrong")
    .map((guess) => guess.name)
    .join(", ");

  return [
    "You are Hero Guesser.",
    "The user is silently thinking of one superhero or villain.",
    "Your job is to identify that character by asking yes/no/unknown questions and making specific guesses.",
    "",
    "Rules:",
    `- You may ask at most ${input.maxQuestions} questions total.`,
    `- You have already asked ${input.questionsAsked} question(s).`,
    "- The user can only answer yes, no, or unknown.",
    "- If you ask a question, it must be answerable with yes, no, or unknown.",
    "- If you make a guess, use the exact hero/villain name and a Wikipedia title likely to identify the specific comics character.",
    "- The JSON schema always includes all fields. For a question move, set confidence to \"none\" and set name, rationale, and wikipediaSearchTitle to empty strings.",
    "- For a guess move, set question to an empty string.",
    "- Do not repeat rejected guesses.",
    "- Prefer a question when more information would materially reduce ambiguity.",
    "- Prefer a guess when you are confident.",
    input.forceQuestion ? "- This is the opening move: ask a question, do not guess yet." : "",
    input.questionsAsked >= input.maxQuestions ? "- The question budget is exhausted: submit a guess now." : "",
    rejectedGuesses.length > 0 ? `Rejected guesses: ${rejectedGuesses}` : "",
    input.blockedGuessFeedback ?? "",
    "",
    "Conversation history:",
    history,
    "",
    "Return only the structured JSON object requested by the schema."
  ].filter(Boolean).join("\n");
}

function formatMessage(message: MessageRecord): string {
  if (message.kind === "answer") {
    return `User answered: ${message.content}`;
  }

  if (message.kind === "question") {
    return `You asked: ${message.content}`;
  }

  if (message.kind === "guess" && message.guess !== null) {
    return `You guessed: ${message.guess.name} (${message.guess.status})`;
  }

  return `${message.role}: ${message.content}`;
}
