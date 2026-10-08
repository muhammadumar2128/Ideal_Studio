@echo off
title Install Ideal Studio Counter PC Tracker
echo =====================================================================
echo  Ideal Photo Studio — Authorized Counter PC Power & Attendance Setup
echo  Shop # 45, Post Office Market HIT, Taxila Cantt
echo =====================================================================
echo.
echo Installing silent background power tracker for Authorized Counter PC...
echo.

set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%counter_pc_agent.ps1
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set LAUNCHER_BAT=%STARTUP_DIR%\IdealStudio_CounterPC_Tracker.vbs

if not exist "%PS_SCRIPT%" (
    echo [ERROR] Could not find counter_pc_agent.ps1 in %SCRIPT_DIR%
    pause
    exit /b 1
)

:: Create a VBS launcher in Startup so it runs completely hidden without any CMD window popping up
echo Set WshShell = CreateObject("WScript.Shell") > "%LAUNCHER_BAT%"
echo WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & "%PS_SCRIPT%" & """", 0, False >> "%LAUNCHER_BAT%"

echo [SUCCESS] Counter PC Tracker registered in Windows Startup folder!
echo Startup file created: %LAUNCHER_BAT%
echo.
echo Running first initial power sync to Supabase...
powershell.exe -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Action sync-once
echo.
echo =====================================================================
echo  Installation Complete!
echo  From now on, whenever this Counter PC powers on:
echo  1. Exact morning turn-on time is recorded to the cloud.
echo  2. Alex Sotra's attendance is stamped with the real PC boot time.
echo  3. Evening shutdown (9:30 PM) is captured for the Admin Dashboard.
echo  4. Midday light shortages (load shedding) are safely ignored.
echo =====================================================================
echo.
pause
