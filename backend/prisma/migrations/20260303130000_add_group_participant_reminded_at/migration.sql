-- Track per-participant reminder delivery
ALTER TABLE "GroupSessionParticipant" ADD COLUMN "remindedAt" TIMESTAMP(3);
