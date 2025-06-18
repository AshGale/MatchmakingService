#!/bin/bash

# Unified Project Startup Script for MatchmakingService
# This script initializes all components: database, backend, and frontend

echo "===== MatchmakingService Startup ====="

# Default settings
ENV="dev"
START_DB=true
START_BACKEND=true
START_FRONTEND=true
VERBOSE=false

# Parse command line arguments
while [ "$#" -gt 0 ]; do
    case "$1" in
        --help|-h)
            show_help=true
            shift
            ;;
        --env)
            ENV="$2"
            shift 2
            ;;
        --db-only)
            START_DB=true
            START_BACKEND=false
            START_FRONTEND=false
            shift
            ;;
        --backend-only)
            START_DB=false
            START_BACKEND=true
            START_FRONTEND=false
            shift
            ;;
        --frontend-only)
            START_DB=false
            START_BACKEND=false
            START_FRONTEND=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown argument: $1"
            show_help=true
            shift
            ;;
    esac
done

# Show help and exit if requested
if [ "$show_help" = true ]; then
    echo
    echo "Unified MatchmakingService Startup Script"
    echo "Usage: ./start.sh [options]"
    echo
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --env VALUE         Set environment (dev, test, prod) - default: dev"
    echo "  --db-only           Start only the database"
    echo "  --backend-only      Start only the backend server"
    echo "  --frontend-only     Start only the frontend application"
    echo "  --verbose           Enable verbose output"
    echo
    exit 0
fi

# Show configuration if verbose
if [ "$VERBOSE" = true ]; then
    echo "Environment: $ENV"
    echo "Start Database: $START_DB"
    echo "Start Backend: $START_BACKEND"
    echo "Start Frontend: $START_FRONTEND"
    echo
fi

# Make the script executable
chmod +x "$(dirname "$0")/start.sh" 2>/dev/null

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed or not in PATH"
        echo "Please install Node.js from https://nodejs.org/"
        return 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d '.' -f 1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "Error: Node.js version 18 or higher is required"
        echo "Current version: $NODE_VERSION"
        return 1
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        echo "Error: npm is not installed or not in PATH"
        return 1
    fi
    
    # Check for PostgreSQL
    if ! command -v psql &> /dev/null; then
        echo "Warning: PostgreSQL command line tools not found in PATH"
        echo "Make sure PostgreSQL is installed and properly configured"
    fi
    
    # Check if PostgreSQL server is running
    if command -v pg_isready &> /dev/null; then
        if ! pg_isready -q; then
            echo "Error: PostgreSQL server is not running"
            echo "Please start PostgreSQL service before continuing"
            return 1
        fi
    else
        echo "Warning: pg_isready not found in PATH"
        echo "Will assume PostgreSQL is running"
    fi
    
    # Check for .env file
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            echo "Warning: .env file not found, creating from .env.example"
            cp .env.example .env
        else
            echo "Error: Neither .env nor .env.example files found"
            echo "Please create a .env file with required configuration"
            return 1
        fi
    fi
    
    echo "All prerequisites checked successfully"
    return 0
}

# Function to initialize database
init_database() {
    echo "Initializing database..."
    
    # Get database details from .env file
    DB_NAME=$(grep -E '^PGDATABASE=' .env | cut -d '=' -f 2)
    DB_USER=$(grep -E '^PGUSER=' .env | cut -d '=' -f 2)
    DB_PASS=$(grep -E '^PGPASSWORD=' .env | cut -d '=' -f 2)
    DB_HOST=$(grep -E '^PGHOST=' .env | cut -d '=' -f 2)
    
    # Set PGPASSWORD for passwordless psql commands
    export PGPASSWORD="$DB_PASS"
    
    # Check if database exists
    if ! psql -U "$DB_USER" -h "$DB_HOST" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
        echo "Creating database $DB_NAME..."
        psql -U "$DB_USER" -h "$DB_HOST" -d postgres -c "CREATE DATABASE $DB_NAME" > /dev/null
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to create database $DB_NAME"
            return 1
        else
            echo "Database $DB_NAME created successfully"
            
            # Run schema script
            if [ -f schema.sql ]; then
                echo "Running database schema script..."
                psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f schema.sql > /dev/null
                if [ $? -ne 0 ]; then
                    echo "Error: Failed to apply database schema"
                    return 1
                fi
            fi
            
            # Run validation tests if in dev mode
            if [ "$ENV" = "dev" ] && [ -f schema_validation_tests.sql ]; then
                echo "Running schema validation tests..."
                psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f schema_validation_tests.sql > /dev/null
                if [ $? -ne 0 ]; then
                    echo "Error: Schema validation tests failed"
                    return 1
                fi
            fi
        fi
    else
        echo "Database $DB_NAME already exists"
    fi
    
    echo "Database initialization complete"
    return 0
}

# Function to start backend server
start_backend() {
    echo "Starting backend server..."
    
    # Check for node_modules
    if [ ! -d node_modules ]; then
        echo "Installing backend dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install backend dependencies"
            return 1
        fi
    fi
    
    # Start backend with environment
    if [ "$ENV" = "dev" ]; then
        npm run dev &
    else
        npm start &
    fi
    
    BACKEND_PID=$!
    echo "Backend server started with PID $BACKEND_PID"
    return 0
}

# Function to start frontend application
start_frontend() {
    echo "Starting frontend application..."
    
    # Check if client directory exists
    if [ ! -d client ]; then
        echo "Error: Client directory not found"
        return 1
    fi
    
    # Check for client node_modules
    if [ ! -d client/node_modules ]; then
        echo "Installing frontend dependencies..."
        (cd client && npm install)
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install frontend dependencies"
            return 1
        fi
    fi
    
    # Start frontend based on environment
    if [ "$ENV" = "prod" ]; then
        echo "Building frontend for production..."
        (cd client && npm run build)
        if [ $? -ne 0 ]; then
            echo "Error: Failed to build frontend"
            return 1
        fi
        
        echo "Frontend built successfully. Serve using a static file server or the backend"
    else
        (cd client && npm start) &
        FRONTEND_PID=$!
        echo "Frontend development server started with PID $FRONTEND_PID"
    fi
    
    return 0
}

# Setup cleanup function
cleanup() {
    echo
    echo "Shutting down services..."
    
    # Kill child processes
    kill $(jobs -p) 2>/dev/null
    
    echo "Cleanup complete"
    exit 0
}

# Register the cleanup function for script termination
trap cleanup INT TERM EXIT

# Check prerequisites
check_prerequisites
if [ $? -ne 0 ]; then
    echo "Failed prerequisite check. Exiting..."
    exit 1
fi

# Initialize components based on flags
if [ "$START_DB" = true ]; then
    init_database
    if [ $? -ne 0 ]; then
        echo "Failed to initialize database. Exiting..."
        exit 1
    fi
fi

if [ "$START_BACKEND" = true ]; then
    start_backend
    if [ $? -ne 0 ]; then
        echo "Failed to start backend. Exiting..."
        exit 1
    fi
fi

if [ "$START_FRONTEND" = true ]; then
    start_frontend
    if [ $? -ne 0 ]; then
        echo "Failed to start frontend. Exiting..."
        exit 1
    fi
fi

echo "All components started successfully!"

# Keep the script running to maintain child processes
if [ "$START_BACKEND" = true ] || [ "$START_FRONTEND" = true ]; then
    echo "Press Ctrl+C to stop all services"
    wait
fi
