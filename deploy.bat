@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  DEPLOY SCRIPT — @astralibx monorepo
REM  Edit these 3 values before each run, then execute deploy.bat
REM ============================================================

REM What changed? (used for commit message and changeset summary)
set "COMMIT_MSG=fix CI publish by removing prepublishOnly, update root README"

REM Bump type: patch (bug fix), minor (new feature), major (breaking change)
set "BUMP_TYPE=patch"

REM Which packages? Comma-separated folder names, or "all" for everything
REM Examples: email-rule-engine | email-rule-engine,core | all
set "PACKAGES=email-account-manager,email-rule-engine"

REM ============================================================
REM  DO NOT EDIT BELOW THIS LINE
REM ============================================================

REM --- Resolve package list ---
if /i "%PACKAGES%"=="all" (
    set "PKG_LIST=core,email-rule-engine,email-account-manager,email-analytics,email-ui"
) else (
    set "PKG_LIST=%PACKAGES%"
)

REM --- Count packages ---
set "PKG_COUNT=0"
set "PKG_DISPLAY="
for %%p in (%PKG_LIST%) do (
    set /a PKG_COUNT+=1
    if defined PKG_DISPLAY (
        set "PKG_DISPLAY=!PKG_DISPLAY!, @astralibx/%%p"
    ) else (
        set "PKG_DISPLAY=@astralibx/%%p"
    )
)

echo.
echo  ========================================
echo   @astralibx Deploy Pipeline
echo  ========================================
echo   Packages: !PKG_DISPLAY!
echo   Count:    %PKG_COUNT% package(s)
echo   Bump:     %BUMP_TYPE%
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
for %%p in (%PKG_LIST%) do (
    echo "@astralibx/%%p": %BUMP_TYPE%
)
echo ---
echo.
echo %COMMIT_MSG%
) > "%CHANGESET_FILE%"

echo    Created: %CHANGESET_FILE%

REM --- Step 3: Stage specific files ---
echo [2/7] Staging changes...
git add .changeset\ packages\ package.json package-lock.json .gitignore .prettierrc eslint.config.mjs CONTRIBUTING.md README.md deploy.bat turbo.json tsconfig.base.json 2>nul

REM --- Step 4: Commit locally first (before pull) ---
echo [3/7] Committing...
git commit -m "%BUMP_TYPE%: %COMMIT_MSG%"
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
