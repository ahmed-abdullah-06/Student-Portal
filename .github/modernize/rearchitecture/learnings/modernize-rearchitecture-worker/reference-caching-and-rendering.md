# Reference caching and rendering

Reference GET caching should be opt-in and short-lived, while large tables should retain complete accessible rows and use pagination plus native `content-visibility:auto` rather than truncating data.

## What Happened

The final completion pass added a 30-second stale-while-revalidate path in the frontend API client and a row rendering hint for audit logs. Truncating rows was rejected because it would hide data from users.

## Takeaway

Use bounded server pagination as the correctness boundary; use browser rendering hints only as a performance optimization. Keep cache scope limited to rarely changing reference resources.

## History

- 2026-10-24 (Student-Portal/completion-final-targeted-pass): initial
