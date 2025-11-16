-- AlterTable
ALTER TABLE `users` ADD COLUMN `authMethod` VARCHAR(20) NOT NULL DEFAULT 'nim',
    ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `isProfileComplete` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `userType` VARCHAR(20) NOT NULL DEFAULT 'regular';
