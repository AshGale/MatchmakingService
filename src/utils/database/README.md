# Database Utilities for Matchmaking Service

This directory contains utilities for database operations including connection pool management, transaction handling, error management, health checks, and index optimization.

## Directory Structure

- `index.js` - Main entry point exporting all database utilities
- `pool.js` - Connection pool configuration and management
- `transaction.js` - Transaction management with savepoint support
- `errors.js` - Custom database error classes and error handling
- `health.js` - Database health monitoring tools
- `indexes.md` - Documentation of database indexing strategy
- `index-performance.js` - Index performance testing utilities
- `index_maintenance.js` - Index maintenance and reporting utilities

## Database Indexing

The matchmaking service uses several indexes to optimize query performance:

### Indexes Overview

1. **idx_lobbies_status** - Indexes the status column in the lobbies table
2. **idx_players_session_id** - Indexes the session_id column in the players table
3. **idx_players_lobby_join** - Composite index on lobby_id and join_order in the players table
4. **idx_games_status** - Indexes the status column in the games table

For detailed information, see `indexes.md` in this directory.

## Index Testing

We provide tools to test the effectiveness of database indexes:

```bash
# Using the Node.js script directly
node scripts/test-indexes.js --file

# Using the PowerShell wrapper script
./scripts/test-indexes.ps1
```

The test results will be saved in the `logs` directory.

## Index Maintenance

Regular index maintenance is essential for optimal performance. Use the following tools:

```bash
# Generate deployment and rollback scripts
node src/utils/database/index_maintenance.js --generate-scripts

# Generate a report without making changes
node src/utils/database/index_maintenance.js --report-only

# Analyze tables and generate a report
node src/utils/database/index_maintenance.js

# Reindex all indexes and analyze tables
node src/utils/database/index_maintenance.js --reindex

# Using the PowerShell wrapper script
./scripts/maintain-indexes.ps1 -GenerateScripts
./scripts/maintain-indexes.ps1 -ReportOnly
./scripts/maintain-indexes.ps1 -Reindex
```

## Production Deployment

To deploy indexes to production:

1. Generate deployment scripts using `--generate-scripts`
2. Review the generated SQL in `logs/index_deployment.sql`
3. Execute the SQL in a maintenance window after thorough testing
4. Monitor query performance before and after deployment
5. Keep the rollback script (`logs/index_rollback.sql`) available if needed

## Best Practices

1. **Monitor Index Usage**: Regularly run the maintenance utility with `--report-only`
2. **Address Unused Indexes**: Remove indexes that consistently show low usage
3. **Reindex Periodically**: Schedule reindexing during low-traffic periods
4. **Test Before Deploying**: Always test index changes in development before production
5. **Version Control**: Track index changes alongside schema changes

## Environment Variables

The database utilities use the following environment variables:

- `DATABASE_URL` - Connection string for PostgreSQL
- `DB_HOST` - Database host
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Enable SSL (default: true in production)
