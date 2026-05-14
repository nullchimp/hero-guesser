import { BadRequestException, Injectable } from "@nestjs/common";
import { AppConfigService } from "./app-config.service.js";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ModelCatalogResponse {
  defaultModel: string;
  models: ModelOption[];
}

@Injectable()
export class ModelCatalog {
  constructor(private readonly config: AppConfigService) {}

  list(): ModelCatalogResponse {
    return {
      defaultModel: this.defaultModel,
      models: this.allowedModels.map((model) => ({
        id: model,
        label: model
      }))
    };
  }

  resolve(requestedModel: string | undefined): string {
    const model = requestedModel?.trim() || this.defaultModel;

    if (!this.allowedModels.includes(model)) {
      throw new BadRequestException(`Model "${model}" is not available.`);
    }

    return model;
  }

  private get defaultModel(): string {
    const configuredDefault = this.config.defaultModel;

    if (this.allowedModels.includes(configuredDefault)) {
      return configuredDefault;
    }

    return this.allowedModels[0] ?? configuredDefault;
  }

  private get allowedModels(): string[] {
    const uniqueModels = [...new Set(this.config.modelAllowlist)];

    if (uniqueModels.length === 0) {
      return [this.config.defaultModel];
    }

    return uniqueModels;
  }
}
