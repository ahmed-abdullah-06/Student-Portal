## strict-audit-2026-10-24 Final strict accessibility and responsive audit
- Codebase/domain discoveries: authenticated route fixtures must include `termsAcceptedAt`; otherwise ProtectedRoute intentionally redirects to `/accept-terms`.
- Wrong assumptions and corrections: route-level smoke checks can observe `ERR_ABORTED` during expected RBAC redirects; the audit now records the resulting document metrics rather than treating that redirect as an overflow failure.
- Techniques/patterns worth reusing: shared arbitrary-color utility overrides provide a low-diff contrast correction while preserving component layout; literal `t()` extraction catches untranslated keys without requiring a second parser.
- Learnings consumed: none

## translation-focused-pass-2026-10-24 Translation audit completion
- Codebase/domain discoveries: the existing i18n test covered literal `t()` keys but did not inspect visible JSX literals or route inventory; both are now deterministic, dependency-free checks.
- Wrong assumptions and corrections: the frontend has many legacy hardcoded strings outside the focused dashboard/attendance/error surfaces, so the scanner is intentionally an audit detector rather than a Babel rewrite; migrated surfaces use domain keys and Urdu fallback values.
- Techniques/patterns worth reusing: keep catalogue keys domain-prefixed (`dashboard.*`, `faculty.*`, `admin.*`, `errors.*`) and use interpolation for counts/percentages to preserve English/Urdu parity.
- Learnings consumed: [frontend/strict-audit-accessibility]
