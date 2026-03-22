# @astralibx Migration Analysis: Chat, Call-Log & Staff Management

**Date:** 2026-03-22
**Goal:** Move chat, call-log, and staff management to @astralibx so consuming projects install + configure and everything works.
**Approach:** Local massage-website becomes the first consumer. All operational logic lives in the library.

---

## Package Inventory

| Package | Exists? | Sub-packages | Status |
|---------|---------|-------------|--------|
| `chat` | Yes | chat-engine, chat-types, chat-ai, chat-widget, chat-ui | Has gaps vs local reference |
| `call-log` | Yes | call-log-engine, call-log-types, call-log-ui | Has gaps vs local reference |
| `staff` | **NO** | — | **Needs to be created** |

---

## 1. STAFF MANAGEMENT — New Package Required

### What exists locally (massage-website reference)

**Backend (6 endpoints):**
- Staff CRUD (create, list, update) — owner-only access
- Password reset, activate/deactivate
- JWT auth with different expiry (24h staff, 30d owner)
- `requirePermission(...permissions)` middleware
- `ownerOnly` middleware
- IP-based login rate limiter (5 attempts/15 min)

**Permission system:**
- 27 string-based permission keys in 6 groups
- View/Edit pairs with cascading (`:edit` auto-includes `:view`)
- Permission groups for UI organization
- Route guards (authGuard, permissionGuard, ownerGuard)

**Frontend:**
- Staff list with status, permissions count, last login
- Staff create form with permission picker
- Edit permissions modal with select-all/clear-all
- Password reset modal
- Status toggle (activate/deactivate)

### Proposed: `@astralibx/staff-engine`

```
packages/staff/
├── staff-engine/        # Backend: auth, CRUD, permissions middleware
├── staff-types/         # Shared types & enums
└── staff-ui/            # Lit web components for admin UI
```

**Factory pattern (matching chat-engine and call-log-engine):**
```ts
const engine = createStaffEngine({
  db: { connection, collectionPrefix: '' },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    staffTokenExpiry: '24h',
    ownerTokenExpiry: '30d',
    rateLimiter: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  },
  adapters: {
    hashPassword: async (password) => bcrypt.hash(password, 10),
    comparePassword: async (plain, hash) => bcrypt.compare(plain, hash),
    generateStaffDefaults: () => ({ status: 'verified' }),
    onStaffCreated: async (staff) => { /* notify, audit log */ },
  },
  hooks: {
    onLogin: (staff) => {},
    onLoginFailed: (email, ip) => {},
    onPermissionsChanged: (staffId, oldPerms, newPerms) => {},
    onStatusChanged: (staffId, oldStatus, newStatus) => {},
    onMetric: (metric) => {},
  },
  options: {
    allowSelfPasswordChange: false,
    requireEmailUniqueness: true,
  },
});

// Returns:
// engine.routes      → Express router (mount at /api/staff)
// engine.auth        → { verifyToken, requirePermission, ownerOnly } middleware
// engine.staff       → StaffService (CRUD)
// engine.models      → { Staff } mongoose models
```

**What the consuming project provides:**
- Password hashing implementation (adapter)
- Staff default values (city, platform, etc.)
- JWT secret
- Hooks for notifications/audit

**What the library handles:**
- Staff schema (name, email, password, status, permissions[], lastLoginAt)
- **PermissionGroup schema** (admin-configurable groups with keys and labels, stored in DB)
- Permission CRUD API (admin creates/edits/deletes permission groups at runtime)
- JWT token generation & verification
- Permission checking middleware (enforces whatever admin configured)
- View/Edit cascading logic (`:edit` auto-requires `:view`)
- Owner-only middleware
- Rate limiting
- Staff CRUD with validation
- UI components (staff list, permission picker, permission group editor, create form)

### Finalized Decisions

1. **Own collection.** Library creates and owns a `staff` collection. Consuming project links via `externalUserId` if needed. No adapter-to-existing-user-model pattern.

2. **Permission keys are admin-configurable at runtime.** Library provides:
   - `PermissionGroup` schema in DB (admin can CRUD permission groups via API/UI)
   - `requirePermission(...keys)` middleware that checks against staff's stored permissions
   - View/Edit cascading logic built-in
   - UI components for permission group management
   - No hardcoded permission keys — library enforces whatever the admin configures

3. **Staff-engine is the identity source of truth.** Chat-engine and call-log-engine read staff identity via their existing `authenticateAgent`/`resolveAgent` adapters, wired to staff-engine at setup time.

---

## 2. CHAT ENGINE — Gap Analysis

### Features in local that astralib chat-engine ALREADY has

| Feature | Local | Astralib | Notes |
|---------|-------|----------|-------|
| Socket.IO visitor/agent namespaces | Yes | Yes | Same pattern |
| Session lifecycle (new→active→resolved) | Yes | Yes | Same statuses |
| AI/Manual mode toggle | Yes | Yes | Same concept |
| Agent takeover/handback | Yes | Yes | Same flow |
| Typing indicators | Yes | Yes | Bidirectional |
| Message status (sent→delivered→read) | Yes | Yes | Same pipeline |
| Pending messages (offline queue) | Yes | Yes | Same concept |
| Agent capacity management | Yes | Yes | maxConcurrentChats |
| Session timeout worker | Yes | Yes | Same concept |
| Auto-away worker | No | Yes | Astralib extra |
| FAQ system | No | Yes | Astralib extra |
| Canned responses | No | Yes | Astralib extra |
| Guided questions | No | Yes | Astralib extra |
| Agent transfers | No | Yes | Astralib extra |
| Rating/feedback | No | Yes | Astralib extra |
| Webhooks | No | Yes | Astralib extra |
| File uploads | No | Yes | Astralib extra |
| Business hours | No | Yes | Astralib extra |
| Widget config API | No | Yes | Astralib extra |
| Multi-tenancy | No | Yes | Astralib extra |

### Features in local that astralib DOESN'T have (GAPS)

> **Verified 2026-03-22:** Each gap was checked against the actual codebase. 8 of the original 16 gaps were false — features already exist in chat-engine/chat-ai.

#### Already exists in astralib (FALSE GAPS — removed from plan)

| # | Feature | Where it exists | Evidence |
|---|---------|----------------|----------|
| G2 | ~~AI message debouncing~~ | `gateway/ai-debounce.ts` | `scheduleAiResponse()`/`resetAiDebounce()`, configurable `aiDebounceMs` (default 15s) |
| G3 | ~~Realistic typing delays~~ | `gateway/ai-debounce.ts` | `calculateDeliveryDelay()`, `calculateReadDelay()`, `calculatePreTypingDelay()`, `calculateBubbleDelay()` + full `aiSimulation` config |
| G4 | ~~Multi-bubble AI responses~~ | `gateway/ai-debounce.ts` | Loops over `output.messages[]` array with inter-bubble delays (lines 237-276) |
| G5 | ~~Conversation summarization~~ | Session schema + service + ai-debounce | `conversationSummary` field on session, `updateConversationSummary()` method, AI handler auto-updates after each response |
| G10 | ~~Support person discovery~~ | `gateway/visitor.handler.ts` | `FetchSupportPersons` + `SetPreferredAgent` socket events, `visitorAgentSelection` setting |
| G11 | ~~Agent-initiated AI messages~~ | `gateway/agent.handler.ts` | `SendAiMessage` socket handler (lines 649-719) with AI character resolution + multi-bubble delivery |
| G13 | ~~Dashboard real-time stats~~ | `services/session.service.ts` + `gateway/agent.handler.ts` | `getDashboardStats()` + `broadcastStatsUpdate()` called after every significant event, REST route at `GET /stats` |
| G14 | ~~AI escalation auto-trigger~~ | `gateway/ai-debounce.ts` + `chat-ai/types/prompt.types.ts` | `shouldEscalate` + `escalationReason` in `ParsedAIResponse`, auto-escalation logic built-in |

#### Partial gaps — Small additions needed

| # | Feature | What exists | What to add | Suggested Approach |
|---|---------|------------|-------------|-------------------|
| G1 | **AI persona — make flexible** | `IAiCharacterProfile` with name, tone, personality, rules, responseStyle — all currently required | Most fields should be optional. Missing `formality`, `emojiUsage`, `expertise`, `bio`. | **Refactor:** Only `name`, `tone`, `personality` stay required. Make `responseStyle`, `rules` optional. Add new optional fields: `formality`, `emojiUsage`, `expertise`, `bio`. UI: progressive disclosure — show 3 core fields always, optional fields appear via "Add [field]" buttons, removable once added. Update schema, validation, agent schema, and UI component. |
| G6 | **Data extraction from conversation** | `userInfo` schema on session (name, email, mobile) + `updateUserInfo()` service method | No automatic extraction adapter/hook | Add adapter `extractContactData(messages) → { phone?, email?, name? }` + hook `onContactDataExtracted`. Engine calls after AI response, stores via existing `updateUserInfo()` |
| G7 | **AI training quality labels** | `trainingQuality` enum (good/bad/needs_review), `LabelMessage`/`LabelSession` socket handlers, `labelingEnabled` config flag | Missing `trainingNotes` text field | Add `trainingNotes` string field to message schema. Config: `options.labelingEnabled: false` (opt-in) |
| G8 | **Request lifecycle logging** | `onAiRequest` hook with received/completed/failed stages + `durationMs` tracking | Missing granular mid-stages (aiCheck, aiCall, deliver) | Add intermediate stage emissions in ai-debounce handler. Config: `options.verboseAiLifecycle: false` (opt-in) |
| G9 | **Message visibility window** | `visibleUntil` on session schema | Missing message-level `visibleUntil` + retention config | Add `visibleUntil` to message schema. Config: `options.messageRetention: { enabled: false, defaultVisibilityDays: 90 }` (opt-in) |

#### Actual gaps — Need to build

| # | Feature | Local Location | Impact | Suggested Approach |
|---|---------|---------------|--------|-------------------|
| G12 | **Platform/tenant-aware agent assignment** | agent.service.ts | Multi-site | Add `platforms[]` field to ChatAgent schema. Assignment adapter receives platform context. |
| G15 | **Consecutive inappropriate message tracking** | ai-chat.service.ts | Safety | Counter per session, configurable threshold. Config: `options.inappropriateMessageTracking: { enabled: false, threshold: 3 }` (opt-in) |
| G16 | **AI health check endpoint** | ai-chat.service.ts | Operations | `GET /health/ai` tests AI backend availability via adapter ping |

### What stays as ADAPTERS (project-specific, NOT in library)

| Feature | Why adapter | Adapter signature |
|---------|-------------|-------------------|
| WebIdentifier fingerprinting | Tracking mechanism is project-specific | `identifyVisitor(visitorContext) → identity` (already exists) |
| Contact hub sync | CRM is project-specific | `onContactDataExtracted(sessionId, data)` hook |
| be-ai service integration | AI provider is project-specific | `generateAiResponse(input) → output` (already exists) |
| Therapist/massage preferences | Domain-specific | `enrichSessionContext(context) → enrichedContext` (already exists) |
| Platform routing (w1/w2) | Business-specific | Via `tenantId` in multi-tenancy config |

---

## 3. CALL-LOG ENGINE — Gap Analysis

### Core Architectural Difference

| Aspect | Local (massage-website) | Astralib |
|--------|------------------------|----------|
| **Model** | Outcome-driven (flat: log → outcome) | Pipeline-driven (stages: lead → contacted → converted) |
| **Call types** | `outbound, inbound, followup` | `inbound, outbound` (direction enum) |
| **Outcomes** | `interested, subscribed, not_interested, undecided, complaint, info_request` | No outcome concept — uses pipeline stages instead |
| **Contact ref** | Direct `userId` (ObjectId to WUser) | `contactRef` (externalId + name + phone + email) |
| **Notes** | Single text field | Structured timeline with typed entries |
| **Analytics** | Built-in (5 aggregations) | Service-level, consumer extends |
| **Follow-ups** | Manual query endpoint | Background worker with notification tracking |

### Features in local that astralib ALREADY covers

| Feature | Notes |
|---------|-------|
| Call CRUD | Yes — create, list, update, close |
| Follow-up tracking | Yes — with background worker (better than local) |
| Agent/staff assignment | Yes — agentId field |
| Duration tracking | Yes — durationMinutes |
| Timeline/notes | Yes — structured timeline (better than local's text field) |
| Export | Yes — JSON/CSV (local doesn't have this) |
| Settings | Yes — configurable (local doesn't have this) |

### Gaps — Features to ADD to astralib call-log-engine

| # | Feature | Local has | Astralib needs | Suggested approach |
|---|---------|-----------|---------------|-------------------|
| CG1 | **Call channel enum** | `phone, whatsapp, telegram, in_app_chat` | No channel concept | Add `channel` field to call-log schema. Configurable enum via settings or adapter. |
| CG2 | **Call outcome tracking** | 6 outcomes (interested, subscribed, etc.) | Pipeline stages only | **DECIDED: Option A** — Add `outcome` field alongside pipeline stages. Outcome = result of THIS call. Stage = position in overall funnel. Outcome values are admin-configurable via settings. |
| CG3 | **Built-in analytics aggregations** | 5 aggregation endpoints | Analytics service exists (`getDashboardStats`, `getWeeklyTrends`, `getAgentPerformance`) but missing these aggregations | **DECIDED: Built-in.** Extend existing analytics service with: daily volume, outcome distribution, follow-up compliance, contact reach. Expose via new routes. Not building from scratch — adding to existing service. |
| CG4 | **Daily summary endpoint** | Per-staff daily aggregation | Not built-in | Add `GET /analytics/daily-summary?date=` route returning per-agent breakdown. Wire into existing analytics service. |
| CG5 | **Contact search adapter** | `/users/search` with regex | `lookupContact` exists but no search route | Add `GET /contacts/search` route that delegates to `lookupContact` adapter with search query. |
| CG6 | **Staff-scoped auto-filtering** | Staff sees own calls only | No built-in role check | Add `options.enableAgentScoping: true` — when enabled, list queries auto-filter by authenticated agent's ID unless they have a "view_all" permission. |
| CG7 | **Soft delete** | `isDeleted` boolean | Uses `isClosed` only | Add `isDeleted` + `deletedAt` fields. Soft delete route. Filter deleted from queries by default. |
| CG8 | **Call type (followup)** | `outbound, inbound, followup` | `inbound, outbound` only | Add `followup` to CallDirection enum, or add separate `isFollowUp: boolean` flag. **Recommendation:** Separate boolean — a follow-up can be inbound or outbound. |

### What stays as ADAPTERS

| Feature | Why adapter |
|---------|-------------|
| User lookup from massage DB | `lookupContact` adapter — project provides DB query |
| User search | `lookupContact` adapter with search mode |
| Enrichment with user name/mobile | `resolveAgent` and contact adapter handle this |
| Platform field (w1/w2) | Use `tenantId` or `metadata` field |
| Outcome values | Admin-configurable via settings API — library provides the field + settings CRUD, admin defines values at runtime |

---

## 4. CROSS-PACKAGE INTEGRATION

### Agent/Staff Identity Flow (Proposed)

```
staff-engine (source of truth)
  ├── Staff document: { _id, name, email, permissions[], status }
  │
  ├──→ chat-engine (reads via adapter)
  │     └── ChatAgent: { adminUserId → Staff._id, displayName, capacity }
  │
  └──→ call-log-engine (reads via adapter)
        └── agentId → Staff._id, resolveAgent → { displayName }
```

**Current state:** chat-engine owns ChatAgent, call-log reads from it.
**Proposed:** staff-engine creates the identity. Chat and call-log consume it.

**Implementation:** Both chat-engine and call-log-engine already have `resolveAgent`/`authenticateAgent` adapters. Staff-engine provides the data source.

### Shared Database Connection

All three engines accept `{ connection, collectionPrefix }`. A consuming project can:
- Share one MongoDB connection across all engines
- Use collection prefixes for isolation
- Or use separate connections per engine

### Permission Integration

Staff-engine manages permissions. Chat-engine and call-log-engine check permissions via their `authenticateRequest` adapter:

```ts
// In consuming project setup:
const staffEngine = createStaffEngine({ ... });
const chatEngine = createChatEngine({
  adapters: {
    authenticateAgent: async (token) => {
      const staff = staffEngine.auth.verifyToken(token);
      if (!staff || !staff.permissions.includes('chat:view')) return null;
      return { adminUserId: staff._id, displayName: staff.name };
    },
  },
});
```

---

## 5. MIGRATION STRATEGY

### Phase 1: staff-engine (NEW — build first)

**Why first:** It's the identity foundation. Chat and call-log depend on it.

**Steps:**
1. Create `packages/staff/` in astralib monorepo
2. Build staff-engine: schema, auth middleware, CRUD, routes
3. Build staff-types: interfaces, enums
4. Build staff-ui: Lit web components (staff list, permission picker, create form)
5. Write tests (unit + integration)
6. Publish to npm

**Estimated scope:** ~2000 lines backend, ~800 lines types, ~1500 lines UI

### Phase 2: call-log-engine (PATCH — add missing features)

**Steps:**
1. Add `channel` field to schema (CG1)
2. Add `outcome` field to schema (CG2)
3. Add analytics routes (CG3, CG4)
4. Add contact search route (CG5)
5. Add agent-scoped filtering option (CG6)
6. Add soft delete (CG7)
7. Add `isFollowUp` flag (CG8)
8. Update call-log-types with new enums
9. Update call-log-ui with outcome display, analytics dashboard
10. Bump version, publish

**Estimated scope:** ~500 lines engine changes, ~200 lines types, ~800 lines UI

### Phase 3: chat-engine (PATCH — add missing features)

> **Revised 2026-03-22:** 8 of 13 original items were false gaps (G2-G5, G10-G11, G13-G14 already exist). Scope reduced by ~60%.

**Partial additions (small changes to existing features):**
1. Refactor AI persona: make `responseStyle`/`rules` optional, add optional `formality`/`emojiUsage`/`expertise`/`bio`, progressive disclosure UI (G1)
2. Add `extractContactData` adapter + `onContactDataExtracted` hook (G6)
3. Add `trainingNotes` field to message schema (G7)
4. Add granular AI lifecycle stages behind `verboseAiLifecycle` config (G8)
5. Add message-level `visibleUntil` + `messageRetention` config (G9)

**New features to build:**
6. Add `platforms[]` field to agent schema for platform-aware assignment (G12)
7. Add consecutive inappropriate message tracking with configurable threshold (G15)
8. Add `GET /health/ai` endpoint (G16)

9. Update chat-types with new fields
10. Bump version, publish

**Estimated scope:** ~500 lines engine changes, ~100 lines types (down from ~1500+300)

### Phase 4: massage-website migration (CONSUME)

**In a git worktree** (isolated from production):
1. Install updated @astralibx packages
2. Replace be-admin staff controller/routes → mount `staffEngine.routes`
3. Replace be-admin call-log controller/routes → mount `callLogEngine.routes`
4. Replace chat-backend → new Express app using `createChatEngine()`
5. Write adapters for: massage DB user lookup, contact hub sync, AI service
6. Write permission group definitions
7. Replace Angular components with Lit web component wrappers (or keep Angular UI calling new API)
8. Test thoroughly
9. Merge to main when stable

---

## 6. GIT WORKTREE — YES

**Strongly recommended for Phase 4 (massage-website migration).**

```bash
# Create worktree for migration work
git worktree add ../massage-website-astralib-migration feature/astralib-migration
```

Benefits:
- Production code untouched while migrating
- Can run both versions side-by-side for comparison
- Easy rollback — just delete the worktree
- Can cherry-pick proven changes back to main

**For astralib development (Phases 1-3):** Work directly in the astralib repo. No worktree needed there — it's library development with its own test suite.

---

## 7. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| Chat migration breaks real-time features | High | Thorough Socket.IO event testing. Run both backends in parallel during transition. |
| Call-log data migration | Medium | Write migration script for existing call_logs collection. Map flat outcomes → pipeline stages. |
| Staff auth breaks login | High | Test JWT flow end-to-end. Keep local auth as fallback until stable. |
| Lit web components in Angular | Low | Angular supports web components natively via `CUSTOM_ELEMENTS_SCHEMA`. |
| Breaking changes in library updates | Medium | Semantic versioning. MIGRATION.md for every breaking change (per existing concern in astralibx-library-concerns.md). |
| Performance regression | Medium | Benchmark queries. Ensure indexes match current performance. |

---

## 8. DECISIONS LOG (Finalized 2026-03-22)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| D1 | Staff collection | **Own collection** — library creates `staff` collection | Clean separation, no adapter complexity, `externalUserId` for linking |
| D2 | Outcome vs pipeline | **Separate `outcome` field** alongside pipeline stages | Outcome = this call's result, Stage = overall funnel position — different concepts |
| D3 | Chat widget | **Use astralib Lit chat-widget** — centralize, no Angular widget | No SSR needed. Single source of truth. No multi-place maintenance. |
| D4 | AI persona | **Flexible persona with progressive disclosure** | Only name/tone/personality required. All other fields (responseStyle, rules, formality, emojiUsage, expertise, bio) are optional — shown via "Add [field]" buttons in UI. Simple agents stay simple; advanced users add fields as needed. |
| D5 | Permission keys | **Admin-configurable at runtime** — library enforces, doesn't define | Admin creates permission groups via API/UI. Library stores in DB, enforces via middleware. No hardcoded keys. |
| D6 | Analytics | **Built-in routes** in call-log-engine and chat-engine | Consumers get analytics out of the box. No composition needed. |
| D7 | Everything in library | **Nothing stays local** — all operational logic in @astralibx | Consuming projects: install → configure adapters → done. Business logic only in consuming project. |
