# UAT Checklist — One University Pilot

Run this with the university's real users against the production URL before
announcing the portal. One tester per role (2 for students). Record findings as
GitHub issues with the route + account + steps.

**Suggested schedule:** 1 day admin walkthrough → 2 days faculty + student pilot
→ 1 day triage/fixes → sign-off meeting.

## 0. Setup

- [ ] Production URL + TLS certificate valid (`https://...`)
- [ ] Real accounts created (not demo): 1 admin, 2–3 faculty, 10–20 pilot students
- [ ] Real course catalogue + one active semester imported, sections assigned
- [ ] All testers can log in with their own credentials (email or roll number)
- [ ] Password reset email received by all testers
- [ ] Landing page shows all three portals; each portal rejects the wrong role

## 1. Admin scenarios

- [ ] Dashboard stats match expected totals
- [ ] Onboard a student + faculty manually; welcome email received
- [ ] Import a small CSV (10 rows) with `?dryRun=1` first, then for real
- [ ] Create semester, section, timetable slot; room conflict is blocked (409)
- [ ] Generate bulk challans for a section; verify amounts + due dates
- [ ] Mark one challan paid manually; student sees updated status
- [ ] Approve a withdrawal request; enrollment drops
- [ ] Publish a notice; appears for the right audience
- [ ] Export attendance + fee-defaulters reports; open CSVs in Excel
- [ ] Settings: change a branding value (e.g. portal name) → UI updates after refresh
- [ ] Audit log shows all of the above with actor + timestamp

## 2. Faculty scenarios

- [ ] See assigned sections and correct rosters
- [ ] Mark attendance for a lecture, edit and re-save
- [ ] Enter marks for assignments/quizzes/midterm; student sees them immediately
- [ ] Post an assignment with an attachment; student downloads it
- [ ] Review a submission, set marks + comment; student sees both
- [ ] Freeze results for a section; admin sees frozen state
- [ ] Evaluation analytics show submitted student evaluations

## 3. Student scenarios

- [ ] Register for courses within the credit-hour limit; prerequisite violation blocked
- [ ] View attendance %, marks, SGPA/CGPA
- [ ] Download transcript PDF and one certificate; details are correct
- [ ] Pay a challan with a real small card (if Stripe live) or verified manual proof
- [ ] Upload a bank payment proof; admin verifies → challan marked paid
- [ ] Open a course workspace; download material; upload an assignment submission
- [ ] Submit a complaint; admin resolves; student sees the reply
- [ ] Apply for a certificate; admin marks issued; student downloads it
- [ ] 2FA (optional pilot): enable TOTP, log out, log back in with the code

## 4. Cross-cutting

- [ ] Mobile viewport (360–430px): sidebar, tables and forms usable
- [ ] Dark mode toggle across 5 random pages
- [ ] Urdu language toggle on 5 random pages (report missing strings)
- [ ] Two students cannot see each other's data (IDOR spot check)
- [ ] Wrong-role login attempts are rejected with a clear message
- [ ] Session list under Security shows the login; revoking it logs the session out
- [ ] Slow-network check: pages load under 3s on 3G throttling

## 5. Sign-off

- [ ] All P1/P2 findings fixed and re-tested
- [ ] P3 findings listed with owners and target dates
- [ ] Admin training session completed (docs/handover.md)
- [ ] Backup cron verified running + restore drill evidence attached
- [ ] Written go/no-go decision from the university IT lead
