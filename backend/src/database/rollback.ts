import { query } from './db.js';
import logger from '../utils/logger.js';

async function rollback() {
  const statements = [
    'DROP TABLE IF EXISTS moderation_audit_logs CASCADE',
    'DROP TABLE IF EXISTS notification_preferences CASCADE',
    'DROP TABLE IF EXISTS notifications CASCADE',
    'DROP TABLE IF EXISTS kudos_flags CASCADE',
    'DROP TABLE IF EXISTS kudos CASCADE',
    'DROP TABLE IF EXISTS users CASCADE',
    'DROP TABLE IF EXISTS migrations CASCADE'
  ];

  try {
    for (const statement of statements) await query(statement);
    logger.info('All Kudos migrations rolled back');
  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  }
}

rollback().catch(() => process.exit(1));
