# Strict Audit Accessibility Patterns

Shared form and color primitives are the safest place to close cross-page accessibility gaps without rewriting every page.

## What Happened
The final Student Portal audit found that `Field` generated a label for its internal `useId()` even when a child supplied an explicit `id`, and several shared muted/status colors fell just below WCAG AA on authenticated surfaces. The fix preserves explicit IDs, wires hint/error descriptions to the actual control, announces errors, and overrides repeated arbitrary utility colors centrally. Playwright now checks authenticated axe rules, labels, routes at 360/768px, and touch navigation.

## Takeaway
When a React form abstraction accepts arbitrary child controls, derive one `controlId` from the child first and use it consistently for `label[for]`, `aria-describedby`, and error IDs. Keep a literal translation-key extraction test alongside catalogue parity tests so new `t('...')` calls cannot silently fall back to source keys.

## History
- 2026-10-24 (Student-Portal/strict-audit-2026-10-24): initial
