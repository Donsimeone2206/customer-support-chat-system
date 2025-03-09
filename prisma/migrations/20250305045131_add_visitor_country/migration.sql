-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "country" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_country_idx" ON "Conversation"("country");
