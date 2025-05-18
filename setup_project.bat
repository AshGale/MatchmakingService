@echo off
setlocal enabledelayedexpansion

echo Creating Match-Making Server Project Structure...

:: Create root directory
set "ROOT_DIR=match-making-server"
mkdir "%ROOT_DIR%" 2>nul

:: Create main directories
mkdir "%ROOT_DIR%\caddy" 2>nul
mkdir "%ROOT_DIR%\database" 2>nul
mkdir "%ROOT_DIR%\database\init" 2>nul
mkdir "%ROOT_DIR%\database\migrations" 2>nul
mkdir "%ROOT_DIR%\database\seeds" 2>nul
mkdir "%ROOT_DIR%\server" 2>nul
mkdir "%ROOT_DIR%\server\src" 2>nul
mkdir "%ROOT_DIR%\server\src\middleware" 2>nul
mkdir "%ROOT_DIR%\server\src\routes" 2>nul
mkdir "%ROOT_DIR%\server\src\services" 2>nul
mkdir "%ROOT_DIR%\server\src\utils" 2>nul
mkdir "%ROOT_DIR%\examples" 2>nul
mkdir "%ROOT_DIR%\logs" 2>nul

:: Create root level files
echo Creating root level files...
type nul > "%ROOT_DIR%\docker-compose.yml"
type nul > "%ROOT_DIR%\.env.example"
type nul > "%ROOT_DIR%\.gitignore"
type nul > "%ROOT_DIR%\README.md"

:: Create Caddy files
echo Creating Caddy files...
type nul > "%ROOT_DIR%\caddy\Caddyfile"

:: Create database files
echo Creating database files...
type nul > "%ROOT_DIR%\database\init\01-init.sql"
type nul > "%ROOT_DIR%\database\migrations\20250517_initial_schema.js"
type nul > "%ROOT_DIR%\database\migrations\20250517_lobbies_schema.js"
type nul > "%ROOT_DIR%\database\seeds\initial_data.js"

:: Create server files
echo Creating server files...
type nul > "%ROOT_DIR%\server\package.json"
type nul > "%ROOT_DIR%\server\knexfile.js"
type nul > "%ROOT_DIR%\server\healthcheck.js"
type nul > "%ROOT_DIR%\server\Dockerfile"
type nul > "%ROOT_DIR%\server\src\index.js"
type nul > "%ROOT_DIR%\server\src\app.js"
type nul > "%ROOT_DIR%\server\src\db.js"
type nul > "%ROOT_DIR%\server\src\websockets.js"

:: Create middleware files
echo Creating middleware files...
type nul > "%ROOT_DIR%\server\src\middleware\auth.js"
type nul > "%ROOT_DIR%\server\src\middleware\errorHandler.js"
type nul > "%ROOT_DIR%\server\src\middleware\notFoundHandler.js"

:: Create route files
echo Creating route files...
type nul > "%ROOT_DIR%\server\src\routes\auth.js"
type nul > "%ROOT_DIR%\server\src\routes\users.js"
type nul > "%ROOT_DIR%\server\src\routes\lobbies.js"
type nul > "%ROOT_DIR%\server\src\routes\games.js"

:: Create service files
echo Creating service files...
type nul > "%ROOT_DIR%\server\src\services\userService.js"
type nul > "%ROOT_DIR%\server\src\services\lobbyService.js"
type nul > "%ROOT_DIR%\server\src\services\gameService.js"
type nul > "%ROOT_DIR%\server\src\services\lobbyManager.js"
type nul > "%ROOT_DIR%\server\src\services\gameManager.js"
type nul > "%ROOT_DIR%\server\src\services\eloService.js"

:: Create utility files
echo Creating utility files...
type nul > "%ROOT_DIR%\server\src\utils\logger.js"

:: Create example files
echo Creating example files...
type nul > "%ROOT_DIR%\examples\GameLobby.jsx"

echo.
echo Project structure has been created at: %CD%\%ROOT_DIR%
echo.
echo The following files need to be filled with the code:
echo.
echo 1. docker-compose.yml
echo 2. server/Dockerfile
echo 3. caddy/Caddyfile
echo 4. database files (migrations and seeds)
echo 5. server source files
echo 6. .env.example and .gitignore
echo 7. README.md
echo.
echo Happy coding!

endlocal