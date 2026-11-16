# Integration architecture
- Recheck rejected leave/travel dates in database triggers, skipping attendance, protected requests and non-working dates; decisions must not depend on the daily worker revisiting history.
- Enforce employee attendance timestamps and timing-derived status in database triggers; administrative historical corrections retain their existing path and the UI reads saved results.
- Serialize missing-reason scans and submissions on attendance rows; count only unsubmitted reasons after 24 hours, preserving HR-pending protection and late minutes after early checkout.
- Permit admin/HR historical corrections and locked employees' checkout; reconcile invalid warnings and automatic locks with immutable audit history when late counts are corrected.
- Enforce pending/approved late-reason protection in database triggers as well as the scheduled checker, so stale workers cannot count HR delays as employee violations.
- Author remote agent tools in `src/lib/mcp`, with one SDK tool per file and SDK-generated transport; this keeps the published catalog aligned with handlers.
- MCP database access must use the verified OAuth caller's shared lazy client and existing RLS; no privileged or anonymous fallback is permitted.
- Browser tools register in their owning screen using `useWebMCP` and the shared telemetry helper; this bounds their lifetime and preserves normal UI operation.
- Preserve canonical same-origin consent return paths through existing password login; employee registration remains administrator-managed.