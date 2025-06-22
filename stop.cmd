@echo off
setlocal enabledelayedexpansion

echo ===== MatchmakingService Shutdown =====

:: Initialize counters
set frontend_stopped=0
set backend_stopped=0
set total_stopped=0

:: Create temp files for process detection
set temp_netstat=%TEMP%\ms_netstat.txt
set temp_tasklist=%TEMP%\ms_tasklist.txt

:: Get current network connections
netstat -ano > "%temp_netstat%" 2>nul

:: Function to kill process by PID with error handling
goto :main

:kill_process
set target_pid=%~1
set service_name=%~2
if defined target_pid if not "%target_pid%"=="0" (
    echo Stopping %service_name% ^(PID: %target_pid%^)...
    taskkill /F /PID %target_pid% >nul 2>nul
    if !errorlevel! equ 0 (
        echo %service_name% stopped successfully
        set /a total_stopped+=1
        exit /b 0
    ) else (
        echo Warning: Failed to stop %service_name%
        exit /b 1
    )
)
exit /b 1

:main

:: Check for backend services on port 3000
echo Checking for backend services on port 3000...
findstr ":3000" "%temp_netstat%" | findstr "LISTENING" > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "tokens=5" %%a in (%temp_tasklist%) do (
        if not "%%a"=="0" (
            call :kill_process "%%a" "Backend server"
            if !errorlevel! equ 0 set /a backend_stopped+=1
        )
    )
) else (
    echo No backend services found on port 3000
)

:: Check for backend services on port 3002
echo Checking for backend services on port 3002...
findstr ":3002" "%temp_netstat%" | findstr "LISTENING" > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "tokens=5" %%a in (%temp_tasklist%) do (
        if not "%%a"=="0" (
            call :kill_process "%%a" "Backend server alt"
            if !errorlevel! equ 0 set /a backend_stopped+=1
        )
    )
)

:: Check for frontend services on port 3001
echo Checking for frontend services on port 3001...
findstr ":3001" "%temp_netstat%" | findstr "LISTENING" > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "tokens=5" %%a in (%temp_tasklist%) do (
        if not "%%a"=="0" (
            call :kill_process "%%a" "Frontend server"
            if !errorlevel! equ 0 set /a frontend_stopped+=1
        )
    )
)

:: Check for frontend services on port 3006
echo Checking for frontend services on port 3006...
findstr ":3006" "%temp_netstat%" | findstr "LISTENING" > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "tokens=5" %%a in (%temp_tasklist%) do (
        if not "%%a"=="0" (
            call :kill_process "%%a" "Frontend server alt"
            if !errorlevel! equ 0 set /a frontend_stopped+=1
        )
    )
)

:: Try to kill by process name patterns
echo Checking for Node.js processes with MatchmakingService...
tasklist /fi "imagename eq node.exe" /fo csv > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "skip=1 tokens=2 delims=," %%a in (%temp_tasklist%) do (
        set node_pid=%%a
        set node_pid=!node_pid:"=!
        :: Check if this PID is using our ports
        findstr "!node_pid!" "%temp_netstat%" | findstr ":300" >nul 2>nul
        if !errorlevel! equ 0 (
            call :kill_process "!node_pid!" "Node.js process"
            if !errorlevel! equ 0 set /a backend_stopped+=1
        )
    )
)

:: Kill by window title - safer approach
echo Checking for services by window title...
wmic process where "Name='cmd.exe' and CommandLine like '%%MatchmakingService Backend%%'" get ProcessId /value > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "tokens=2 delims==" %%a in ('findstr "ProcessId" "%temp_tasklist%" 2^>nul') do (
        if not "%%a"=="" (
            call :kill_process "%%a" "Backend window"
            if !errorlevel! equ 0 set /a backend_stopped+=1
        )
    )
)

wmic process where "Name='cmd.exe' and CommandLine like '%%MatchmakingService Frontend%%'" get ProcessId /value > "%temp_tasklist%" 2>nul
if exist "%temp_tasklist%" (
    for /f "tokens=2 delims==" %%a in ('findstr "ProcessId" "%temp_tasklist%" 2^>nul') do (
        if not "%%a"=="" (
            call :kill_process "%%a" "Frontend window"
            if !errorlevel! equ 0 set /a frontend_stopped+=1
        )
    )
)

:: Clean up temp files
if exist "%temp_netstat%" del "%temp_netstat%" 2>nul
if exist "%temp_tasklist%" del "%temp_tasklist%" 2>nul

:: Final report
echo.
echo ===== Shutdown Summary =====
if !frontend_stopped! gtr 0 (
    echo Frontend services stopped: !frontend_stopped!
) else (
    echo No frontend services were running
)

if !backend_stopped! gtr 0 (
    echo Backend services stopped: !backend_stopped!
) else (
    echo No backend services were running
)

if !total_stopped! gtr 0 (
    echo Total processes stopped: !total_stopped!
    echo All MatchmakingService components have been shut down
) else (
    echo No MatchmakingService processes were found running
)

echo Cleanup complete
exit /b 0