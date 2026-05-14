import { BadRequestException } from "@nestjs/common";
import { AppConfigService } from "../src/config/app-config.service.js";
import { ModelCatalog } from "../src/config/model-catalog.service.js";

describe("ModelCatalog", () => {
  it("exposes a server-configured allowlist and default model", () => {
    const catalog = new ModelCatalog(configFor(["gpt-5.3-codex", "gpt-5.4-mini"], "gpt-5.3-codex"));

    expect(catalog.list()).toEqual({
      defaultModel: "gpt-5.3-codex",
      models: [
        { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
        { id: "gpt-5.4-mini", label: "gpt-5.4-mini" }
      ]
    });
  });

  it("rejects models outside the allowlist", () => {
    const catalog = new ModelCatalog(configFor(["gpt-5.3-codex"], "gpt-5.3-codex"));

    expect(() => catalog.resolve("unknown-model")).toThrow(BadRequestException);
  });
});

function configFor(modelAllowlist: string[], defaultModel: string): AppConfigService {
  return {
    codexWorkspace: "/tmp/codex",
    databaseUrl: "mysql://example",
    defaultModel,
    modelAllowlist,
    openAiApiKey: "test-key"
  } as AppConfigService;
}
