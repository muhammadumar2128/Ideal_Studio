@echo off
title Sync Counter PC Hardware Power Time
echo Syncing Counter PC Boot, Shutdown, and Attendance to Supabase...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0counter_pc_agent.ps1" -Action sync-once
echo.
pause
