import { Inject, Injectable, Optional } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AuthService } from "./auth.service.js";
import { AuthSessionResponse, GitHubIdentity } from "./auth.types.js";
import { CanvasAuthError } from "./canvas-auth.error.js";
import { GitHubIdentityService } from "./github-identity.service.js";

const CODE_BYTES = 32;
const CODE_TTL_MS = 60_000;
const MAX_CODES = 100;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export const CANVAS_AUTH_CLOCK = Symbol("CANVAS_AUTH_CLOCK");
export const CANVAS_AUTH_RANDOM_BYTES = Symbol("CANVAS_AUTH_RANDOM_BYTES");

type Clock = () => number;
type RandomBytes = (size: number) => Buffer;

interface BootstrapEntry {
  exchange: Promise<AuthSessionResponse> | null;
  expiresAt: number;
  identity: GitHubIdentity;
}

export interface CanvasBootstrapResponse {
  code: string;
  expiresAt: string;
}

@Injectable()
export class CanvasAuthService {
  private readonly entries = new Map<string, BootstrapEntry>();
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly auth: AuthService,
    private readonly github: GitHubIdentityService,
    @Optional()
    @Inject(CANVAS_AUTH_CLOCK)
    private readonly clock: Clock = Date.now,
    @Optional()
    @Inject(CANVAS_AUTH_RANDOM_BYTES)
    private readonly getRandomBytes: RandomBytes = randomBytes
  ) {}

  async createBootstrap(source: string): Promise<CanvasBootstrapResponse> {
    const now = this.clock();
    this.cleanup(now);
    this.checkRateLimit(source, now);

    if (this.entries.size >= MAX_CODES) {
      throw new CanvasAuthError(
        "Canvas sign-in is busy. Retrying automatically.",
        HttpStatus.SERVICE_UNAVAILABLE,
        true
      );
    }

    const identity = await this.github.getCurrentIdentity();
    const code = this.createUniqueCode();
    const expiresAt = now + CODE_TTL_MS;

    this.entries.set(hashCode(code), {
      exchange: null,
      expiresAt,
      identity
    });

    return {
      code,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  async exchange(code: string): Promise<AuthSessionResponse> {
    const now = this.clock();
    this.cleanup(now);
    const entry = this.entries.get(hashCode(code));

    if (entry === undefined || entry.expiresAt <= now) {
      throw new CanvasAuthError(
        "Canvas sign-in expired. Reopen the Hero Guesser Canvas.",
        HttpStatus.UNAUTHORIZED,
        false
      );
    }

    if (entry.exchange !== null) {
      return entry.exchange;
    }

    const exchange = this.auth.loginWithGitHub(entry.identity);
    entry.exchange = exchange;

    try {
      return await exchange;
    } catch (error) {
      if (entry.exchange === exchange) {
        entry.exchange = null;
      }

      throw error;
    }
  }

  private checkRateLimit(source: string, now: number): void {
    const recent = (this.attempts.get(source) ?? [])
      .filter((timestamp) => timestamp > now - RATE_WINDOW_MS);

    if (recent.length >= RATE_LIMIT) {
      this.attempts.set(source, recent);
      throw new CanvasAuthError(
        "Too many Canvas sign-in attempts. Retrying automatically.",
        HttpStatus.TOO_MANY_REQUESTS,
        true
      );
    }

    recent.push(now);
    this.attempts.set(source, recent);
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }

    for (const [source, timestamps] of this.attempts) {
      const recent = timestamps.filter((timestamp) => timestamp > now - RATE_WINDOW_MS);

      if (recent.length === 0) {
        this.attempts.delete(source);
      } else {
        this.attempts.set(source, recent);
      }
    }
  }

  private createUniqueCode(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.getRandomBytes(CODE_BYTES).toString("base64url");

      if (!this.entries.has(hashCode(code))) {
        return code;
      }
    }

    throw new CanvasAuthError(
      "Could not create a Canvas sign-in code. Retrying automatically.",
      HttpStatus.SERVICE_UNAVAILABLE,
      true
    );
  }
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
