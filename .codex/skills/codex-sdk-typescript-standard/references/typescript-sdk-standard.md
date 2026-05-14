# TypeScript SDK Standard Reference

Checked against the official OpenAI Codex TypeScript SDK source on 2026-05-14:

- SDK directory: https://github.com/openai/codex/tree/main/sdk/typescript
- README: https://github.com/openai/codex/blob/main/sdk/typescript/README.md
- Package metadata: https://raw.githubusercontent.com/openai/codex/main/sdk/typescript/package.json
- Public exports: https://raw.githubusercontent.com/openai/codex/main/sdk/typescript/src/index.ts
- Thread implementation: https://raw.githubusercontent.com/openai/codex/main/sdk/typescript/src/thread.ts

## Core Model

- Package name: `@openai/codex-sdk`.
- Runtime: Node.js 18+.
- Module style: ESM.
- The SDK wraps the `codex` CLI from `@openai/codex`, spawning it and exchanging JSONL events over stdin/stdout.
- Main public class: `Codex`.
- Conversation object: `Thread`.

## Public API Shape

Use these public exports as the standard surface:

- `new Codex(options?)`
- `codex.startThread(options?)`
- `codex.resumeThread(id, options?)`
- `thread.run(input, turnOptions?)`
- `thread.runStreamed(input, turnOptions?)`
- `thread.id`

Avoid relying on non-exported files or CLI internals unless the user is modifying the SDK itself.

## Inputs And Results

`run()` returns a completed turn:

- `items`
- `finalResponse`
- `usage`

`runStreamed()` returns an async generator of structured events. Use event `type` checks such as `item.completed`, `turn.completed`, and `turn.failed`.

Valid user input is either:

- a string prompt
- an array of `{ type: "text", text }` and `{ type: "local_image", path }` entries

The SDK concatenates text entries and passes local image paths separately to the CLI.

## Options

`CodexOptions` can include:

- `codexPathOverride`
- `baseUrl`
- `apiKey`
- `config`
- `env`

`ThreadOptions` can include:

- `model`
- `sandboxMode`
- `workingDirectory`
- `skipGitRepoCheck`
- `modelReasoningEffort`
- `networkAccessEnabled`
- `webSearchMode`
- `webSearchEnabled`
- `approvalPolicy`
- `additionalDirectories`

`TurnOptions` can include:

- `outputSchema`
- `signal`

## Patterns

Use `run()` for buffered final responses:

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread({ workingDirectory: "/path/to/project" });
const turn = await thread.run("Diagnose the test failure and propose a fix");

console.log(turn.finalResponse);
```

Use `runStreamed()` for progress:

```ts
const { events } = await thread.runStreamed("Implement the fix");

for await (const event of events) {
  if (event.type === "item.completed") {
    console.log(event.item);
  }
}
```

Use `AbortSignal` for cancellation:

```ts
const controller = new AbortController();
const turn = await thread.run("Analyze this repo", { signal: controller.signal });
```

Use JSON Schema for structured output:

```ts
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
} as const;

const turn = await thread.run("Summarize repository status", { outputSchema: schema });
```
