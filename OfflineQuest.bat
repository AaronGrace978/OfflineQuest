@echo off
title OfflineQuest Launcher
cd /d "%~dp0"

echo ============================================
echo            OfflineQuest  ^|  Nature Quests
echo ============================================
echo.

REM --- Make sure dependencies are installed ---
if not exist "node_modules" (
    echo [setup] First run detected - installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo [error] npm install failed. Is Node.js installed? https://nodejs.org
        pause
        exit /b 1
    )
    echo.
)

echo [info] Starting OfflineQuest...
echo [info] Open on this PC:  http://localhost:5173
echo [info] Open on your phone: use the "Network" address shown below
echo        (phone must be on the same Wi-Fi^).
echo.
echo Close this window to stop the app.
echo --------------------------------------------
echo.

REM --- Open the browser shortly after the server boots ---
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:5173"

REM --- Run dev server exposed to the local network ---
call npm run dev -- --host

pause
