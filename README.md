# Hero Guesser

Hero Guesser is a small Dockerized chat app that guesses superhero or villain names from user clues. It uses Vue, NestJS, MySQL, Prisma, and the OpenAI Codex SDK.

## Requirements

- Docker with Docker Compose
- An OpenAI API key for live Codex SDK responses

The application is designed to run through Docker Compose. Local Node commands are primarily for maintainers updating dependencies or troubleshooting.

## Run The App

1. Create a local environment file:

   ```sh
   cp .env.example .env
   ```

2. Set `OPENAI_API_KEY` in `.env`.

3. Start the full stack:

   ```sh
   docker compose up --build
   ```

4. Open `http://localhost:8080`.

MySQL data is stored in the `hero-guesser-mysql` Docker volume, so conversation history survives container restarts.

## Configuration

- `OPENAI_API_KEY`: server-side key used by the Codex SDK.
- `DEFAULT_MODEL`: model selected by default, currently `gpt-5.3-codex`.
- `MODEL_ALLOWLIST`: comma-separated list exposed to the frontend model picker.
- `DATABASE_URL`: MySQL connection string used by Prisma.
- `CODEX_WORKSPACE`: controlled workspace path used by Codex SDK runs inside the API container.

## Development Checks

Run the Docker-oriented verification suite:

```sh
docker compose --profile test run --rm test
```

This installs dependencies in a disposable test container, generates the Prisma client, runs linting, typechecking, and tests.

## Open Source Notes

Hero Guesser does not ship copyrighted character art, logos, wiki dumps, or proprietary datasets. User prompts and model outputs are stored as conversation history in the configured MySQL database.

## License

MIT
