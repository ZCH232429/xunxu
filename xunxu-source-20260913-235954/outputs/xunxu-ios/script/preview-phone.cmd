@echo off
cd /d "%~dp0.."
echo Keep this window open while previewing on your iPhone.
call node script/sync-workbench.mjs
if errorlevel 1 exit /b 1
call npx expo start --go --tunnel
if errorlevel 1 pause
