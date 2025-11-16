-- AlterTable
ALTER TABLE `users` ADD COLUMN `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `verificationAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `verificationCode` VARCHAR(6) NULL,
    ADD COLUMN `verificationCodeExpires` DATETIME(3) NULL,
    MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'pending';
