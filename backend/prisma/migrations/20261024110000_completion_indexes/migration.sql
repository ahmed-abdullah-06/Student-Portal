-- Query-shape indexes for high-volume tenant-scoped lists and audit history.
-- Fixed: original revision referenced Prisma model names instead of the
-- @@map() table names, and two columns ("read", "conversationId") that do
-- not exist in the schema, so it could never apply on any database.
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs" ("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_entityId_createdAt_idx" ON "audit_logs" ("entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "attendance_records_enrollmentId_date_idx" ON "attendance_records" ("enrollmentId", "date");
CREATE INDEX IF NOT EXISTS "enrollments_studentId_status_idx" ON "enrollments" ("studentId", "status");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "chat_messages_receiverId_createdAt_idx" ON "chat_messages" ("receiverId", "createdAt");
