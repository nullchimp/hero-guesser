ALTER TABLE `User`
    MODIFY `passwordHash` VARCHAR(191) NULL,
    ADD COLUMN `githubId` VARCHAR(191) NULL,
    ADD COLUMN `githubLogin` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_githubId_key` ON `User`(`githubId`);
