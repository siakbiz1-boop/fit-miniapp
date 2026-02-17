-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('pending', 'active');

-- CreateTable
CREATE TABLE "TrainerClient" (
    "id" TEXT NOT NULL,
    "trainerTgUserId" BIGINT NOT NULL,
    "clientUsername" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'pending',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "goal" TEXT,
    "comment" TEXT,
    "subscriptionStart" TEXT,
    "subscriptionEnd" TEXT,
    "subscriptionPrice" TEXT,
    "subscriptionTotal" TEXT,
    "subscriptionLeft" TEXT,

    CONSTRAINT "TrainerClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientExercise" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerClient_trainerTgUserId_idx" ON "TrainerClient"("trainerTgUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerClient_trainerTgUserId_clientUsername_key" ON "TrainerClient"("trainerTgUserId", "clientUsername");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerClient_trainerTgUserId_code_key" ON "TrainerClient"("trainerTgUserId", "code");

-- CreateIndex
CREATE INDEX "ClientExercise_clientId_idx" ON "ClientExercise"("clientId");

-- AddForeignKey
ALTER TABLE "ClientExercise" ADD CONSTRAINT "ClientExercise_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TrainerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
