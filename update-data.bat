@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Yakyu Techo - Update CPBL data
echo ============================================
echo.

node scripts\fetch-cpbl.mjs
echo.

git add public\data
git diff --cached --quiet
if %errorlevel%==0 (
  echo No changes - data is already up to date.
) else (
  git commit -m "chore: manual CPBL data refresh"
  git push
  echo.
  echo Done! Site will redeploy automatically in about a minute.
)

echo.
if /i "%~1"=="auto" exit /b
pause
