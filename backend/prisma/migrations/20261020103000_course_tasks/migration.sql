-- CreateTable
CREATE TABLE "course_tasks" (
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "facultyId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ASSIGNMENT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "teacherComments" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_submissions" (
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "comment" TEXT,
    "marks" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_tasks_courseId_idx" ON "course_tasks"("courseId");

-- CreateIndex
CREATE INDEX "course_tasks_tenantId_idx" ON "course_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "task_submissions_tenantId_idx" ON "task_submissions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_taskId_studentId_key" ON "task_submissions"("taskId", "studentId");

-- AddForeignKey
ALTER TABLE "course_tasks" ADD CONSTRAINT "course_tasks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_tasks" ADD CONSTRAINT "course_tasks_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "course_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
