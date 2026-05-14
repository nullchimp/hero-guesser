# Contributing

Thanks for helping with Hero Guesser.

## Local Workflow

The app runs through Docker Compose:

```sh
cp .env.example .env
docker compose up --build
```

Run checks in Docker:

```sh
docker compose --profile test run --rm test
```

## Standards

- Keep code TypeScript-first and easy to test.
- Add tests for user-visible behavior and persistence changes.
- Keep OpenAI API keys and other secrets out of commits.
- Do not add copyrighted superhero art, logos, wiki dumps, or proprietary datasets without a clear license trail.
- Prefer small, focused pull requests.

## Reporting Issues

Include the Docker command you ran, relevant logs, and whether the issue affects the frontend, API, database, or Codex SDK integration.
