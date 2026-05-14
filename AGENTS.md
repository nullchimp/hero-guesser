# AGENTS.md

## Project

Hero Guesser is an app that guesses superhero and villain names. Keep changes small, testable, and sensitive to asset/data licensing.

## Project Skills

Use these repo-local skills when they match the task:

- `$hero-guesser-open-source` at `.codex/skills/hero-guesser-open-source/SKILL.md`: use for open source readiness, public repository hygiene, licenses, contributor docs, security policy, release process, dependency stewardship, CI, and third-party asset/data attribution.
- `$hero-guesser-clean-code-review` at `.codex/skills/hero-guesser-clean-code-review/SKILL.md`: use for critical codebase assessment, maintainability reviews, refactor planning, code-review findings, and clean-code tradeoffs.
- `$hero-guesser-tdd-feature` at `.codex/skills/hero-guesser-tdd-feature/SKILL.md`: use before implementing new gameplay, UI, scoring, dataset, accessibility, or bug-fix behavior where tests can describe expected outcomes.

When multiple skills apply, load the smallest useful set. For example, use the TDD skill while building a feature, then the clean-code review skill for a focused post-implementation critique. Use the open source skill before publishing, changing docs, adding external assets, or altering project governance.

## Context7 MCP

This repo configures Context7 in `.codex/config.toml`.

Use Context7 whenever work depends on current library, framework, tool, or API behavior. Prefer it before installing packages, changing framework configuration, writing tests against unfamiliar APIs, or following setup instructions that may have changed.

Efficient Context7 pattern:

1. If the exact Context7 library ID is known, query docs with that ID directly.
2. Otherwise resolve the library ID first, then query only the relevant topic.
3. Ask narrow questions tied to the current task, such as testing-library queries, Vite config, React Router loaders, or package-specific migration steps.
4. Summarize the docs that affected the change in the final answer when the decision is not obvious from the code.

Do not use Context7 for project-local facts that are available in the repository. Inspect the local code first, then use Context7 only for external documentation.

## Development Norms

- Read the existing code and tests before editing.
- Prefer `rg` for search.
- Preserve unrelated user changes.
- Add or update tests for behavior changes.
- Keep domain logic for name normalization, scoring, random selection, and answer validation easy to test outside the UI.
- Avoid committing copyrighted character art, logos, proprietary datasets, secrets, or generated build output.
