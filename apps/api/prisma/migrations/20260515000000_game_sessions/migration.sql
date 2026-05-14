ALTER TABLE `Conversation`
  ADD COLUMN `ownerId` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('ACTIVE', 'WON', 'LOST') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `questionsAsked` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `completedAt` DATETIME(3) NULL;

ALTER TABLE `Message`
  ADD COLUMN `kind` ENUM('CHAT', 'ANSWER', 'QUESTION', 'GUESS') NOT NULL DEFAULT 'CHAT';

CREATE TABLE `Guess` (
  `id` VARCHAR(191) NOT NULL,
  `conversationId` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `confidence` VARCHAR(191) NOT NULL,
  `rationale` TEXT NOT NULL,
  `status` ENUM('PENDING', 'CORRECT', 'WRONG') NOT NULL DEFAULT 'PENDING',
  `articleTitle` VARCHAR(191) NOT NULL,
  `articleUrl` TEXT NOT NULL,
  `articleExtract` TEXT NOT NULL,
  `imageUrl` TEXT NOT NULL,
  `imageWidth` INTEGER NULL,
  `imageHeight` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Guess_messageId_key`(`messageId`),
  INDEX `Guess_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
  INDEX `Guess_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Conversation_ownerId_updatedAt_idx` ON `Conversation`(`ownerId`, `updatedAt`);
CREATE INDEX `Conversation_status_model_idx` ON `Conversation`(`status`, `model`);

ALTER TABLE `Guess`
  ADD CONSTRAINT `Guess_conversationId_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Guess`
  ADD CONSTRAINT `Guess_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
