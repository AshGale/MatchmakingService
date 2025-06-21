@echo off
setlocal enabledelayedexpansion

:: Validate arguments
if "%~1"=="" (
    echo Usage: kill-port [port]
    echo Example: kill-port 3000
    exit /b 1
)

set PORT=%~1

echo Checking for processes on port %PORT%...
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if %ERRORLEVEL%==0 (
    :: Get PID of the process using the port
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
        set PID=%%a
        echo Found process with PID: !PID!
            
        :: Kill the process
        echo Attempting to kill process on port %PORT% (PID: !PID!)...
        taskkill /F /PID !PID!
            
        if !ERRORLEVEL!==0 (
            echo Successfully killed process on port %PORT%
        ) else (
            echo Failed to kill process. You may need administrative privileges.
            exit /b 1
        )
    )
) else (
    echo No process found running on port %PORT%
    exit /b 0
)

exit /b 0
