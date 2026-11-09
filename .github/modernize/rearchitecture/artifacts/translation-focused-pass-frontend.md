# Translation-focused frontend implementation pass

## Summary
Completed the remaining translation audit implementation pass: expanded the English/Urdu catalogue, added deterministic JSX literal and route inventory extraction tests, and migrated dashboard, attendance, and error-boundary user-visible copy to translation keys with Urdu fallbacks.

## Changed files
- `frontend/src/i18n/index.jsx` — added shared dashboard, form, status, error, empty-state, and attendance keys in English and Urdu.
- `frontend/src/i18n/extractHardcodedStrings.js` — deterministic visible-literal and route-path extraction helpers.
- `frontend/src/i18n/coverage.test.jsx` — catalogue parity, literal-key, deterministic extraction, and 40+ route coverage tests.
- `frontend/src/pages/student/StudentDashboard.jsx` — translated dashboard stats, alerts, and course section.
- `frontend/src/pages/faculty/FacultyDashboard.jsx` — translated dashboard labels and empty/loading states.
- `frontend/src/pages/admin/AdminDashboard.jsx` — translated dashboard stats, headings, and activity/system states.
- `frontend/src/pages/faculty/MarkAttendance.jsx` — translated form labels, statuses, loading, and empty states.
- `frontend/src/components/shared/ErrorBoundary.jsx` — English/Urdu fallback-aware crash UX.
- `project_completion_audit.md` — reconciled i18n checkboxes and evidence links; external penetration testing is the only unchecked item.

## Upstream Artifacts Consumed
- none — no dependency artifacts provided

## Evidence Mapping
- none — no dependency artifacts provided

## Test Results
- Command: `npm test`
- Passed: 16
- Failed: 0
- Skipped: 0
- Command: `npm run build`
- Result: passed; Vite production bundle emitted successfully (existing chunk-size advisory)
- Command: `npm run lint`
- Result: non-zero due to pre-existing repository/generated trace warnings and source warnings; no changed-file errors except existing accessibility warning in `MarkAttendance.jsx`
- Command: `cd frontend && npx oxlint src/i18n/index.jsx src/i18n/extractHardcodedStrings.js src/i18n/coverage.test.jsx src/pages/student/StudentDashboard.jsx src/pages/faculty/FacultyDashboard.jsx src/pages/admin/AdminDashboard.jsx src/pages/faculty/MarkAttendance.jsx src/components/shared/ErrorBoundary.jsx`
- Result: passed with warnings only (existing Fast Refresh export warnings in `i18n/index.jsx` and existing unlabeled lecture-number control warning)
