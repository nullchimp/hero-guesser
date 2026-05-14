import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { WikipediaService } from "./wikipedia.service.js";

@Module({
  imports: [
    AppConfigModule
  ],
  providers: [
    WikipediaService
  ],
  exports: [
    WikipediaService
  ]
})
export class WikipediaModule {}
