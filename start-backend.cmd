@echo off
echo ===== MatchmakingService Backend Startup =====
echo Starting debug mode
setlocal EnableDelayedExpansion

:: Default settings
set ENV=dev
set PORT=3000
set ALT_PORT=3001
set VERBOSE=false
set PID=0

:: Parse command line arguments
:parse_args
if "%~1"=="" goto args_done
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
if "%~1"=="--env" (
    set ENV=%~2
    shift
    goto next_arg
)
if "%~1"=="--port" (
    set PORT=%~2
    shift
    goto next_arg
)
if "%~1"=="--verbose" (
    set VERBOSE=true
    goto next_arg
)
echo Unknown argument: %~1
goto show_help

:next_arg
shift
goto parse_args

:args_done

:: Show configuration if verbose
if "%VERBOSE%"=="true" (
    echo Environment: %ENV%
    echo Port: %PORT%
    echo.
)

:: Check prerequisites
echo Checking backend prerequisites...

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

:: Check for .env file
if not exist .env (
    if exist .env.example (
        echo Warning: .env file not found, creating from .env.example
        copy .env.example .env
        echo.
        echo PORT=%PORT% >> .env
    ) else (
        echo Error: Neither .env nor .env.example files found
        echo Please create a .env file with required configuration
        exit /b 1
    )
)

:: Check for node_modules
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install backend dependencies
        exit /b 1
    )
)

echo Checking if port is available...

:: Simple port check
netstat -ano | findstr ":%PORT%" >nul
if %ERRORLEVEL% equ 0 (
    echo Warning: Port %PORT% is already in use
    
    echo Press K to kill the process or A to try alternate port
    choice /c KA /n /m "Choice (K/A): "
    
    if %ERRORLEVEL% equ 1 (
        echo Attempting to kill process...
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%"') do (
            set PID=%%a
            echo Found process with PID: !PID!
            taskkill /F /PID !PID!
            goto :port_check_done
        )
    ) else (
        echo Will try alternate port...
        set PORT=%ALT_PORT%
        
        echo Checking if alternate port is available...
        netstat -ano | findstr ":%PORT%" >nul
        if %ERRORLEVEL% equ 0 (
            echo Error: Both ports %PORT% and %ALT_PORT% are in use
            echo Please specify a different port using the --port option
            exit /b 1
        )
    )
)

:port_check_done
echo Port check completed successfully

:: Update PORT environment variable
setx PORT %PORT% >nul

:: Ensure logs directory exists
if not exist logs mkdir logs

:: Start backend based on environment
echo Starting backend server on port %PORT%...
if "%ENV%"=="dev" (
    start "MatchmakingService Backend" cmd /c npm run dev
) else (
    start "MatchmakingService Backend" cmd /c npm start
)

echo Backend server started successfully on port %PORT%
echo Server will be available at: http://localhost:%PORT%
echo Press Ctrl+C in the server window to stop
exit /b 0

:show_help
echo.
echo MatchmakingService Backend Startup Script
echo Usage: start-backend.cmd [options]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --env VALUE         Set environment (dev, test, prod) - default: dev
echo   --port VALUE        Specify the port for the backend server (default: 3000)
echo   --verbose           Enable verbose output
echo.
exit /b 0
