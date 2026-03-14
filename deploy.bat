@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  DEPLOY SCRIPT — @astralibx monorepo
REM  Edit these 3 values before each run, then execute deploy.bat
REM ============================================================

REM What changed? (used for commit message and changeset summary)
set "COMMIT_MSG=fix doc links to use absolute GitHub URLs in README"

REM Bump type: patch (bug fix), minor (new feature), major (breaking change)
set "BUMP_TYPE=patch"

REM Which package to publish? (folder name under packages/)
set "PACKAGE=email-rule-engine"

REM ============================================================
REM  DO NOT EDIT BELOW THIS LINE
REM ============================================================

echo.
echo  ========================================
echo   @astralibx Deploy Pipeline
echo  ========================================
echo   Package:  @astralibx/%PACKAGE%
echo   Bump:     %BUMP_TYPE%
echo   Message:  %COMMIT_MSG%
echo  ========================================
echo.

REM --- Step 1: Verify we're on main branch ---
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if not "%BRANCH%"=="main" (
    echo [ERROR] You must be on the main branch. Currently on: %BRANCH%
    echo Run: git checkout main
    exit /b 1
)

REM --- Step 2: Pull latest ---
echo [1/6] Pulling latest from main...
git pull origin main
if errorlevel 1 (
    echo [ERROR] Failed to pull. Resolve conflicts first.
    exit /b 1
)

REM --- Step 3: Create changeset file ---
echo [2/6] Creating changeset...
set "CHANGESET_DIR=.changeset"
set "TIMESTAMP=%date:~-4%%date:~-7,2%%date:~-10,2%%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "CHANGESET_FILE=%CHANGESET_DIR%\deploy-%TIMESTAMP%.md"

(
echo ---
echo "@astralibx/%PACKAGE%": %BUMP_TYPE%
echo ---
echo.
echo %COMMIT_MSG%
) > "%CHANGESET_FILE%"

echo    Created: %CHANGESET_FILE%

REM --- Step 4: Stage all changes ---
echo [3/6] Staging changes...
git add -A

REM --- Step 5: Commit ---
echo [4/6] Committing...
git commit -m "%BUMP_TYPE%(%PACKAGE%): %COMMIT_MSG%"
if errorlevel 1 (
    echo [ERROR] Commit failed. Check if there are changes to commit.
    exit /b 1
)

REM --- Step 6: Push to main ---
echo [5/6] Pushing to main...
git push origin main
if errorlevel 1 (
    echo [ERROR] Push failed.
    exit /b 1
)

echo [6/6] Done!
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
