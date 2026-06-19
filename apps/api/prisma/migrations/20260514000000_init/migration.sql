-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `heroname` VARCHAR(191) NOT NULL,
    `heronameKey` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_heronameKey_key`(`heronameKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `model` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'WON', 'LOST') NOT NULL DEFAULT 'ACTIVE',
    `questionsAsked` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Conversation_sessionId_key`(`sessionId`),
    INDEX `Conversation_ownerId_updatedAt_idx`(`ownerId`, `updatedAt`),
    INDEX `Conversation_status_model_idx`(`status`, `model`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT') NOT NULL,
    `kind` ENUM('CHAT', 'ANSWER', 'QUESTION', 'GUESS') NOT NULL DEFAULT 'CHAT',
    `content` TEXT NOT NULL,
    `model` VARCHAR(191) NULL,
    `status` ENUM('COMPLETE', 'STREAMING', 'FAILED') NOT NULL DEFAULT 'COMPLETE',
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Guess_messageId_key`(`messageId`),
    INDEX `Guess_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `Guess_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guess` ADD CONSTRAINT `Guess_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guess` ADD CONSTRAINT `Guess_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

