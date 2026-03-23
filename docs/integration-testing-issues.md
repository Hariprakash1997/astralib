# @astralibx Integration Testing Issues

Issues found during massage-website migration testing (2026-03-23).

---

## Library Issues (fix in @astralibx)

### ISSUE-1. ~~`<alx-chat-widget>` launcher not fixed positioned~~ FIXED

**Package:** `@astralibx/chat-widget`
**Root cause:** Line 92: `:host { display: block; position: relative; }`. Should be `position: fixed`.
**Fix:** Change to `position: fixed; bottom: 20px; right: 20px; z-index: 9999;` and respect the `position` property (`bottom-right` / `bottom-left`).
**Severity:** High

---

### ISSUE-2. ~~staff-engine list endpoint double-nests `data`~~ FIXED

**Package:** `@astralibx/staff-engine`
**Root cause:** `staff.service.list()` returns `{ data: [...], pagination: {...} }`. Route passes this to `sendSuccess(res, result)` which wraps as `{ success: true, data: { data: [...], pagination: {...} } }`. Consumer gets `response.data.data`.
**Fix:** Destructure before sendSuccess: `const { data, pagination } = result; sendSuccess(res, { staff: data, pagination });` or spread pagination to top level.
**Severity:** Medium

---

### ~~ISSUE-5. `PUT /staff/:id` merges permissions~~ — NOT A BUG

**Verdict:** Not a library bug. The `update()` method (line 109-133) only accepts `name, email, metadata`. It does NOT touch permissions — they're silently ignored. The consumer (our frontend) was sending permissions to the wrong endpoint. The dedicated `PUT /:staffId/permissions` endpoint does a full replace (`staff.permissions = permissions`). Fix is local (ISSUE-5b).

---

### ISSUE-7. ~~call-log-engine CRUD routes at `/calls` sub-path~~ FIXED

**Package:** `@astralibx/call-log-engine`
**Root cause:** Line 63: `protectedRouter.use('/calls', createCallLogRoutes(...))`. When consumer mounts at `/api/call-logs`, paths become `/api/call-logs/calls/...`. Inconsistent — staff-engine mounts CRUD at root.
**Fix:** Change `/calls` to `/` in routes. Needs careful handling since settings routes also mount at `/`.
**Severity:** High

---

### ISSUE-8. ~~Chat widget `socketUrl` not reactive~~ FIXED

**Package:** `@astralibx/chat-widget`
**Root cause:** `socketUrl` IS a reactive Lit property (line 131: `@property({ attribute: 'socket-url' })`). But the `updated()` method (line 319-330) does NOT watch for `socketUrl` changes — it only watches `theme`, `primaryColor`, `dir`, `locale`. When `socketUrl` changes from empty to a value, no connection is initiated.
**Fix:** Add `socketUrl` handling to `updated()` — when it changes from empty to a value, call the connection method.
**Note:** The attribute name is `socket-url` (kebab-case), not `socketurl`. Angular should use `[attr.socket-url]` not `[attr.socketUrl]`.
**Severity:** Critical

---

## Local Issues (fix in massage-website frontend)

### ISSUE-3. Owner shows "0 of 28 permissions" — cosmetic

**File:** `staff-management.html`
**Fix:** Show "Owner — all access" when `staff.role === 'owner'`.

---

### ISSUE-4. "Activate" button shown for already-active staff

**File:** `staff-management.html`
**Fix:** Status check compares `'verified'` — update to `'active'`.

---

### ISSUE-5b. Frontend sends permissions to wrong endpoint

**File:** `staff-management.ts`
**Fix:** Change from `PUT /staff/:id` to `PUT /staff/:id/permissions` with body `{ permissions: [...] }`.

---

### ISSUE-6. Activate/deactivate sends to wrong endpoint with empty body

**File:** `staff-management.ts`
**Fix:** Change to `PUT /staff/:id/status` with `{ status: 'active' | 'inactive' }`.

---

### ISSUE-7b. Frontend call-log paths need updating (after library fix)

**Files:** `call-logger.ts`, `staff-dashboard.ts`
**Fix (after library moves CRUD to root):**
- `call-logs?dateStart=...&dateEnd=...` → `call-logs?from=...&to=...`
- Query params: `dateStart/dateEnd` → `from/to`
- `call-logs/user/:userId` → `call-logs?contactExternalId=:userId`
- `call-logs/daily-summary` → `call-logs/analytics/daily`

---

### ISSUE-8b. Angular widget uses wrong attribute name for socketUrl

**File:** `apps/wellness-pro/src/app/app.ts`, `apps/elite-spa/src/app/app.ts`
**Fix:** Change `[attr.socketUrl]` to `[attr.socket-url]` — the Lit property uses kebab-case attribute.
