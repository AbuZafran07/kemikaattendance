# Integration architecture
- Author remote agent tools in `src/lib/mcp`, with one SDK tool per file and SDK-generated transport; this keeps the published catalog aligned with handlers.
- MCP database access must use the verified OAuth caller's shared lazy client and existing RLS; no privileged or anonymous fallback is permitted.
- Browser tools register in their owning screen using `useWebMCP` and the shared telemetry helper; this bounds their lifetime and preserves normal UI operation.
- Preserve canonical same-origin consent return paths through existing password login; employee registration remains administrator-managed.