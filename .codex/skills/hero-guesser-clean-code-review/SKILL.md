---
name: hero-guesser-clean-code-review
description: Critical clean-code assessment workflow for the Hero Guesser codebase. Use when reviewing the codebase, evaluating implementation quality, planning refactors, assessing maintainability, or giving a code-review-style critique based on clean code principles such as naming, function size, cohesion, coupling, duplication, boundaries, tests, error handling, and readability.
---

# Hero Guesser Clean Code Review

## Goal

Assess Hero Guesser with a skeptical, practical clean-code lens and produce findings that help the code become easier to understand, test, and change.

## Review Workflow

1. Map the codebase before judging it: entry points, build tools, domain logic, UI state, data sources, tests, and deployment files.
2. Identify the highest-risk flows first: guessing logic, answer validation, scoring, persistence, randomization, user input, asset/data loading, and any external APIs.
3. Review from behavior outward: correctness and testability matter before stylistic preferences.
4. Report findings with file and line references where possible.
5. Prefer small refactor steps that preserve behavior and can be verified with tests.

## Clean Code Lenses

Use these lenses when evaluating code:

- Names: reveal intent, domain meaning, and units; avoid vague names like `data`, `item`, and `handleThing` when a better name exists.
- Functions/components: keep one clear responsibility, limit branching depth, separate orchestration from domain decisions.
- Boundaries: isolate framework code, UI wiring, data loading, persistence, and pure guessing rules.
- State: make ownership clear; avoid derived state that can drift from source state.
- Duplication: remove meaningful duplicated decisions, not harmless repeated literals.
- Error handling: make failed loading, invalid input, empty datasets, and unavailable browser APIs visible and recoverable.
- Tests: cover behavior and edge cases; avoid tests coupled to implementation details.
- Dependencies: avoid adding packages for simple logic; prefer maintained libraries for hard domains.
- Readability: optimize for the next maintainer making a small change under time pressure.

## Finding Format

For reviews, lead with issues before praise or summary:

- Severity: P0 for broken critical behavior, P1 for likely user-facing defects, P2 for maintainability risks, P3 for polish.
- Location: cite the tightest file and line.
- Impact: explain why this matters in concrete project terms.
- Recommendation: give a minimal repair path.

If no serious issues are found, say so clearly and call out remaining test or coverage gaps.

## Refactor Guidance

When asked to improve the code:

- Add or preserve tests around behavior before moving logic.
- Extract pure domain logic for guessing, normalization, scoring, and validation.
- Keep UI changes visually consistent with the existing app.
- Avoid broad rewrites unless the current structure blocks the requested work.
