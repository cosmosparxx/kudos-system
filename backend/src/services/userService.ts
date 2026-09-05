import { query } from '../database/db.js';
import logger from '../utils/logger.js';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  department?: string;
  role?: string;
  created_at?: string;
}

/**
 * Search for users by name or email
 * Excludes the specified user from results
 */
export async function searchUsers(
  searchTerm: string,
  excludeUserId?: string,
  limit: number = 10
): Promise<User[]> {
  try {
    const searchPattern = `%${searchTerm}%`;
    
    let sql = `
      SELECT 
        id, 
        name, 
        email, 
        avatar_url, 
        department,
        role,
        created_at
      FROM users
      WHERE (
        LOWER(name) LIKE LOWER($1) 
        OR LOWER(email) LIKE LOWER($1)
      )
    `;

    const params: any[] = [searchPattern];

    if (excludeUserId) {
      sql += ` AND id != $${params.length + 1}`;
      params.push(excludeUserId);
    }

    sql += ` ORDER BY name ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows as User[];
  } catch (error) {
    logger.error('Error searching users:', error);
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await query(
      `SELECT id, name, email, avatar_url, department, role, created_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting user:', error);
    throw error;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await query(
      `SELECT id, name, email, avatar_url, department, role, created_at 
       FROM users 
       WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting user by email:', error);
    throw error;
  }
}

/**
 * Get multiple users by IDs
 */
export async function getUsersByIds(userIds: string[]): Promise<User[]> {
  try {
    if (userIds.length === 0) {
      return [];
    }

    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `SELECT id, name, email, avatar_url, department, created_at 
       FROM users 
       WHERE id IN (${placeholders})`,
      userIds
    );
    return result.rows as User[];
  } catch (error) {
    logger.error('Error getting users by IDs:', error);
    throw error;
  }
}

/**
 * Get user stats (kudos received count, etc.)
 * To be expanded as more data is needed
 */
export async function getUserStats(userId: string) {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as kudos_received
       FROM kudos
       WHERE recipient_id = $1 
       AND deleted_at IS NULL
       AND is_visible = TRUE`,
      [userId]
    );
    return result.rows[0] || { kudos_received: 0 };
  } catch (error) {
    logger.error('Error getting user stats:', error);
    throw error;
  }
}

/**
 * Verify that sender and recipient are different and exist
 */
export async function validateKudosUsers(senderId: string, recipientId: string): Promise<boolean> {
  try {
    if (senderId === recipientId) {
      logger.warn('Attempt to send kudos to self');
      return false;
    }

    const result = await query(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE id = $1 OR id = $2`,
      [senderId, recipientId]
    );

    return parseInt(result.rows[0].count, 10) === 2;
  } catch (error) {
    logger.error('Error validating kudos users:', error);
    throw error;
  }
}

/**
 * Get user role
 */
export async function getUserRole(userId: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.role || null;
  } catch (error) {
    logger.error('Error getting user role:', error);
    throw error;
  }
}

/**
 * Create or upsert user
 */
export async function createUser(userData: {
  name: string;
  email: string;
  role?: string;
  department?: string;
}): Promise<User> {
  try {
    const role = userData.role || 'user';
    const department = userData.department || 'Engineering';
    const result = await query(
      `INSERT INTO users (name, email, role, department)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING id, name, email, avatar_url, department, role, created_at`,
      [userData.name, userData.email, role, department]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
}
