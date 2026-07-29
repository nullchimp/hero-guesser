# Hero Guesser

Hero Guesser is a small Dockerized game app where the player silently thinks of a superhero or villain and a selected Copilot model tries to guess the character. It uses Vue, NestJS, MySQL, Prisma, Wikipedia metadata, and the official [GitHub Copilot SDK](https://github.com/github/copilot-sdk) (`@github/copilot-sdk`), which embeds the Copilot CLI runtime in the API process.

## Requirements

- Docker with Docker Compose
- A GitHub token with Copilot access (`COPILOT_GITHUB_TOKEN`)

The application is designed to run through Docker Compose. Local Node commands are primarily for maintainers updating dependencies or troubleshooting.

## Run The App

1. Create a local environment file:

   ```sh
   cp .env.example .env
   ```

2. Set `COPILOT_GITHUB_TOKEN` in `.env`.

3. Start the full stack:

   ```sh
   docker compose up --build
   ```

4. Open `http://localhost:8080`, register a heroname, and start playing.

MySQL data is stored in the `hero-guesser-mysql` Docker volume, so conversation history survives container restarts. The GitHub Copilot SDK's per-conversation session state is stored in the `hero-guesser-copilot-home` named volume (mounted at `/var/lib/copilot-home` inside the API container), so in-flight games can resume after the API container is restarted.

The API container runs Prisma migrations on startup. If you need to apply migrations manually while using Docker, run them inside the Compose network:

```sh
npm run docker:migrate
```

If the API container is already running and built from the current code, this also works:

```sh
docker compose exec api npm run prisma:migrate -w @hero-guesser/api
```

## GitHub Copilot App Canvas

Hero Guesser can open in the GitHub Copilot App's canvas panel while using the same local web app, account, saved sessions, and leaderboard. Canvas launches sign in automatically with the GitHub account that owns `COPILOT_GITHUB_TOKEN`; no heroname or password form is shown.

[![Add Hero Guesser marketplace](https://img.shields.io/badge/Add_marketplace-GitHub_Copilot_App-0969da?style=for-the-badge)](https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fplugins%2Fmarketplace%2Fadd%3Fsource%3Dnullchimp%252Fhero-guesser)
[![Install Hero Guesser](https://img.shields.io/badge/Install-Hero_Guesser-1f883d?style=for-the-badge)](https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fplugins%2Finstall%3Fsource%3Dhero-guesser%2540hero-guesser)

1. Click **Add marketplace** and confirm `nullchimp/hero-guesser` in the Copilot App.
2. Click **Install Hero Guesser** and confirm `hero-guesser@hero-guesser`.
3. Clone this repository and start the Docker stack by following [Run The App](#run-the-app).
4. Start a Copilot App session and ask: `Open the Hero Guesser canvas.`

The buttons resolve plugin files from this repository's default branch and require confirmation in the app. If browser handoff is unavailable, install from a terminal instead:

```sh
copilot plugin marketplace add nullchimp/hero-guesser
copilot plugin install hero-guesser@hero-guesser
```

The canvas checks `http://localhost:8080/api/models` before opening the game. When the stack is ready, the extension requests a short-lived sign-in handoff from the API's loopback-only port and opens the game as the configured GitHub user. If the stack or GitHub API is temporarily unavailable, the Canvas keeps retrying automatically. If Docker stops after the game opens, restart it with `docker compose up --build`, then reopen the Canvas.

> **First run:** copy `.env.example` to `.env` and set `COPILOT_GITHUB_TOKEN` before starting Docker. The extension never reads or stores that token. The API resolves the token owner's GitHub username server-side and gives the Canvas a short-lived exchange code instead.

If the GitHub username case-insensitively matches an existing local heroname, Canvas links that local account so its saved case files remain available. This behavior assumes a trusted, single-user local installation. Other local processes are outside the authentication boundary and should not be treated as untrusted tenants.

For canvas and plugin behavior, see [Working with canvas extensions](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) and [Opening the GitHub Copilot App with deep links](https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links).

## Configuration

- `COPILOT_GITHUB_TOKEN`: GitHub personal access token (classic or fine-grained) from an account with an **active Copilot Individual, Business, or Enterprise subscription**. No special OAuth scopes needed — Copilot access is verified account-side. Keep this server-side only.
- `COPILOT_HOME`: Filesystem path used by the GitHub Copilot SDK runtime (Copilot CLI) to persist per-conversation session state. Set automatically by `docker-compose.yml` to `/var/lib/copilot-home`, which is backed by the named Docker volume `hero-guesser-copilot-home`. **Do not point this at your host `~/.copilot` directory**; the volume is intentionally isolated from any user-local Copilot CLI state.
- `DEFAULT_MODEL`: model selected by default, currently `gpt-5.4`.
- `MODEL_ALLOWLIST`: comma-separated list exposed to the frontend model picker.
- `JWT_SECRET`: secret used to sign login tokens. Use a random value with at least 32 characters outside local development.
- `JWT_EXPIRES_IN`: login token lifetime, defaulting to `7d`.
- `DATABASE_URL`: MySQL connection string used by Prisma.
- `WIKIPEDIA_USER_AGENT`: user-agent string sent by the API when looking up English Wikipedia articles and images for model guesses.

> **Security:** keep `COPILOT_GITHUB_TOKEN` server-side in Docker environment variables — never commit it to the repository. Report security vulnerabilities by opening a GitHub issue marked with the `security` label.

## Gameplay

- Register or log in with a heroname before playing in a normal browser. Copilot Canvas launches use the configured GitHub account automatically.
- Start a new session, think of a hero or villain, and answer the model's questions with only Yes, No, or Unknown.
- Each model gets up to 10 questions. Guesses do not consume the question budget.
- A guess is shown with a specific English Wikipedia article, summary, and lead image when the app can verify a character-specific page.
- Mark guesses Correct or Wrong. A wrong guess continues the session while questions remain; after 10 questions, a wrong guess records a loss.
- The global leaderboard ranks models by win rate, then by fewer average questions on wins.

## Development Checks

Run the Docker-oriented verification suite:

```sh
docker compose --profile test run --rm test
```

This installs dependencies in a disposable test container, generates the Prisma client, runs linting, typechecking, and tests.

## Open Source Notes

Hero Guesser does not ship copyrighted character art, logos, wiki dumps, or proprietary datasets. Wikipedia summaries and image URLs are fetched live and stored as attribution-friendly links to the source article, while remote images are displayed from Wikimedia rather than committed to the repository. User accounts, password hashes, sessions, answers, guesses, and judgments are stored in the configured MySQL database.

## License

MIT
