# Real-Data Import Guide

Use these to load the university's actual data before UAT. All imports are
CSV, run from **Admin → People/Academics → Import** or via API. Always run with
`?dryRun=1` first — it reports what would happen (create/update/skip + reasons)
without writing anything.

Notes that apply everywhere:

- Header row is required; names are matched case-insensitively
  (`rollNumber` = `roll_number` = `rollnumber`). UTF-8 with or without BOM.
- A `password` column is optional. Missing → a random temp password is generated
  and the user must change it on first login. Welcome email is attempted for
  each created account (real SMTP needed).
- Rows are independent: one bad row is skipped with a reason, the rest proceed.
  The response lists `created`/`updated` and `skipped: [{ row, reason }]`.
- Imports are tenant-scoped and quota-checked (students/faculty plans).

## 1. Students — `POST /api/admin/students/import`

Required columns: `email, rollNumber, name, department, batch`
Optional: `password, degree (default BS), currentSemester (1), cnic, guardianName, phone, address`

```csv
email,rollNumber,name,department,batch,degree,currentSemester,phone
ahmed.raza@student.novastra.edu.pk,SP25-BSCS-101,Ahmed Raza,Computer Science,BS-2025,BS,1,03001234567
```

Tips: roll numbers are stored uppercase; duplicates inside the file and emails
already in use are skipped. Start with 10 real students, verify login + a fee
challan appears once enrolled, then import the full list.

## 2. Faculty — `POST /api/admin/import/faculty`

Required: `email, employeeId, name, designation, department`
Optional: `password, phone`

```csv
email,employeeId,name,designation,department
sara.iqbal@novastra.edu.pk,EMP-2041,Dr. Sara Iqbal,Assistant Professor,Computer Science
```

Existing `employeeId`/email → skipped (no overwrite of profiles). Passwords are
temp and forced to change on first login.

## 3. Courses — `POST /api/admin/import/courses`

Required: `courseCode, title, creditHours, department`
Optional: `prerequisites` (comma/semicolon separated course codes), `description`

```csv
courseCode,title,creditHours,department,prerequisites
CS-101,Programming Fundamentals,3,Computer Science,
CS-201,Data Structures,3,Computer Science,CS-101
```

Courses are **upserted by courseCode** (title/credits/prereqs update). Create
prerequisite courses before dependents, or run the file twice.

## 4. Semester records (GPA history) — `POST /api/admin/import/semester-records`

Required: `rollNumber, semester, sgpa, cgpa, creditHours`

```csv
rollNumber,semester,sgpa,cgpa,creditHours
SP23-BSCS-001,1,3.52,3.52,17
```

Upserts on (student, semester); `creditHours` 0–40, SGPA/CGPA 0–4. Student must
exist (import students first). This feeds the transcript's semester table.

## 5. Historical grades — `POST /api/admin/import/historical-grades`

Required: `rollNumber, courseCode, semester, year, gradeLetter`

```csv
rollNumber,courseCode,semester,year,gradeLetter
SP23-BSCS-001,CS-101,1,2023,A
```

Student + course must exist. Grade letters: A+ A A- B+ B B- C+ C C- D+ D F (as
used by the university). Feeds the transcript's course rows; upserts on
(student, course, semester, year).

## Order of operations for a fresh university

1. Admin/operator accounts (platform console + `npm run bootstrap`)
2. Faculty CSV
3. Courses CSV
4. Students CSV
5. Semester records CSV (GPA history)
6. Historical grades CSV
7. Create current semester + sections, assign faculty, build timetable
8. Fee structures → bulk challans for the current semester
9. Spot-check 3 students' dashboards (attendance, results, challans) before UAT

## Rollback / fixing mistakes

- Wrong rows were imported? Fix the CSV row and re-import (courses/grades/GPA
  upsert). For students, edit the record in Admin → People (no bulk delete).
- A skipped row's reason is in the API response (`skipped: [{ row, reason }]`).
- Worst case: `npm run restore` a pre-import backup into a scratch DB to
  compare, or restore fully during a maintenance window (docs/runbook.md §5).
