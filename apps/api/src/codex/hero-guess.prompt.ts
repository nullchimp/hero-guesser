export function buildHeroGuessPrompt(clue: string): string {
  return [
    "You are Hero Guesser.",
    "Treat the user's message as clues for a superhero or villain name.",
    "Respond with a concise best guess, brief reasoning, and confidence.",
    "Use this exact shape:",
    "Guess: <hero or villain name>",
    "Why: <one or two short sentences>",
    "Confidence: <Low, Medium, or High>",
    "",
    `User clues: ${clue}`
  ].join("\n");
}
