import { Module } from "@nestjs/common";
import { CodexModule } from "../codex/codex.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { ConversationRepository } from "./conversation.repository.js";
import { ConversationService } from "./conversation.service.js";
import { ConversationsController } from "./conversations.controller.js";

@Module({
  imports: [
    AppConfigModule,
    CodexModule,
    PrismaModule
  ],
  controllers: [
    ConversationsController
  ],
  providers: [
    ConversationRepository,
    ConversationService
  ]
})
export class ConversationsModule {}
