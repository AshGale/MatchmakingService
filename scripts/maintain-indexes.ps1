# Database Index Maintenance Script
# This script performs maintenance on database indexes and generates deployment scripts

# Ensure the logs directory exists
if (!(Test-Path -Path "../logs")) {
    New-Item -ItemType Directory -Path "../logs" -Force | Out-Null
    Write-Host "Created logs directory."
}

# Parse command line arguments
param(
    [switch]$GenerateScripts,
    [switch]$Reindex,
    [switch]$ReportOnly,
    [switch]$NoAnalyze,
    [switch]$Help
)

if ($Help) {
    Write-Host "Database Index Maintenance Utility"
    Write-Host ""
    Write-Host "Usage: .\maintain-indexes.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -GenerateScripts  Generate deployment and rollback scripts"
    Write-Host "  -Reindex          Perform reindexing on all indexes"
    Write-Host "  -ReportOnly       Only generate report without making changes"
    Write-Host "  -NoAnalyze        Skip analyzing tables"
    Write-Host "  -Help             Show this help message"
    exit 0
}

# Build arguments string for the Node.js script
$args = @()

if ($GenerateScripts) {
    $args += "--generate-scripts"
}
if ($Reindex) {
    $args += "--reindex"
}
if ($ReportOnly) {
    $args += "--report-only"
}
if ($NoAnalyze) {
    $args += "--no-analyze"
}

# Run the index maintenance script
Write-Host "Running database index maintenance..."
node ../src/utils/database/index_maintenance.js $args

# Check the result
if ($LASTEXITCODE -eq 0) {
    Write-Host "Index maintenance completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Index maintenance encountered errors. Please review the output." -ForegroundColor Red
}
