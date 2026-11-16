# Agent integrations
# Attendance discipline correction
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