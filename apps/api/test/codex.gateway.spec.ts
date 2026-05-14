import {
  readAgentMessageText,
  readSdkEventMessage,
  shouldRetryBuffered
} from "../src/codex/codex.gateway.js";

describe("CodexGateway event readers", () => {
  it("reads completed agent messages from SDK item events", () => {
    expect(
      readAgentMessageText({
        item: {
          text: "Guess: Batman",
          type: "agent_message"
        },
        type: "item.completed"
      })
    ).toBe("Guess: Batman");
  });

  it("reads nested turn failure messages", () => {
    expect(
      readSdkEventMessage({
        error: {
          message: "The selected model is not available."
        },
        type: "turn.failed"
      })
    ).toBe("The selected model is not available.");
  });

  it("reads direct stream error messages", () => {
    expect(
      readSdkEventMessage({
        message: "Invalid API key.",
        type: "error"
      })
    ).toBe("Invalid API key.");
  });

  it("uses buffered fallback only for empty stream disconnects", () => {
    expect(
      shouldRetryBuffered(
        "stream disconnected before completion: error sending request for url (https://api.openai.com/v1/responses)",
        ""
      )
    ).toBe(true);
    expect(
      shouldRetryBuffered(
        "stream disconnected before completion: error sending request for url (https://api.openai.com/v1/responses)",
        "Guess:"
      )
    ).toBe(false);
    expect(shouldRetryBuffered("Invalid API key.", "")).toBe(false);
  });
});
