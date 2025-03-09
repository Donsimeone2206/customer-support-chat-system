-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_ipAddress_idx" ON "Conversation"("ipAddress");
