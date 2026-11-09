# Completion Follow-up Patterns

Client-side media normalization, public faculty field selection, and calendar milestone merging can close user-visible requirements without changing the database schema.

## What Happened
For the Student-Portal completion follow-up, profile images are resized to a 640px JPEG before upload, faculty data is explicitly selected for student-facing responses, and current semester milestone dates are represented as calendar events.

## Takeaway
Prefer bounded client-side image processing and explicit Prisma `select` clauses for public profile data. Keep derived semester milestones in the calendar response when the existing schema already stores the dates.

## History
- 2026-10-24 (Student-Portal/completion-followup): initial
