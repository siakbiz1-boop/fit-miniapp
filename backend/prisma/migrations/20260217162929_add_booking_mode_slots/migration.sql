-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('trainer', 'both');

-- CreateEnum
CREATE TYPE "SessionSource" AS ENUM ('trainer', 'client');

-- AlterTable
ALTER TABLE "TrainerClient" ADD COLUMN     "clientTgUserId" BIGINT;

-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN     "bookingMode" "BookingMode" NOT NULL DEFAULT 'trainer';

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "source" "SessionSource" NOT NULL DEFAULT 'trainer';

-- CreateTable
CREATE TABLE "TrainingSlot" (
    "id" TEXT NOT NULL,
    "trainerTgUserId" BIGINT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingSlot_trainerTgUserId_dateKey_idx" ON "TrainingSlot"("trainerTgUserId", "dateKey");
