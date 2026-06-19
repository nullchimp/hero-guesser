import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtSignOptions } from "@nestjs/jwt";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get copilotToken(): string {
    return this.getString("COPILOT_GITHUB_TOKEN");
  }

  get copilotHome(): string | undefined {
    const value = this.configService.get<string>("COPILOT_HOME");
    const trimmed = value?.trim();

    return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
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
