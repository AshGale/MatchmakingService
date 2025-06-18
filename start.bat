@echo off
setlocal enabledelayedexpansion

REM Unified Project Startup Script for MatchmakingService
REM This script initializes all components: database, backend, and frontend

echo ===== MatchmakingService Startup =====

REM Default settings
set ENV=dev
set START_DB=true
set START_BACKEND=true
set START_FRONTEND=true
set VERBOSE=false

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h" goto :show_help
if /i "%~1"=="--env" (
    set ENV=%~2
    shift
    goto :next_arg
)
if /i "%~1"=="--db-only" (
    set START_DB=true
    set START_BACKEND=false
    set START_FRONTEND=false
    goto :next_arg
)
if /i "%~1"=="--backend-only" (
    set START_DB=false
    set START_BACKEND=true
    set START_FRONTEND=false
    goto :next_arg
)
if /i "%~1"=="--frontend-only" (
    set START_DB=false
    set START_BACKEND=false
    set START_FRONTEND=true
    goto :next_arg
)
if /i "%~1"=="--verbose" (
    set VERBOSE=true
    goto :next_arg
)
echo Unknown argument: %~1
goto :show_help

:next_arg
shift
goto :parse_args

:args_done

REM Show configuration if verbose
if %VERBOSE%==true (
    echo Environment: %ENV%
    echo Start Database: %START_DB%
    echo Start Backend: %START_BACKEND%
    echo Start Frontend: %START_FRONTEND%
    echo.
)

REM Check prerequisites
call :check_prerequisites
if %ERRORLEVEL% neq 0 (
    echo Failed prerequisite check. Exiting...
    exit /b 1
)

REM Initialize components based on flags
if %START_DB%==true (
    call :init_database
    if %ERRORLEVEL% neq 0 (
        echo Failed to initialize database. Exiting...
        exit /b 1
    )
)

if %START_BACKEND%==true (
    call :start_backend
    if %ERRORLEVEL% neq 0 (
        echo Failed to start backend. Exiting...
        exit /b 1
    )
)

if %START_FRONTEND%==true (
    call :start_frontend
    if %ERRORLEVEL% neq 0 (
        echo Failed to start frontend. Exiting...
        exit /b 1
    )
)

echo All components started successfully!
exit /b 0

REM =================== HELPER FUNCTIONS ===================

:show_help
echo.
echo Unified MatchmakingService Startup Script
echo Usage: start.bat [options]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --env VALUE         Set environment (dev, test, prod) - default: dev
echo   --db-only           Start only the database
echo   --backend-only      Start only the backend server
echo   --frontend-only     Start only the frontend application
echo   --verbose           Enable verbose output
echo.
exit /b 0

:check_prerequisites
echo Checking prerequisites...

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Check Node.js version
for /f "tokens=2 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
for /f "tokens=1 delims=." %%a in ('echo %NODE_VERSION%') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
    echo Error: Node.js version 18 or higher is required
    echo Current version: %NODE_VERSION%
    exit /b 1
)

REM Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

REM Check for PostgreSQL
where psql >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Warning: PostgreSQL command line tools not found in PATH
    echo Make sure PostgreSQL is installed and properly configured
)

REM Check for pg_isready
where pg_isready >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Warning: pg_isready not found in PATH
    echo Will assume PostgreSQL is running
) else (
    pg_isready -q
    if %ERRORLEVEL% neq 0 (
        echo Error: PostgreSQL server is not running
        echo Please start PostgreSQL service before continuing
        exit /b 1
    )
)

REM Check for .env file
if not exist .env (
    if exist .env.example (
        echo Warning: .env file not found, creating from .env.example
        copy .env.example .env
    ) else (
        echo Error: Neither .env nor .env.example files found
        echo Please create a .env file with required configuration
        exit /b 1
    )
)

echo All prerequisites checked successfully
exit /b 0

:init_database
echo Initializing database...

REM Get database details from .env file
for /f "tokens=*" %%a in ('findstr /r "^PGDATABASE=" .env') do set DB_LINE=%%a
for /f "tokens=2 delims==" %%a in ('echo !DB_LINE!') do set DB_NAME=%%a

for /f "tokens=*" %%a in ('findstr /r "^PGUSER=" .env') do set USER_LINE=%%a
for /f "tokens=2 delims==" %%a in ('echo !USER_LINE!') do set DB_USER=%%a

for /f "tokens=*" %%a in ('findstr /r "^PGPASSWORD=" .env') do set PASS_LINE=%%a
for /f "tokens=2 delims==" %%a in ('echo !PASS_LINE!') do set DB_PASS=%%a

for /f "tokens=*" %%a in ('findstr /r "^PGHOST=" .env') do set HOST_LINE=%%a
for /f "tokens=2 delims==" %%a in ('echo !HOST_LINE!') do set DB_HOST=%%a

REM Check if database exists
set PGPASSWORD=!DB_PASS!
psql -U !DB_USER! -h !DB_HOST! -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='!DB_NAME!'" | findstr 1 > nul
if %ERRORLEVEL% neq 0 (
    echo Creating database !DB_NAME!...
    psql -U !DB_USER! -h !DB_HOST! -d postgres -c "CREATE DATABASE !DB_NAME!" > nul
    
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to create database !DB_NAME!
        exit /b 1
    ) else (
        echo Database !DB_NAME! created successfully
        
        REM Run schema script
        if exist schema.sql (
            echo Running database schema script...
            psql -U !DB_USER! -h !DB_HOST! -d !DB_NAME! -f schema.sql > nul
            if %ERRORLEVEL% neq 0 (
                echo Error: Failed to apply database schema
                exit /b 1
            )
        )
        
        REM Run validation tests if in dev mode
        if "%ENV%"=="dev" (
            if exist schema_validation_tests.sql (
                echo Running schema validation tests...
                psql -U !DB_USER! -h !DB_HOST! -d !DB_NAME! -f schema_validation_tests.sql > nul
                if %ERRORLEVEL% neq 0 (
                    echo Error: Schema validation tests failed
                    exit /b 1
                )
            )
        )
    )
) else (
    echo Database !DB_NAME! already exists
)

echo Database initialization complete
exit /b 0

:start_backend
echo Starting backend server...

REM Check for node_modules
if not exist node_modules (
    echo Installing backend dependencies...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install backend dependencies
        exit /b 1
    )
)

REM Start backend with environment
if "%ENV%"=="dev" (
    start "Backend Server" cmd /c npm run dev
) else (
    start "Backend Server" cmd /c npm start
)

echo Backend server started
exit /b 0

:start_frontend
echo Starting frontend application...

REM Check if client directory exists
if not exist client (
    echo Error: Client directory not found
    exit /b 1
)

REM Check for client node_modules
if not exist client\node_modules (
    echo Installing frontend dependencies...
    cd client && npm install && cd ..
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install frontend dependencies
        exit /b 1
    )
)

REM Start frontend based on environment
if "%ENV%"=="prod" (
    echo Building frontend for production...
    cd client && npm run build && cd ..
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to build frontend
        exit /b 1
    )
    
    echo Frontend built successfully. Serve using a static file server or the backend
) else (
    start "Frontend Dev Server" cmd /c cd client && npm start
    echo Frontend development server started
)

exit /b 0
