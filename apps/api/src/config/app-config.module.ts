import { Module } from "@nestjs/common";
import { AppConfigService } from "./app-config.service.js";
import { ModelCatalog } from "./model-catalog.service.js";

@Module({
  providers: [
    AppConfigService,
    ModelCatalog
  ],
  exports: [
    AppConfigService,
    ModelCatalog
  ]
})
export class AppConfigModule {}
