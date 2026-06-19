-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `copilotSessionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Conversation_copilotSessionId_key` ON `Conversation`(`copilotSessionId`);
