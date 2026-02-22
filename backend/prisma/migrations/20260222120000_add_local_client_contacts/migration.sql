-- Add contact fields for local clients
ALTER TABLE "TrainerClient" ADD COLUMN "contactTelegram" TEXT;
ALTER TABLE "TrainerClient" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "TrainerClient" ADD COLUMN "contactInstagram" TEXT;
ALTER TABLE "TrainerClient" ADD COLUMN "contactOtherSocial" TEXT;
