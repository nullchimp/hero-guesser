# Security Policy

## Reporting A Vulnerability

Please report suspected security issues privately before opening a public issue. If no private contact is available for your fork, use the repository owner contact channel for `nullchimp`.

Include:

- A short description of the issue.
- Steps to reproduce.
- Whether secrets, conversation history, or database contents may be exposed.

## Secret Handling

Hero Guesser expects `OPENAI_API_KEY` to stay server-side in Docker environment variables. Do not commit `.env` files, API keys, exported database dumps, or private conversation history.
