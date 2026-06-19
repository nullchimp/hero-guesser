import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { CopilotGateway } from "./copilot.gateway.js";
import { COPILOT_RUNTIME, CopilotRuntime } from "./copilot.runtime.js";

@Module({
  imports: [
    AppConfigModule
  ],
  providers: [
    CopilotRuntime,
    {
      provide: COPILOT_RUNTIME,
      useExisting: CopilotRuntime
    },
    CopilotGateway
  ],
  exports: [
    CopilotGateway
  ]
})
export class CopilotModule {}
