# Agent integrations
# Push worker and bounded queue
- [x] Initialize messaging worker without page messages; Firebase compat 13.3.0 activates in browser with no errors, notification display and dated click handlers tested.
- [x] Bound claims to 24 hours and five attempts; 13 push/worker tests pass including age boundaries, exhausted attempts and leases; 22 old notices skipped.
- [x] Verify active five-minute managed schedule, verify_jwt=false with internal cron authentication, real scheduled and direct cron calls return 200 and invalid credential returns 401.
- [ ] Verify closed-tab push receipt and dated click on a real employee device (requires a registered device and published worker).
# Attendance discipline correction
- [x] Prevent missing-reason scans from recreating any previously recorded attendance violation; 39 isolated database regression tests pass, including HR waiver, revoked SP, no new SP notifications, and counted per-date guard.
- [x] Enforce configured reason deadline on server/history without rewriting old data; add audited HR waiver and reactivate superseded SP without duplicates.
- [x] Run 37 deadline/waiver/SP and existing regression tests; verify signed-in settings and real violation correction form with empty-note submission disabled.
- [x] Restore 24-hour detection only for attendance with no submitted reason, and allow submission from history; schedule daily including weekends.
- [x] Preserve HR corrections, empty-department eligibility and locked-account checkout.
- [x] Reconcile warnings/automatic locks affected by corrected late violations with audit history; six prior SP records corrected, no active locks found.
- [x] Test corrected database rules and signed-in history dialog/cancel without fabricating employee reasons.
- [ ] Verify real employee reason submission/check-out end-to-end (needs employee test-account approval; own caller is admin and no false reasons were submitted).
- [x] Recheck past working dates when pending leave/travel requests are rejected, without counting protected dates.
- [x] Enforce server timestamps/status for employee check-in/out and use saved results in the employee screen.
- [x] Verify installed triggers, 14 isolated database tests, clean preview and signed-in admin screen.
- [ ] Verify real employee check-in/rejection end-to-end (available caller is an admin excluded from attendance; requires an employee test account and permission for test records).
- [x] Stop expiring submitted reasons awaiting HR and protect counting in the database.
- [x] Restore incorrectly expired submissions and deactivate timeout violations.
- [x] Deploy and verify the corrected rules with isolated PostgreSQL tests and the signed-in HR screen.

- [x] Enable managed OAuth and preserve existing password login.
- [x] Add caller-scoped read-only attendance MCP tool and browser companion.
- [x] Generate manifest; verify missing/invalid authorization, signed-out return path, signed-in attendance UI, and clean build.
- [ ] Verify live approve/deny and external MCP tool call (requires publishing the consent page and MCP revision).
- [ ] Republish to activate the new hosted MCP revision (requires user publication).
# Employee attendance notifications
- [x] Add dated approval/rejection, deduplicated reminders and counted-violation notifications with existing progress/SP merged.
- [x] Schedule hourly reminder and link notifications to dated history; installed schedule verified.
- [x] Run 53 regression tests (14 notification tests and 39 existing); signed-in notification page and dated history/reset checked, preview builds cleanly.
- [ ] Verify a real employee receives and clicks a new notification end-to-end (requester's account has no employee notifications; requires an employee test-account approval and permitted test decision).

# Attendance notification delivery
- [x] Include new employee attendance notifications in badge and scoped realtime updates; enable publication.
- [x] Format Indonesian dates and next warning thresholds; all 60 regression tests pass and preview builds cleanly.
- [x] Migrate send-notification to connector-backed FCM HTTP v1; atomic leased push queue, success-only pushed_at, stale-token cleanup, browser senders removed; 67 tests pass and authenticated worker returned 200 twice.
- [ ] Verify delivery on an employee device (no employee has an fcm_token registered; requires enabling notifications on a device).
