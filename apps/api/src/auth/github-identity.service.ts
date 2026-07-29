import { Inject, Injectable, Optional } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service.js";
import { GitHubIdentity } from "./auth.types.js";
import { CanvasAuthError } from "./canvas-auth.error.js";

const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REQUEST_TIMEOUT_MS = 5_000;

export const GITHUB_IDENTITY_FETCH = Symbol("GITHUB_IDENTITY_FETCH");

@Injectable()
export class GitHubIdentityService {
  constructor(
    private readonly config: AppConfigService,
    @Optional()
    @Inject(GITHUB_IDENTITY_FETCH)
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async getCurrentIdentity(): Promise<GitHubIdentity> {
    const token = this.config.copilotToken.trim();

    if (token.length === 0) {
      throw new CanvasAuthError(
        "Set COPILOT_GITHUB_TOKEN before opening Hero Guesser in Canvas.",
        HttpStatus.SERVICE_UNAVAILABLE,
        false
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await this.fetchFn(GITHUB_USER_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "HeroGuesser/0.1",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        redirect: "manual",
        signal: controller.signal
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";

      throw new CanvasAuthError(
        timedOut
          ? "GitHub identity lookup timed out. Retrying automatically."
          : "GitHub identity lookup failed. Retrying automatically.",
        HttpStatus.SERVICE_UNAVAILABLE,
        true
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401) {
      throw new CanvasAuthError(
        "COPILOT_GITHUB_TOKEN is invalid or expired.",
        HttpStatus.UNAUTHORIZED,
        false
      );
    }

    const rateLimited = response.status === 429 ||
      (response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0");

    if (rateLimited) {
      throw new CanvasAuthError(
        "GitHub rate-limited identity lookup. Retrying automatically.",
        HttpStatus.SERVICE_UNAVAILABLE,
        true
      );
    }

    if (response.status >= 500) {
      throw new CanvasAuthError(
        "GitHub identity lookup is temporarily unavailable. Retrying automatically.",
        HttpStatus.SERVICE_UNAVAILABLE,
        true
      );
    }

    if (!response.ok) {
      throw new CanvasAuthError(
        "GitHub could not verify the configured account.",
        HttpStatus.BAD_GATEWAY,
        false
      );
    }

    const body = await readJson(response);
    const identity = parseIdentity(body);

    if (identity === null) {
      throw new CanvasAuthError(
        "GitHub returned an invalid account identity.",
        HttpStatus.BAD_GATEWAY,
        false
      );
    }

    return identity;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseIdentity(value: unknown): GitHubIdentity | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const login = record.login;
  const id = record.id;

  if (
    typeof login !== "string" ||
    !GITHUB_LOGIN_PATTERN.test(login) ||
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return {
    id: String(id),
    login,
    loginKey: login.toLowerCase()
  };
}
