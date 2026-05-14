---
name: hero-guesser-tdd-feature
description: Test-driven development workflow for adding new Hero Guesser features. Use when implementing a new feature, gameplay behavior, UI interaction, scoring rule, dataset change, accessibility improvement, or bug fix where behavior can be specified with tests before implementation.
---

# Hero Guesser TDD Feature

## Goal

Build new Hero Guesser behavior through a tight red-green-refactor loop so features arrive with executable expectations instead of after-the-fact tests.

## TDD Workflow

1. Translate the user request into observable behavior and examples.
2. Inspect the existing test setup and choose the smallest appropriate test level: unit, component, integration, or end-to-end.
3. Write one failing test that names the behavior in user/domain language.
4. Run the narrow test command and confirm the failure is for the expected reason.
5. Implement the minimum code that makes the test pass.
6. Run the narrow test again, then the broader relevant suite.
7. Refactor only after tests are green.
8. Repeat for each meaningful behavior or edge case.

## What To Test First

Prefer tests around user-visible and domain behavior:

- Name matching: casing, punctuation, aliases, whitespace, and partial-answer rules.
- Guess lifecycle: prompt shown, answer submitted, result displayed, next round started.
- Scoring: streaks, attempts, hints, time limits, or penalties.
- Dataset behavior: empty data, duplicate names, invalid entries, filtering, and random selection.
- Accessibility: keyboard use, labels, focus movement, and status updates.
- Persistence: saved settings, history, and reset behavior.

## Test Design

Keep tests resilient:

- Assert outcomes, not private implementation details.
- Use deterministic data for random or time-based behavior.
- Build small fixtures that express superhero/villain examples without depending on copyrighted assets.
- Prefer pure-function tests for normalization, scoring, selection, and validation logic.
- Use component or browser tests for actual user flows.

## Implementation Discipline

During TDD work:

- Do not skip the failing-test step unless the repo has no test tooling yet; in that case, add the smallest viable test setup first.
- Do not add broad abstractions before the second real use case.
- Keep each commit-sized change focused on one behavior.
- When library APIs are uncertain, query Context7 before writing tests or implementation against guessed APIs.
