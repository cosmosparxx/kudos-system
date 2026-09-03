import { query } from './db.js';
import logger from '../utils/logger.js';

const migrations = [
  {
    id: '000_create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        avatar_url TEXT,
        department VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_name ON users(name);
      CREATE INDEX IF NOT EXISTS idx_role ON users(role);
    `
  },
  {
    id: '001_create_kudos_table',
    sql: `
      CREATE TABLE IF NOT EXISTS kudos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL CHECK (length(message) >= 10 AND length(message) <= 500),
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        is_flagged BOOLEAN DEFAULT FALSE,
        is_visible BOOLEAN DEFAULT TRUE,
        flag_count INT DEFAULT 0,
        CONSTRAINT sender_not_recipient CHECK (sender_id != recipient_id)
      );

      CREATE INDEX IF NOT EXISTS idx_recipient_created ON kudos(recipient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sender_created ON kudos(sender_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_created_at ON kudos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_is_flagged ON kudos(is_flagged);
      CREATE INDEX IF NOT EXISTS idx_is_visible ON kudos(is_visible);
    `
  },
  {
    id: '002_create_kudos_flags_table',
    sql: `
      CREATE TABLE IF NOT EXISTS kudos_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kudos_id UUID NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(50) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(kudos_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_flags_kudos_id ON kudos_flags(kudos_id);
      CREATE INDEX IF NOT EXISTS idx_flags_created_at ON kudos_flags(created_at);
    `
  },
  {
    id: '003_create_notifications_table',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kudos_id UUID NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON notifications(user_id, is_read);
    `
  },
  {
    id: '004_create_notification_preferences_table',
    sql: `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        email_on_kudos BOOLEAN DEFAULT TRUE,
        email_frequency VARCHAR(20) DEFAULT 'daily',
        in_app_notifications BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    id: '005_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    id: '006_create_moderation_audit_logs_table',
    sql: `
      CREATE TABLE IF NOT EXISTS moderation_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kudos_id UUID NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
        admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL CHECK (action IN ('hide', 'delete')),
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_moderation_audit_kudos ON moderation_audit_logs(kudos_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moderation_audit_admin ON moderation_audit_logs(admin_user_id, created_at DESC);
    `
  }
];

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const migration of migrations) {
      // Check if migration has already been run
      const result = await query('SELECT id FROM migrations WHERE id = $1', [migration.id]);

      if (result.rows.length === 0) {
        logger.info(`Running migration: ${migration.id}`);
        await query(migration.sql);
        await query('INSERT INTO migrations (id) VALUES ($1)', [migration.id]);
        logger.info(`✓ Migration ${migration.id} completed`);
      } else {
        logger.info(`⊘ Migration ${migration.id} already executed`);
      }
    }

    logger.info('✓ All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migrations failed:', error);
      process.exit(1);
    });
}

export default runMigrations;
