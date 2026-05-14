import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { CodexGateway } from "./codex.gateway.js";

@Module({
  imports: [
    AppConfigModule
  ],
  providers: [
    CodexGateway
  ],
  exports: [
    CodexGateway
  ]
})
export class CodexModule {}
