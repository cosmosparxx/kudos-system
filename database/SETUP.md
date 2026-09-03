# Database Setup Guide

## Prerequisites
- PostgreSQL 13 or higher installed
- Default PostgreSQL user: `postgres`

## Quick Setup

### 1. Create the database

```bash
createdb kudos_db
```

Or using psql:
```bash
psql -U postgres -c "CREATE DATABASE kudos_db;"
```

### 2. Create a database user (optional but recommended)

```bash
psql -U postgres -c "CREATE USER kudos_user WITH PASSWORD 'your-secure-password';"
psql -U postgres -c "ALTER USER kudos_user CREATEDB;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kudos_db TO kudos_user;"
```

### 3. Run migrations

From the backend directory:

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate
```

## Troubleshooting

### Connection refused
- Check that PostgreSQL is running: `pg_isrunning` (macOS) or check services (Windows)
- Verify host and port in `.env` file (default: localhost:5432)

### Permission denied
- Ensure the user has proper permissions: 
  ```bash
  psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kudos_db TO kudos_user;"
  ```

### Migration failed
- Check database logs: `tail -f /var/log/postgresql/postgresql.log` (Linux/macOS)
- Manually verify database exists: `psql -U postgres -l`

## Manual Migration (if npm fails)

```bash
psql -U postgres -d kudos_db < schema.sql
```

## Database Backup

```bash
pg_dump -U postgres kudos_db > kudos_backup.sql
```

## Database Restore

```bash
psql -U postgres kudos_db < kudos_backup.sql
```
