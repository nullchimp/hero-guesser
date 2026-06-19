import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CopilotModule } from "../copilot/copilot.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { WikipediaModule } from "../wikipedia/wikipedia.module.js";
import { ConversationRepository } from "./conversation.repository.js";
import { ConversationService } from "./conversation.service.js";
import { ConversationsController } from "./conversations.controller.js";

@Module({
  imports: [
    AppConfigModule,
    AuthModule,
    CopilotModule,
    PrismaModule,
    WikipediaModule
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
