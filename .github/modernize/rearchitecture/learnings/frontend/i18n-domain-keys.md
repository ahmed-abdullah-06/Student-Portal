# I18n domain key conventions

Use domain-prefixed translation keys with interpolation for dynamic dashboard, status, form, and error copy.

## What Happened
The focused translation pass added `dashboard.*`, `faculty.*`, `admin.*`, `common.*`, and `errors.*` keys in both English and Urdu. Components call `useI18n().t()` and pass dynamic counts/percentages through placeholders rather than concatenating user-visible sentences.

## Takeaway
When migrating another page, add matching keys to both catalogues first, use interpolation for values, and extend `coverage.test.jsx` so literal key parity remains enforced.

## History
- 2026-10-24 (student-portal/translation-focused-pass): initial
