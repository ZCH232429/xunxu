@echo off
cd /d "%~dp0.."
if "%~1"=="--help" (
  echo Start: build_and_run.cmd
  echo Options: --web, --tunnel, --dev-client
  exit /b 0
)
if "%~1"=="--dev-client" (
  call npx expo start --dev-client
) else (
  call node script/sync-workbench.mjs
  call npx expo start --go %*
)
