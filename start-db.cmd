@echo off
setlocal

echo ===== MatchmakingService Database Startup =====

:: Default settings
set VERBOSE=false

:: Parse command line arguments
:parse_args
if "%~1"=="" goto args_done
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
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

:: Check prerequisites
echo Checking database prerequisites...

:: Check for .env file
if not exist .env (
    if exist .env.example (
        echo Warning: .env file not found, creating from .env.example
        copy .env.example .env
        echo.
        echo PGDATABASE=matchmaking >> .env
        echo PGUSER=postgres >> .env
        echo PGPASSWORD=postgres >> .env
        echo PGHOST=localhost >> .env
    ) else (
        echo Error: Neither .env nor .env.example files found
        echo Please create a .env file with required configuration
        exit /b 1
    )
)

:: Check for PostgreSQL
where psql >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Warning: PostgreSQL command line tools not found in PATH
    echo Make sure PostgreSQL is installed and properly configured
    exit /b 1
)

:: Check if PostgreSQL server is running
pg_isready -q
if not %ERRORLEVEL%==0 (
    echo Error: PostgreSQL server is not running
    echo Please start PostgreSQL service before continuing
    exit /b 1
)

echo PostgreSQL server is running

:: Get database details from .env
for /f "tokens=1,2 delims==" %%a in ('findstr /B "PGDATABASE" .env') do set DB_NAME=%%b
for /f "tokens=1,2 delims==" %%a in ('findstr /B "PGUSER" .env') do set DB_USER=%%b
for /f "tokens=1,2 delims==" %%a in ('findstr /B "PGHOST" .env') do set DB_HOST=%%b

if "%VERBOSE%"=="true" echo Using database: %DB_NAME% with user: %DB_USER%

:: Check if database exists
psql -U %DB_USER% -h %DB_HOST% -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'" | findstr 1 >nul
if not %ERRORLEVEL%==0 (
    echo Creating database %DB_NAME%...
    psql -U %DB_USER% -h %DB_HOST% -d postgres -c "CREATE DATABASE %DB_NAME%"
    if not %ERRORLEVEL%==0 (
        echo Error: Failed to create database %DB_NAME%
        exit /b 1
    ) else (
        echo Database %DB_NAME% created successfully
    )
) else (
    echo Database %DB_NAME% already exists
)

:: Apply schema if it exists
if exist schema.sql (
    echo Running database schema script...
    psql -U %DB_USER% -h %DB_HOST% -d %DB_NAME% -f schema.sql
    if not %ERRORLEVEL%==0 (
        echo Warning: Schema application may have had errors
        exit /b 1
    )
    
    :: Run validation tests
    if exist schema_validation_tests.sql (
        echo Running schema validation tests...
        psql -U %DB_USER% -h %DB_HOST% -d %DB_NAME% -f schema_validation_tests.sql
        if not %ERRORLEVEL%==0 (
            echo Warning: Schema validation tests failed
            exit /b 1
        )
    )
)

echo Database initialization complete
exit /b 0

:show_help
echo.
echo MatchmakingService Database Startup Script
echo Usage: start-db.cmd [options]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --verbose           Enable verbose output
echo.
exit /b 0
