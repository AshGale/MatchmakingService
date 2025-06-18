@echo off
setlocal

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
if "%~1"=="--db-only" (
    set START_DB=true
    set START_BACKEND=false
    set START_FRONTEND=false
    goto next_arg
)
if "%~1"=="--backend-only" (
    set START_DB=false
    set START_BACKEND=true
    set START_FRONTEND=false
    goto next_arg
)
if "%~1"=="--frontend-only" (
    set START_DB=false
    set START_BACKEND=false
    set START_FRONTEND=true
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

:: Check for npm
where npm >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

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
        echo PORT=%PORT% >> .env
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

:: Check for PostgreSQL
where psql >nul 2>nul
if not %ERRORLEVEL%==0 (
    echo Warning: PostgreSQL command line tools not found in PATH
    echo Make sure PostgreSQL is installed and properly configured
) else (
    :: Check if PostgreSQL server is running
    pg_isready -q
    if not %ERRORLEVEL%==0 (
        echo Warning: PostgreSQL server is not running
        echo Please start PostgreSQL service before continuing
    ) else (
        echo PostgreSQL server is running
        
        :: Get database name from .env file
        for /f "tokens=1,2 delims==" %%a in ('findstr /B "PGDATABASE" .env') do set DB_NAME=%%b
        for /f "tokens=1,2 delims==" %%a in ('findstr /B "PGUSER" .env') do set DB_USER=%%b
        for /f "tokens=1,2 delims==" %%a in ('findstr /B "PGHOST" .env') do set DB_HOST=%%b
        
        if "%VERBOSE%"=="true" echo Using database: %DB_NAME% with user: %DB_USER%
        
        echo Running database initialization...
        if exist schema.sql (
            echo Applying schema...
            psql -U %DB_USER% -h %DB_HOST% -d %DB_NAME% -f schema.sql
            if not %ERRORLEVEL%==0 (
                echo Warning: Schema application may have had errors
            )
            
            if "%ENV%"=="dev" (
                if exist schema_validation_tests.sql (
                    echo Running schema validation tests...
                    psql -U %DB_USER% -h %DB_HOST% -d %DB_NAME% -f schema_validation_tests.sql
                )
            )
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
netstat -ano | findstr ":%PORT%" >nul
if %ERRORLEVEL%==0 (
    echo Warning: Port %PORT% is already in use
    echo Trying alternate port %ALT_PORT%...
    set PORT=%ALT_PORT%
    
    :: Check if alternate port is also in use
    netstat -ano | findstr ":%PORT%" >nul
    if %ERRORLEVEL%==0 (
        echo Error: Both ports %PORT% and %ALT_PORT% are in use
        echo Please specify a different port using the --port option
        exit /b 1
    )
)

:: Update PORT environment variable
setx PORT %PORT% >nul

:: Start backend based on environment
if "%ENV%"=="dev" (
    start "MatchmakingService Backend" cmd /c npm run dev
) else (
    start "MatchmakingService Backend" cmd /c npm start
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
        echo Frontend built successfully. Serving static files.
    ) else (
        start "MatchmakingService Frontend" cmd /c cd client ^& npm start
        echo Frontend development server started
    )
) else (
    echo Warning: No package.json found in client directory
    echo Skipping frontend startup
)

exit /b 0

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
if /i "%~1"=="--port" (
    set PORT=%~2
    shift
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
echo Usage: start.cmd [options]
echo.
echo Options:
echo   --help, -h          Show this help message
echo   --env VALUE         Set environment (dev, test, prod) - default: dev
echo   --db-only           Start only the database
echo   --backend-only      Start only the backend server
echo   --frontend-only     Start only the frontend application
echo   --verbose           Enable verbose output
echo   --port VALUE        Specify the port for the backend server (default: 3000)
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
        
        REM Add required database settings if not present
        echo. >> .env
        echo PGDATABASE=matchmaking >> .env
        echo PGUSER=postgres >> .env
        echo PGPASSWORD=postgres >> .env
        echo PGHOST=localhost >> .env
        echo PORT=%PORT% >> .env
    ) else (
        echo Error: Neither .env nor .env.example files found
        echo Please create a .env file with required configuration
        exit /b 1
    )
) else (
    REM Update PORT in .env file
    powershell -Command "(Get-Content .env) -replace '^PORT=.*', 'PORT=%PORT%' | Set-Content .env"
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

REM Check if default port is available
netstat -ano | findstr ":%PORT%" > nul
if %ERRORLEVEL% equ 0 (
    echo Warning: Port %PORT% is already in use. 
    echo Trying alternate port %ALTERNATE_PORT%...
    set PORT=%ALTERNATE_PORT%
    
    REM Update PORT in .env file
    powershell -Command "(Get-Content .env) -replace '^PORT=.*', 'PORT=%PORT%' | Set-Content .env"
    
    REM Check if alternate port is available
    netstat -ano | findstr ":%PORT%" > nul
    if %ERRORLEVEL% equ 0 (
        echo Error: Both ports %DEFAULT_PORT% and %PORT% are in use
        echo Please specify a different port using --port option
        exit /b 1
    )
)

REM Start backend with environment
if "%ENV%"=="dev" (
    start "Backend Server" cmd /c npm run dev
) else (
    start "Backend Server" cmd /c npm start
)

echo Backend server started on port %PORT%
exit /b 0

:start_frontend
echo Starting frontend application...

REM Check if client directory exists
if not exist client\src (
    echo Warning: Client directory structure seems incomplete
    echo Skipping frontend startup
    exit /b 0
)

REM Check for client node_modules
if exist client\package.json (
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
) else (
    echo Warning: No package.json found in client directory
    echo Skipping frontend startup
)

exit /b 0
