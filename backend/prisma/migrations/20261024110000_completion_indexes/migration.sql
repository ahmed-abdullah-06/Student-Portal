-- Query-shape indexes for high-volume tenant-scoped lists and audit history.
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_createdAt_idx" ON "AuditLog" ("entityId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AttendanceRecord_enrollmentId_date_idx" ON "AttendanceRecord" ("enrollmentId", "date" DESC);
CREATE INDEX IF NOT EXISTS "Enrollment_studentId_status_idx" ON "Enrollment" ("studentId", "status");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification" ("userId", "read");
CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage" ("conversationId", "createdAt" DESC);
