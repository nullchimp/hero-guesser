import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtSignOptions } from "@nestjs/jwt";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get codexWorkspace(): string {
    return this.getString("CODEX_WORKSPACE");
  }

  get databaseUrl(): string {
    return this.getString("DATABASE_URL");
  }

  get defaultModel(): string {
    return this.getString("DEFAULT_MODEL");
  }

  get modelAllowlist(): string[] {
    return this.getString("MODEL_ALLOWLIST")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);
  }

  get openAiApiKey(): string {
    return this.getString("OPENAI_API_KEY");
  }

  get jwtExpiresIn(): JwtSignOptions["expiresIn"] {
    return this.getString("JWT_EXPIRES_IN") as JwtSignOptions["expiresIn"];
  }

  get jwtSecret(): string {
    return this.getString("JWT_SECRET");
  }

  get wikipediaUserAgent(): string {
    return this.getString("WIKIPEDIA_USER_AGENT");
  }

  private getString(name: string): string {
    const value = this.configService.get<string>(name);

    if (value === undefined) {
      throw new Error(`Missing required config value: ${name}`);
    }

    return value;
  }
}
