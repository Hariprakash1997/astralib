@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  DEPLOY SCRIPT — @astralibx monorepo
REM  Edit these 3 values before each run, then execute deploy.bat
REM ============================================================

REM What changed? (used for commit message and changeset summary)
set "COMMIT_MSG=add delete, metadata editor, Gmail auto-fill, template variants, list-mode rules, validity dates, run trigger/cancel, compact density mode"

REM Default bump type: used when package has no :type suffix
set "DEFAULT_BUMP=patch"

REM Which packages? Comma-separated, with optional :bump suffix per package
REM Format: name:bump  (bump = patch | minor | major)
REM If no :bump suffix, DEFAULT_BUMP is used
REM Examples:
REM   email-rule-engine:major,email-account-manager:minor,email-analytics:patch
REM   email-rule-engine,core              (both use DEFAULT_BUMP)
REM   all                                 (all packages use DEFAULT_BUMP)
REM   all:minor                           (all packages use minor)
set "PACKAGES=email-ui:minor"

REM ============================================================
REM  DO NOT EDIT BELOW THIS LINE
REM ============================================================

REM --- Resolve "all" shorthand ---
set "RAW_PACKAGES=%PACKAGES%"
for /f "tokens=1,2 delims=:" %%a in ("%RAW_PACKAGES%") do (
    if /i "%%a"=="all" (
        if "%%b"=="" (
            set "RAW_PACKAGES=core:%DEFAULT_BUMP%,email-rule-engine:%DEFAULT_BUMP%,email-account-manager:%DEFAULT_BUMP%,email-analytics:%DEFAULT_BUMP%,email-ui:%DEFAULT_BUMP%"
        ) else (
            set "RAW_PACKAGES=core:%%b,email-rule-engine:%%b,email-account-manager:%%b,email-analytics:%%b,email-ui:%%b"
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
