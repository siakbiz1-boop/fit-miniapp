-- Add group session participants table
CREATE TABLE "GroupSessionParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientUsername" TEXT NOT NULL,
  "clientName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GroupSessionParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GroupSessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GroupSessionParticipant_sessionId_idx" ON "GroupSessionParticipant"("sessionId");
CREATE INDEX "GroupSessionParticipant_clientId_idx" ON "GroupSessionParticipant"("clientId");
CREATE INDEX "GroupSessionParticipant_clientUsername_idx" ON "GroupSessionParticipant"("clientUsername");
