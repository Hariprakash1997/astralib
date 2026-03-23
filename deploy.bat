@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  DEPLOY SCRIPT - @astralibx monorepo
REM
REM  HOW TO USE:
REM  1. Set COMMIT_MSG describing what changed
REM  2. Add packages to the correct section below (EMAIL, TELEGRAM, CHAT)
REM  3. Leave sections empty if no changes in that channel
REM  4. Run deploy.bat from repo root
REM  5. Merge the "Version Packages" PR on GitHub
REM
REM  RULES:
REM  - No special characters in COMMIT_MSG: no (), no --, no |
REM  - patch = bugfix/docs, minor = new features, major = breaking changes
REM  - See DEPLOYMENT.md for full guide
REM ============================================================

REM What changed? Plain English for consumers. Goes into CHANGELOG.md.
set "COMMIT_MSG=Fixes: settings.update type accepts availableChannels and availableOutcomes - staff hook params typed as IStaffSummary"

REM Default bump type when no :type suffix is given
set "DEFAULT_BUMP=patch"

REM ============================================================
REM  CORE - shared utilities used by all packages
REM  Only bump when core itself changes
REM ============================================================
set "CORE_PACKAGES="

REM ============================================================
REM  RULE ENGINE - packages/rule-engine/*
REM  rule-engine, rule-engine-ui
REM  Leave empty if no rule-engine changes: set "RULE_ENGINE_PACKAGES="
REM ============================================================
set "RULE_ENGINE_PACKAGES="

REM ============================================================
REM  EMAIL - packages/email/*
REM  email-account-manager, email-analytics, email-rule-engine, email-ui
REM  Leave empty if no email changes: set "EMAIL_PACKAGES="
REM ============================================================
set "EMAIL_PACKAGES="

REM ============================================================
REM  TELEGRAM - packages/telegram/*
REM  telegram-account-manager, telegram-rule-engine, telegram-inbox, telegram-bot, telegram-ui
REM  Leave empty if no telegram changes: set "TELEGRAM_PACKAGES="
REM ============================================================
set "TELEGRAM_PACKAGES="

REM ============================================================
REM  CHAT - packages/chat/*
REM  chat-types, chat-engine, chat-ai, chat-widget, chat-ui
REM  Leave empty if no chat changes: set "CHAT_PACKAGES="
REM ============================================================
set "CHAT_PACKAGES="

REM ============================================================
REM  CALL LOG - packages/call-log/*
REM  call-log-types, call-log-engine, call-log-ui
REM  Leave empty if no call-log changes: set "CALL_LOG_PACKAGES="
REM ============================================================
set "CALL_LOG_PACKAGES=call-log-engine:patch"

REM ============================================================
REM  STAFF - packages/staff/*
REM  staff-types, staff-engine, staff-ui
REM  Leave empty if no staff changes: set "STAFF_PACKAGES="
REM ============================================================
set "STAFF_PACKAGES=staff-types:patch"

REM ============================================================
REM  DO NOT EDIT BELOW THIS LINE
REM ============================================================

REM --- Merge all non-empty sections ---
set "PACKAGES="
if defined CORE_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!CORE_PACKAGES!"
    ) else (
        set "PACKAGES=!CORE_PACKAGES!"
    )
)
if defined RULE_ENGINE_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!RULE_ENGINE_PACKAGES!"
    ) else (
        set "PACKAGES=!RULE_ENGINE_PACKAGES!"
    )
)
if defined EMAIL_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!EMAIL_PACKAGES!"
    ) else (
        set "PACKAGES=!EMAIL_PACKAGES!"
    )
)
if defined TELEGRAM_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!TELEGRAM_PACKAGES!"
    ) else (
        set "PACKAGES=!TELEGRAM_PACKAGES!"
    )
)
if defined CHAT_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!CHAT_PACKAGES!"
    ) else (
        set "PACKAGES=!CHAT_PACKAGES!"
    )
)
if defined CALL_LOG_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!CALL_LOG_PACKAGES!"
    ) else (
        set "PACKAGES=!CALL_LOG_PACKAGES!"
    )
)
if defined STAFF_PACKAGES (
    if defined PACKAGES (
        set "PACKAGES=!PACKAGES!,!STAFF_PACKAGES!"
    ) else (
        set "PACKAGES=!STAFF_PACKAGES!"
    )
)

if not defined PACKAGES (
    echo [ERROR] No packages selected. Set at least one section above.
    exit /b 1
)

REM --- Resolve "all" shorthand ---
set "RAW_PACKAGES=%PACKAGES%"
for /f "tokens=1,2 delims=:" %%a in ("%RAW_PACKAGES%") do (
    if /i "%%a"=="all" (
        if "%%b"=="" (
            set "RAW_PACKAGES=core:%DEFAULT_BUMP%,rule-engine:%DEFAULT_BUMP%,rule-engine-ui:%DEFAULT_BUMP%,email-account-manager:%DEFAULT_BUMP%,email-analytics:%DEFAULT_BUMP%,email-rule-engine:%DEFAULT_BUMP%,email-ui:%DEFAULT_BUMP%,telegram-account-manager:%DEFAULT_BUMP%,telegram-rule-engine:%DEFAULT_BUMP%,telegram-inbox:%DEFAULT_BUMP%,telegram-bot:%DEFAULT_BUMP%,telegram-ui:%DEFAULT_BUMP%,chat-types:%DEFAULT_BUMP%,chat-engine:%DEFAULT_BUMP%,chat-ai:%DEFAULT_BUMP%,chat-widget:%DEFAULT_BUMP%,chat-ui:%DEFAULT_BUMP%,call-log-types:%DEFAULT_BUMP%,call-log-engine:%DEFAULT_BUMP%,call-log-ui:%DEFAULT_BUMP%,staff-types:%DEFAULT_BUMP%,staff-engine:%DEFAULT_BUMP%,staff-ui:%DEFAULT_BUMP%"
        ) else (
            set "RAW_PACKAGES=core:%%b,rule-engine:%%b,rule-engine-ui:%%b,email-account-manager:%%b,email-analytics:%%b,email-rule-engine:%%b,email-ui:%%b,telegram-account-manager:%%b,telegram-rule-engine:%%b,telegram-inbox:%%b,telegram-bot:%%b,telegram-ui:%%b,chat-types:%%b,chat-engine:%%b,chat-ai:%%b,chat-widget:%%b,chat-ui:%%b,call-log-types:%%b,call-log-engine:%%b,call-log-ui:%%b,staff-types:%%b,staff-engine:%%b,staff-ui:%%b"
        )
    )
)

REM --- Parse packages and bumps ---
set "PKG_COUNT=0"
set "PKG_DISPLAY="
set "COMMIT_PREFIX="
for %%e in (%RAW_PACKAGES%) do (
    set "ENTRY=%%e"
    set "PKG_NAME="
    set "PKG_BUMP="
    for /f "tokens=1,2 delims=:" %%a in ("%%e") do (
        set "PKG_NAME=%%a"
        if "%%b"=="" (
            set "PKG_BUMP=!DEFAULT_BUMP!"
        ) else (
            set "PKG_BUMP=%%b"
        )
    )
    set /a PKG_COUNT+=1
    if defined PKG_DISPLAY (
        set "PKG_DISPLAY=!PKG_DISPLAY!, @astralibx/!PKG_NAME!:!PKG_BUMP!"
    ) else (
        set "PKG_DISPLAY=@astralibx/!PKG_NAME!:!PKG_BUMP!"
    )
    REM Track highest bump for commit prefix
    if /i "!PKG_BUMP!"=="major" set "COMMIT_PREFIX=major"
    if /i "!PKG_BUMP!"=="minor" if not "!COMMIT_PREFIX!"=="major" set "COMMIT_PREFIX=minor"
    if /i "!PKG_BUMP!"=="patch" if not "!COMMIT_PREFIX!"=="major" if not "!COMMIT_PREFIX!"=="minor" set "COMMIT_PREFIX=patch"
)

echo.
echo  ========================================
echo   @astralibx Deploy Pipeline
echo  ========================================
echo   Packages: !PKG_DISPLAY!
echo   Count:    %PKG_COUNT% package(s)
echo   Message:  %COMMIT_MSG%
echo  ========================================
echo.

REM --- Confirm before proceeding ---
set /p "CONFIRM=Proceed? (Y/n): "
if /i "%CONFIRM%"=="n" (
    echo [CANCELLED] Deploy aborted.
    exit /b 0
)

REM --- Step 1: Verify we're on main branch ---
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if not "%BRANCH%"=="main" (
    echo [ERROR] You must be on the main branch. Currently on: %BRANCH%
    echo Run: git checkout main
    exit /b 1
)

REM --- Step 2: Create changeset file ---
echo [1/7] Creating changeset...
set "CHANGESET_DIR=.changeset"
set "TIMESTAMP=%date:~-4%%date:~-7,2%%date:~-10,2%%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "CHANGESET_FILE=%CHANGESET_DIR%\deploy-%TIMESTAMP%.md"

(
echo ---
for %%e in (%RAW_PACKAGES%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%e") do (
        if "%%b"=="" (
            echo "@astralibx/%%a": %DEFAULT_BUMP%
        ) else (
            echo "@astralibx/%%a": %%b
        )
    )
)
echo ---
echo.
echo %COMMIT_MSG%
) > "%CHANGESET_FILE%"

echo    Created: %CHANGESET_FILE%

REM --- Step 3: Stage specific files ---
echo [2/7] Staging changes...
git add . 2>nul

REM --- Step 4: Commit locally first (before pull) ---
echo [3/7] Committing...
git commit -m "%COMMIT_PREFIX%: %COMMIT_MSG%"
if errorlevel 1 (
    echo [ERROR] Commit failed. Check if there are changes to commit.
    exit /b 1
)

REM --- Step 5: Pull + rebase (now safe since working tree is clean) ---
echo [4/7] Pulling latest from main...
git pull origin main --rebase
if errorlevel 1 (
    echo [ERROR] Rebase conflict. Run: git rebase --abort   then fix manually.
    exit /b 1
)

REM --- Step 6: Push to main ---
echo [5/7] Pushing to main...
git push origin main
if errorlevel 1 (
    echo [ERROR] Push failed.
    exit /b 1
)

echo [6/7] Done!
echo.
echo  ========================================
echo   PUSHED TO MAIN
echo  ========================================
echo.
echo   What happens next (automated):
echo   1. GitHub Actions runs CI (build + test)
echo   2. Changesets bot creates "Version Packages" PR
echo   3. Go to GitHub and MERGE that PR
echo   4. Package auto-publishes to npm
echo.
echo   Monitor: https://github.com/Hariprakash1997/astralib/actions
echo  ========================================

endlocal
