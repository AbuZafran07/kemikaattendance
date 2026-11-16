# Agent integrations
# Attendance discipline correction
- [x] Stop expiring submitted reasons awaiting HR and protect counting in the database.
- [x] Restore incorrectly expired submissions and deactivate timeout violations.
- [x] Deploy and verify the corrected rules with isolated PostgreSQL tests and the signed-in HR screen.

- [x] Enable managed OAuth and preserve existing password login.
- [x] Add caller-scoped read-only attendance MCP tool and browser companion.
- [x] Generate manifest; verify missing/invalid authorization, signed-out return path, signed-in attendance UI, and clean build.
- [ ] Verify live approve/deny and external MCP tool call (requires publishing the consent page and MCP revision).
- [ ] Republish to activate the new hosted MCP revision (requires user publication).