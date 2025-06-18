# Environment Variables Configuration Guide

This document provides a comprehensive guide to all environment variables used in the MatchmakingService application, along with setup instructions, best practices, and troubleshooting tips.

## Table of Contents

1. [Overview](#overview)
2. [Setting Up Your Environment File](#setting-up-your-environment-file)
3. [Environment Variables by Component](#environment-variables-by-component)
   - [API Keys](#api-keys)
   - [Database Configuration](#database-configuration)
   - [Server Configuration](#server-configuration)
   - [Logging Configuration](#logging-configuration)
   - [API Configuration](#api-configuration)
4. [Environment-Specific Configurations](#environment-specific-configurations)
5. [Environment Variable Loading](#environment-variable-loading)
6. [Validation and Troubleshooting](#validation-and-troubleshooting)
7. [Security Considerations](#security-considerations)
8. [Setup Checklist](#setup-checklist)

## Overview

The MatchmakingService uses environment variables to configure various aspects of the application, including database connections, API endpoints, logging levels, and third-party service integration. This approach keeps sensitive information out of the codebase and enables easy configuration across different environments.

## Setting Up Your Environment File

### Step 1: Create Your .env File

Create a copy of the `.env.example` file and rename it to `.env`:

```bash
cp .env.example .env
```

This file should be kept in the root directory of the project.

> **IMPORTANT**: The `.env` file contains sensitive information and should never be committed to version control. The `.gitignore` file is configured to exclude it automatically.

### Step 2: Configure Your Variables

Open the `.env` file in a text editor and update the variables according to your environment. Each variable is explained in detail in the following sections.

## Environment Variables by Component

### API Keys

These variables control authentication to various AI services that may be used by task-related operations:

| Variable | Description | Required | Default | Format |
|----------|-------------|----------|---------|--------|
| `ANTHROPIC_API_KEY` | API key for Anthropic services | Yes, if using Anthropic services | None | `sk-ant-api03-...` |
| `PERPLEXITY_API_KEY` | API key for Perplexity services | No | None | `pplx-...` |
| `OPENAI_API_KEY` | API key for OpenAI services | No | None | `sk-proj-...` |
| `GOOGLE_API_KEY` | API key for Google Gemini models | No | None | String |
| `MISTRAL_API_KEY` | API key for Mistral AI models | No | None | String |
| `XAI_API_KEY` | API key for xAI models | No | None | String |
| `AZURE_OPENAI_API_KEY` | API key for Azure OpenAI models | No | None | String |

### Database Configuration

Database connection parameters for the PostgreSQL database:

| Variable | Description | Required | Default | Format |
|----------|-------------|----------|---------|--------|
| `DATABASE_URL` | Full connection string (alternative to individual params) | No | None | `postgresql://user:password@host:port/database` |
| `DB_HOST` | Database hostname | Yes (if `DATABASE_URL` not specified) | None | Hostname or IP address |
| `DB_PORT` | Database port | Yes (if `DATABASE_URL` not specified) | None | Number (typically 5432) |
| `DB_NAME` | Database name | Yes (if `DATABASE_URL` not specified) | None | String |
| `DB_USER` | Database username | Yes (if `DATABASE_URL` not specified) | None | String |
| `DB_PASSWORD` | Database password | Yes (if `DATABASE_URL` not specified) | None | String |

> **Note**: You can either use the `DATABASE_URL` connection string OR the individual connection parameters. If both are provided, the connection string takes precedence.

### Server Configuration

Configuration for the HTTP server:

| Variable | Description | Required | Default | Format |
|----------|-------------|----------|---------|--------|
| `PORT` | Port for the server to listen on | No | 3000 | Number |
| `NODE_ENV` | Environment mode | No | `development` | String: `development`, `test`, or `production` |

### Logging Configuration

Settings for application logging:

| Variable | Description | Required | Default | Format |
|----------|-------------|----------|---------|--------|
| `LOG_LEVEL` | Minimum logging level | No | `info` | String: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly` |

### API Configuration

Settings for external API connections:

| Variable | Description | Required | Default | Format |
|----------|-------------|----------|---------|--------|
| `API_BASE_URL` | Base URL for external API calls | No | `''` (empty string) | URL string |
| `API_AUTH_TOKEN` | Authentication token for external APIs | No | None | String |

## Environment-Specific Configurations

The application behavior changes depending on the `NODE_ENV` variable:

### Development Environment (`NODE_ENV=development`)

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

**Key behaviors in development mode:**
- Detailed logging with SQL query information
- CORS configured to allow all origins
- Error responses include full stack traces
- Retry mechanisms provide more verbose output
- Database connection details are logged

### Testing Environment (`NODE_ENV=test`)

```env
NODE_ENV=test
PORT=3000
LOG_LEVEL=info
```

**Key behaviors in test mode:**
- Reduced logging (primarily errors and warnings)
- Database transactions are carefully managed for test isolation
- Error responses are standardized

### Production Environment (`NODE_ENV=production`)

```env
NODE_ENV=production
PORT=80
LOG_LEVEL=warn
```

**Key behaviors in production mode:**
- Minimal logging (only warnings and errors)
- SSL required for database connections
- Error responses exclude stack traces for security
- CORS configured with strict origin checking
- Performance optimizations enabled

## Environment Variable Loading

The application loads environment variables in the following order of precedence:

1. Runtime environment variables set directly in the system
2. Variables defined in the `.env` file
3. Default values hardcoded in the application

The application uses the Node.js `dotenv` package to automatically load variables from the `.env` file during startup.

Example of how variables are loaded in the code:

```javascript
// Server port with fallback to 3000
const PORT = process.env.PORT || 3000;

// Log level with fallback to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';
```

## Validation and Troubleshooting

### Validating Your Environment Setup

You can validate your environment setup by running:

```bash
node -e "console.log(require('dotenv').config())"
```

This will show loaded environment variables and any parsing errors.

### Common Environment Variable Issues

1. **Database Connection Failures**
   - **Symptom**: Server fails to start with database connection errors
   - **Check**: Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` variables
   - **Solution**: Ensure PostgreSQL is running and credentials are correct

2. **"Environment variable not found" errors**
   - **Symptom**: Application crashes with reference errors
   - **Check**: Confirm that all required variables are defined in your `.env` file
   - **Solution**: Copy missing variables from `.env.example` and configure appropriate values

3. **SSL Certificate Issues**
   - **Symptom**: Database connections fail in production with SSL errors
   - **Check**: Verify SSL configuration when `NODE_ENV` is set to `production`
   - **Solution**: Provide proper SSL certificates or set appropriate SSL mode

4. **Wrong Environment Behavior**
   - **Symptom**: Application behaves unexpectedly
   - **Check**: Verify `NODE_ENV` is set correctly
   - **Solution**: Ensure `NODE_ENV` matches your intended environment (`development`, `test`, or `production`)

## Security Considerations

When working with environment variables, keep these security best practices in mind:

1. **Never commit `.env` files to version control**
   - The `.gitignore` file is configured to exclude `.env` files, but always double-check before committing

2. **Rotate sensitive credentials regularly**
   - Database passwords and API keys should be changed periodically

3. **Use different credentials for each environment**
   - Development, testing, and production environments should have separate credentials

4. **Limit access to production environment variables**
   - Only DevOps personnel should have access to production credentials

5. **Consider using a secrets management service**
   - For production deployments, consider using AWS Secrets Manager, HashiCorp Vault, or similar services

6. **Monitor for unauthorized access**
   - Regularly audit access logs for sensitive API keys and database connections

## Setup Checklist

Use this checklist to ensure your environment is properly configured:

- [ ] Copied `.env.example` to `.env`
- [ ] Configured database connection parameters
- [ ] Set appropriate `NODE_ENV` value
- [ ] Configured logging level
- [ ] Added required API keys (if using external services)
- [ ] Validated environment variables
- [ ] Tested database connection
- [ ] Ensured `.env` is not tracked by git
- [ ] Set up appropriate environment-specific configurations

## Cross-References

For more information about the MatchmakingService project setup:

- [Project README](../README.md): Overall project documentation and setup instructions
- [Database Schema](../schema.sql): Database schema definitions and structure
