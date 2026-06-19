# AGENTS.md

## Project

Hero Guesser is an app that guesses superhero and villain names. Keep changes small, testable, and sensitive to asset/data licensing.

## Development Norms

- Read the existing code and tests before editing.
- Prefer `rg` for search.
- Preserve unrelated user changes.
- Add or update tests for behavior changes.
- Keep domain logic for name normalization, scoring, random selection, and answer validation easy to test outside the UI.
- Avoid committing copyrighted character art, logos, proprietary datasets, secrets, or generated build output.
