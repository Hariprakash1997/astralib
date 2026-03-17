# Deployment Guide — @astralibx

## Quick Reference

```bat
REM 1. Edit deploy.bat — set COMMIT_MSG and PACKAGES
REM 2. Run deploy.bat
REM 3. Go to GitHub → merge the "Version Packages" PR
REM 4. npm auto-publishes
```

## deploy.bat Configuration

Before each deploy, edit these sections in `deploy.bat`:

### COMMIT_MSG

One message covering all changes across all channels. Goes into CHANGELOG.md on npm.

```bat
set "COMMIT_MSG=Features: email scheduling, telegram webhooks. Fixes: rule editor payload."
```

**Rules:**
- Write for **consumers**, not developers
- Lead with "Features:" or "Fixes:" or both
- No special characters: no parentheses `()`, no em dashes, no pipes `|`
- Keep under 200 characters

### Package Sections

deploy.bat has 4 sections. Set packages in the relevant section. Leave empty if no changes.

```bat
REM CORE - shared utilities
set "CORE_PACKAGES=core:minor"

REM EMAIL - packages/email/*
set "EMAIL_PACKAGES=email-account-manager:minor,email-rule-engine:patch"

REM TELEGRAM - packages/telegram/* (leave empty if no changes)
set "TELEGRAM_PACKAGES="

REM CHAT - packages/chat/* (leave empty if no changes)
set "CHAT_PACKAGES="
```

### Bump Type Rules

| Type | When to use |
|------|-------------|
| `patch` | Bug fixes, docs updates, internal refactors |
| `minor` | New features, new endpoints, new components, new fields |
| `major` | Breaking changes (renamed exports, removed methods, changed signatures) |

## Package Names (do not change)

| npm name | Folder |
|----------|--------|
| `@astralibx/core` | `packages/core` |
| `@astralibx/email-account-manager` | `packages/email/account-manager` |
| `@astralibx/email-analytics` | `packages/email/analytics` |
| `@astralibx/email-rule-engine` | `packages/email/rule-engine` |
| `@astralibx/email-ui` | `packages/email/ui` |
| `@astralibx/chat-types` | `packages/chat/chat-types` |
| `@astralibx/chat-engine` | `packages/chat/chat-engine` |
| `@astralibx/chat-ai` | `packages/chat/chat-ai` |
| `@astralibx/chat-widget` | `packages/chat/chat-widget` |
| `@astralibx/chat-ui` | `packages/chat/chat-ui` |
| `@astralibx/telegram-account-manager` | `packages/telegram/account-manager` |
| `@astralibx/telegram-rule-engine` | `packages/telegram/rule-engine` |
| `@astralibx/telegram-inbox` | `packages/telegram/inbox` |
| `@astralibx/telegram-bot` | `packages/telegram/bot` |
| `@astralibx/telegram-ui` | `packages/telegram/ui` |

Telegram packages are not yet published.

## Pipeline

```
deploy.bat
  → git add . && git commit
  → git pull --rebase
  → git push origin main
  → GitHub Actions runs CI (build + test)
  → Changesets bot creates "Version Packages" PR
  → You MERGE that PR on GitHub
  → GitHub Actions publishes to npm
```

## Important Rules

1. **Always run deploy.bat from repo root** (`D:\Codes\astralib\`)
2. **Always be on main branch** — deploy.bat checks this
3. **Never use special characters in COMMIT_MSG** — cmd.exe can't handle `()`, `—`, `|`
4. **One deploy.bat for all packages** — do not create separate deploy scripts per channel
5. **One CI workflow for all packages** — turbo handles package resolution
6. **Test before deploying** — run `npx vitest run` in each changed package
7. **Review before deploying** — check git diff, verify no sensitive data (tokens, passwords)
8. **After deploy, merge the "Version Packages" PR on GitHub** — this triggers npm publish
9. **Monitor publish** at https://github.com/Hariprakash1997/astralib/actions
10. **Close related GitHub issues after verifying** — use `close-issues.bat`

## Excluding Packages from CI

If a package has build errors and blocks CI, exclude it in `.github/workflows/publish.yml`:

```yaml
run: npx turbo run build --filter='!@astralibx/telegram-*'
```

Better long-term fix: set `"private": true` in that package's `package.json` — turbo and changesets skip private packages automatically.

## Redis Key Prefix Warning

When deploying to servers with shared Redis, every project MUST set unique `keyPrefix`:

```typescript
redis: { connection: redis, keyPrefix: 'myproject:' }
```

Without this, BullMQ queues and run locks collide between projects. See package READMEs for details.

## Rollback

If a bad version is published:
1. `npm unpublish @astralibx/package@version` (within 72 hours)
2. Or publish a patch fix immediately

Never force-push main or rewrite git history.
