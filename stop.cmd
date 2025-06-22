@echo off
setlocal enabledelayedexpansion

echo ===== MatchmakingService Shutdown =====

:: Initialize counters
set frontend_stopped=0
set backend_stopped=0

:: Find and kill frontend server process (usually on port 3006)
echo Checking for frontend services...
set found_frontend=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3006 2^>nul') do (
    if not "%%a"=="0" (
        set found_frontend=1
        echo Stopping frontend server (PID: %%a)...
        taskkill /F /PID %%a 2>nul
        if !errorlevel! equ 0 (
            echo Frontend server stopped successfully
            set /a frontend_stopped+=1
        )
    )
)
if !found_frontend! equ 0 echo No frontend services found running

:: Find and kill backend server process (usually on port 3000)
echo Checking for backend services...
set found_backend=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 2^>nul') do (
    if not "%%a"=="0" (
        set found_backend=1
        echo Stopping backend server (PID: %%a)...
        taskkill /F /PID %%a 2>nul
        if !errorlevel! equ 0 (
            echo Backend server stopped successfully
            set /a backend_stopped+=1
        )
    )
)
if !found_backend! equ 0 echo No backend services found running

:: Also try to kill by window title as a backup method
echo Checking for any remaining services by window title...
for /f "tokens=2" %%a in ('tasklist /fi "windowtitle eq MatchmakingService Backend" /fo list 2^>nul ^| find "PID:"') do (
    echo Stopping backend window (PID: %%a)...
    taskkill /F /PID %%a 2>nul
    if !errorlevel! equ 0 set /a backend_stopped+=1
)

for /f "tokens=2" %%a in ('tasklist /fi "windowtitle eq MatchmakingService Frontend" /fo list 2^>nul ^| find "PID:"') do (
    echo Stopping frontend window (PID: %%a)...
    taskkill /F /PID %%a 2>nul
    if !errorlevel! equ 0 set /a frontend_stopped+=1
)

:: Final report
if !frontend_stopped! gtr 0 echo Frontend services stopped: !frontend_stopped!
if !backend_stopped! gtr 0 echo Backend services stopped: !backend_stopped!
if !frontend_stopped! equ 0 if !backend_stopped! equ 0 echo No services were running

echo Cleanup complete
exit /b 0
