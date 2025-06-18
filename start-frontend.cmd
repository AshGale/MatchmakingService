@echo off
setlocal

echo ===== MatchmakingService Frontend Startup =====

:: Default settings
set ENV=dev
set VERBOSE=false

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
    echo.
)

:: Check prerequisites
echo Checking frontend prerequisites...

:: Check for Node.js
where node >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

:: Check if client directory exists
if not exist client\src (
    echo Error: Client directory structure seems incomplete
    echo Unable to start frontend
    exit /b 1
)

:: Check for client package.json
if not exist client\package.json (
    echo Error: No package.json found in client directory
    echo Unable to start frontend
    exit /b 1
)

:: Check for client node_modules
if not exist client\node_modules (
    echo Installing frontend dependencies...
    cd client && call npm install && cd ..
    if not %ERRORLEVEL%==0 (
        echo Error: Failed to install frontend dependencies
        exit /b 1
    )
)

:: Start frontend based on environment
echo Starting frontend application...
if "%ENV%"=="prod" (
    echo Building frontend for production...
    cd client && call npm run build && cd ..
    if not %ERRORLEVEL%==0 (
        echo Error: Failed to build frontend
        exit /b 1
    )
    echo Frontend built successfully.
    echo You can now serve the static files from client/build or using a static file server.
) else (
    start "MatchmakingService Frontend" cmd /c cd client ^& set PORT=3006 ^& npm start
    echo Frontend development server started
    echo Press Ctrl+C in the frontend window to stop
)

exit /b 0

:show_help
echo.
echo MatchmakingService Frontend Startup Script
echo Usage: start-frontend.cmd [options]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --env VALUE         Set environment (dev, test, prod) - default: dev
echo   --verbose           Enable verbose output
echo.
exit /b 0
