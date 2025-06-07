# Database Index Performance Test Script
# This script runs the index performance tests and generates a report

# Ensure the logs directory exists
if (!(Test-Path -Path "../logs")) {
    New-Item -ItemType Directory -Path "../logs" -Force | Out-Null
    Write-Host "Created logs directory."
}

# Run the index performance test
Write-Host "Running database index performance tests..."
node ./test-indexes.js --file

# Check the result
if ($LASTEXITCODE -eq 0) {
    Write-Host "All index tests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "Some index tests failed. Please review the output for details." -ForegroundColor Red
}
