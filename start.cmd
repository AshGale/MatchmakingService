@echo off
setlocal EnableDelayedExpansion

echo ===== MatchmakingService Unified Startup =====

:: Default settings
set ENV=dev
set PORT=3000
set ALT_PORT=3001
set START_DB=true
set START_BACKEND=true
set START_FRONTEND=true
set VERBOSE=false

:: Parse command line arguments
:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="-h" goto show_help
if /i "%~1"=="--env" (
    set ENV=%~2
    shift
    goto next_arg
)
if /i "%~1"=="--port" (
    set PORT=%~2
    shift
    goto next_arg
)
if /i "%~1"=="--db-only" (
    set START_DB=true
    set START_BACKEND=false
    set START_FRONTEND=false
    goto next_arg
)
if /i "%~1"=="--backend-only" (
    set START_DB=false
    set START_BACKEND=true
    set START_FRONTEND=false
    goto next_arg
)
if /i "%~1"=="--frontend-only" (
    set START_DB=false
    set START_BACKEND=false
    set START_FRONTEND=true
    goto next_arg
)
if /i "%~1"=="--verbose" (
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
    echo Start Database: %START_DB%
    echo Start Backend: %START_BACKEND%
    echo Start Frontend: %START_FRONTEND%
    echo.
)

:: Check prerequisites
call :check_prerequisites
if errorlevel 1 (
    echo Failed prerequisite check. Exiting...
    exit /b 1
)

:: Initialize components based on flags
if "%START_DB%"=="true" (
    call :init_database
    if errorlevel 1 (
        echo Failed to initialize database. Exiting...
        exit /b 1
    )
)

if "%START_BACKEND%"=="true" (
    call :start_backend
    if errorlevel 1 (
        echo Failed to start backend. Exiting...
        exit /b 1
    )
)

if "%START_FRONTEND%"=="true" (
    call :start_frontend
    if errorlevel 1 (
        echo Failed to start frontend. Exiting...
        exit /b 1
    )
)

echo All requested components started successfully!
exit /b 0

:: =================== HELPER FUNCTIONS ===================

:show_help
echo.
echo Unified MatchmakingService Startup Script
echo Usage: start.cmd [options]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --env VALUE         Set environment (dev, test, prod) - default: dev
echo   --port VALUE        Specify the port for the backend server (default: 3000)
echo   --db-only           Start only the database
echo   --backend-only      Start only the backend server
echo   --frontend-only     Start only the frontend application
echo   --verbose           Enable verbose output
echo.
exit /b 0

:check_prerequisites
echo Checking prerequisites...

:: Check for Node.js
where node >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

:: Check Node.js version
for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
for /f "tokens=1 delims=." %%a in ('echo %NODE_VERSION%') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
    echo Error: Node.js version 18 or higher is required
    echo Current version: v%NODE_VERSION%
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

:: Check for PostgreSQL
where psql >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Warning: PostgreSQL command line tools not found in PATH
    echo Make sure PostgreSQL is installed and properly configured
) else (
    :: Check if PostgreSQL server is running
    where pg_isready >nul 2>nul
    if not %ERRORLEVEL%==0 (
        echo Warning: pg_isready not found in PATH
        echo Will assume PostgreSQL is running
    ) else (
        pg_isready -q
        if not %ERRORLEVEL%==0 (
            echo Warning: PostgreSQL server is not running
            echo Please start PostgreSQL service before continuing
        ) else (
            echo PostgreSQL server is running
        )
    )
)

:: Check for .env file
if not exist .env (
    if exist .env.example (
        echo Warning: .env file not found, creating from .env.example
        copy .env.example .env >nul
        echo.
        echo PGDATABASE=matchmaking >> .env
        echo PGUSER=postgres >> .env
        echo PGPASSWORD=postgres >> .env
        echo PGHOST=localhost >> .env
        echo PGPORT=5432 >> .env
        echo PORT=%PORT% >> .env
    ) else (
        echo Error: Neither .env nor .env.example files found
        echo Please create a .env file with required configuration
        exit /b 1
    )
) else (
    :: Update PORT in .env file if powershell is available
    where powershell >nul 2>nul
    if %ERRORLEVEL%==0 (
        powershell -Command "(Get-Content .env) -replace '^PORT=.*', 'PORT=%PORT%' | Set-Content .env" >nul 2>nul
    )
)

echo All prerequisites checked successfully
exit /b 0

:init_database
echo Initializing database...

:: Get database settings from .env file with improved parsing
set DB_NAME=matchmaking
set DB_USER=postgres
set DB_HOST=localhost
set DB_PASSWORD=postgres
set DB_PORT=5432

:: Read values from .env file if they exist
for /f "tokens=1,* delims==" %%a in ('findstr /B "PGDATABASE" .env 2^>nul') do set DB_NAME=%%b
for /f "tokens=1,* delims==" %%a in ('findstr /B "PGUSER" .env 2^>nul') do set DB_USER=%%b
for /f "tokens=1,* delims==" %%a in ('findstr /B "PGHOST" .env 2^>nul') do set DB_HOST=%%b
for /f "tokens=1,* delims==" %%a in ('findstr /B "PGPASSWORD" .env 2^>nul') do set DB_PASSWORD=%%b
for /f "tokens=1,* delims==" %%a in ('findstr /B "PGPORT" .env 2^>nul') do set DB_PORT=%%b

:: Remove any leading/trailing spaces
for /f "tokens=*" %%a in ("!DB_NAME!") do set DB_NAME=%%a
for /f "tokens=*" %%a in ("!DB_USER!") do set DB_USER=%%a
for /f "tokens=*" %%a in ("!DB_HOST!") do set DB_HOST=%%a
for /f "tokens=*" %%a in ("!DB_PASSWORD!") do set DB_PASSWORD=%%a
for /f "tokens=*" %%a in ("!DB_PORT!") do set DB_PORT=%%a

if "%VERBOSE%"=="true" (
    echo Database settings:
    echo - Host: !DB_HOST!
    echo - User: !DB_USER!
    echo - Database: !DB_NAME!
    echo - Port: !DB_PORT!
)

:: Set password for PostgreSQL commands
set PGPASSWORD=!DB_PASSWORD!

:: Check if database exists
echo Checking if database !DB_NAME! exists...
psql -U !DB_USER! -h !DB_HOST! -p !DB_PORT! -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='!DB_NAME!'" 2>nul | findstr "1" >nul
if not %ERRORLEVEL%==0 (
    echo Creating database !DB_NAME!...
    psql -U !DB_USER! -h !DB_HOST! -p !DB_PORT! -d postgres -c "CREATE DATABASE !DB_NAME!" >nul 2>nul
    
    if not %ERRORLEVEL%==0 (
        echo Error: Failed to create database !DB_NAME!
        exit /b 1
    ) else (
        echo Database !DB_NAME! created successfully
    )
) else (
    echo Database !DB_NAME! already exists
)

:: Run schema script if it exists
if exist schema.sql (
    echo Applying schema...
    psql -U !DB_USER! -h !DB_HOST! -p !DB_PORT! -d !DB_NAME! -f schema.sql >nul 2>nul
    if not %ERRORLEVEL%==0 (
        echo Warning: Schema application may have had errors
    ) else (
        echo Schema applied successfully
    )
)

:: Run validation tests if in dev mode
if "%ENV%"=="dev" (
    if exist schema_validation_tests.sql (
        echo Running schema validation tests...
        psql -U !DB_USER! -h !DB_HOST! -p !DB_PORT! -d !DB_NAME! -f schema_validation_tests.sql >nul 2>nul
        if not %ERRORLEVEL%==0 (
            echo Warning: Schema validation tests may have had errors
        ) else (
            echo Schema validation tests completed
        )
    )
)

echo Database initialization complete
exit /b 0

:start_backend
echo Starting backend server...

:: Check for node_modules
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
    if not %ERRORLEVEL%==0 (
        echo Error: Failed to install backend dependencies
        exit /b 1
    )
)

:: Check if port is available
netstat -ano | findstr ":%PORT%" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Warning: Port %PORT% is already in use
    
    :: Try to find the process and offer to kill it
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING" 2^>nul') do (
        set PID=%%a
        goto found_pid
    )
    
    :found_pid
    if defined PID (
        echo Found process with PID: !PID!
        choice /c KA /n /m "Do you want to [K]ill the process or try [A]lternate port (%ALT_PORT%)? "
        
        if !ERRORLEVEL! equ 1 (
            echo Attempting to kill process on port %PORT% (PID: !PID!)...
            taskkill /F /PID !PID! >nul 2>nul
            
            if !ERRORLEVEL! equ 0 (
                echo Successfully killed process
                timeout /t 2 /nobreak >nul
            ) else (
                echo Failed to kill process. Trying alternate port %ALT_PORT%...
                set PORT=%ALT_PORT%
            )
        ) else (
            echo Trying alternate port %ALT_PORT%...
            set PORT=%ALT_PORT%
        )
    ) else (
        echo Trying alternate port %ALT_PORT%...
        set PORT=%ALT_PORT%
    )
    
    :: Check if alternate port is also in use
    if "%PORT%"=="%ALT_PORT%" (
        netstat -ano | findstr ":%ALT_PORT%" >nul 2>nul
        if %ERRORLEVEL% equ 0 (
            echo Error: Both ports 3000 and %ALT_PORT% are in use
            echo Please specify a different port using the --port option
            exit /b 1
        )
    )
)

:: Start backend based on environment
if "%ENV%"=="dev" (
    start "MatchmakingService Backend" cmd /c "set PORT=%PORT% && npm run dev"
) else (
    start "MatchmakingService Backend" cmd /c "set PORT=%PORT% && npm start"
)

echo Backend server started on port %PORT%
exit /b 0

:start_frontend
echo Starting frontend application...

:: Check if client directory exists
if not exist client\src (
    echo Warning: Client directory structure seems incomplete
    echo Skipping frontend startup
    exit /b 0
)

:: Check for client package.json
if exist client\package.json (
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
    if "%ENV%"=="prod" (
        echo Building frontend for production...
        cd client && call npm run build && cd ..
        if not %ERRORLEVEL%==0 (
            echo Error: Failed to build frontend
            exit /b 1
        )
        echo Frontend built successfully. Serve using a static file server or the backend
    ) else (
        start "MatchmakingService Frontend" cmd /c "cd client && npm start"
        echo Frontend development server started
    )
) else (
    echo Warning: No package.json found in client directory
    echo Skipping frontend startup
)

exit /b 0