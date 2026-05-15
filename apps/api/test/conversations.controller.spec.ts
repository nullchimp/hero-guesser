import { ModelCatalog } from "../src/config/model-catalog.service.js";
import { AuthUser } from "../src/auth/auth.types.js";
import { ConversationService } from "../src/conversations/conversation.service.js";
import { ConversationsController } from "../src/conversations/conversations.controller.js";

describe("ConversationsController authentication", () => {
  it("uses the authenticated user id when listing sessions", async () => {
    const conversations = {
      listSessions: vi.fn().mockResolvedValue({
        sessions: []
      })
    };
    const controller = new ConversationsController(
      conversations as unknown as ConversationService,
      {
        list: vi.fn()
      } as unknown as ModelCatalog
    );
    const user: AuthUser = {
      heroname: "ShadowFox",
      id: "user-1"
    };

    await controller.listSessions(user);

    expect(conversations.listSessions).toHaveBeenCalledWith({
      ownerId: "user-1"
    });
  });
});
