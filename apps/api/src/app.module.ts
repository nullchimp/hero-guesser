import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import Joi from "joi";
import { CodexModule } from "./codex/codex.module.js";
import { ConversationsModule } from "./conversations/conversations.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        CODEX_WORKSPACE: Joi.string().default("/workspace/codex-workspace"),
        DATABASE_URL: Joi.string().required(),
        DEFAULT_MODEL: Joi.string().default("gpt-5.3-codex"),
        JWT_EXPIRES_IN: Joi.string().default("7d"),
        JWT_SECRET: Joi.string().min(32).required(),
        MODEL_ALLOWLIST: Joi.string().default("gpt-5.3-codex,gpt-5.4,gpt-5.4-mini"),
        OPENAI_API_KEY: Joi.string().allow("").default(""),
        PORT: Joi.number().port().default(3000),
        WIKIPEDIA_USER_AGENT: Joi.string().default(
          "HeroGuesser/0.1 (https://github.com/nullchimp/hero-guesser)"
        )
      })
    }),
    AppConfigModule,
    PrismaModule,
    AuthModule,
    CodexModule,
    ConversationsModule
  ]
})
export class AppModule {}
