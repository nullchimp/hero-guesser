---
name: codex-sdk-typescript-standard
description: Standards for implementing, reviewing, or debugging TypeScript code that uses the OpenAI Codex SDK. Use whenever Codex works with @openai/codex-sdk, the Codex TypeScript SDK, Codex Thread APIs, run or runStreamed flows, structured output schemas, image inputs, thread resumption, sandbox or working-directory options, Codex CLI environment/config overrides, or SDK tests and samples.
---

# Codex SDK TypeScript Standard

## Goal

Use the official TypeScript SDK shape as the default standard for Codex SDK work, and re-check the upstream SDK when API details matter.

## Source Of Truth

Before adding or changing SDK usage, inspect the installed package and the official upstream SDK when available:

- Installed package: `node_modules/@openai/codex-sdk`, if present.
- Upstream source: `https://github.com/openai/codex/tree/main/sdk/typescript`.
- Local reference: read `references/typescript-sdk-standard.md` for the current project summary and source links.

Treat the upstream SDK and installed package as authoritative over examples, memory, or issue comments.

## Standard Workflow

1. Confirm the task is actually SDK work: integrating `@openai/codex-sdk`, reviewing SDK calls, building samples, or modifying SDK-related tests.
2. Check the local package version and exported types if the dependency is installed.
3. Re-read the upstream README or source when the behavior is not already obvious from local code.
4. Use `Codex`, `startThread()`, `resumeThread()`, `run()`, and `runStreamed()` as the main public API surface.
5. Prefer typed SDK options over shelling out to `codex` directly unless the SDK lacks the required capability.
6. Add tests or executable examples for host-app behavior, especially streaming, cancellation, working-directory handling, and structured output.

## Implementation Standards

- Import from `@openai/codex-sdk`; do not deep-import SDK internals.
- Require Node.js 18+ in code, docs, and package metadata when adding SDK usage.
- Use one `Thread` for a continuing conversation; use `resumeThread(id)` for persisted conversations.
- Use `run()` when the app only needs the final turn result.
- Use `runStreamed()` when the app needs progress events, tool-call visibility, file-change notifications, or usage data as events arrive.
- Use structured input arrays for image prompts: text entries plus `{ type: "local_image", path }` entries.
- Use `outputSchema` for machine-readable responses; prefer JSON Schema generated from Zod with `target: "openAi"` when Zod is already in the stack.
- Use `AbortSignal` through turn options for cancellation instead of inventing an unsupported cancellation API.
- Pass `workingDirectory` explicitly for host apps; avoid `skipGitRepoCheck` except for controlled tests, examples, or temporary directories.
- Treat `env` as a full replacement for inherited environment variables; include required runtime variables deliberately.
- Use the SDK `config` object for Codex CLI overrides so values are flattened and serialized correctly.

## Review Standards

Flag these issues during review:

- Direct CLI process management where the SDK API would be clearer.
- Long-running `run()` calls in UI or server flows that need streaming, progress, or cancellation.
- Missing handling for `turn.failed` or stream errors.
- Hard-coded working directories, inherited secrets, or accidental broad environment exposure.
- Use of `skipGitRepoCheck` outside a narrow, justified context.
- Assumptions about SDK methods that are not exported by the package.
- Tests that mock away all SDK behavior without checking input normalization, options, or event handling.

## Output Expectations

When reporting SDK work:

- Mention which SDK source was checked if it influenced the implementation.
- Call out any upstream/local package mismatch.
- Keep examples small and close to the public README patterns.
- Avoid claiming a method exists unless it is exported by the installed package or upstream source.
