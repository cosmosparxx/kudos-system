import { query } from '../database/db.js';
import { deletePatternCache } from '../cache/redis.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface KudosData {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  is_flagged: boolean;
  is_visible: boolean;
  flag_count: number;
}

export interface KudosWithDetails extends KudosData {
  sender?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  recipient?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

/**
 * Create a new kudos
 */
export async function createKudos(
  senderId: string,
  recipientId: string,
  message: string,
  isAnonymous: boolean = false
): Promise<KudosData> {
  try {
    const id = uuidv4();
    const now = new Date();

    const result = await query(
      `INSERT INTO kudos 
       (id, sender_id, recipient_id, message, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, senderId, recipientId, message, isAnonymous, now, now]
    );

    // Invalidate feed cache
    await deletePatternCache('kudos:feed:*');
    await deletePatternCache(`kudos:user:${recipientId}:received:*`);
    await deletePatternCache(`kudos:user:${senderId}:sent:*`);

    logger.info(`Kudos created: ${id} from ${senderId} to ${recipientId}`);
    return result.rows[0] as KudosData;
  } catch (error) {
    logger.error('Error creating kudos:', error);
    throw error;
  }
}

/**
 * Get kudos feed with pagination
 */
export async function getKudosFeed(
  page: number = 1,
  limit: number = 10,
  searchTerm?: string
): Promise<{ data: KudosWithDetails[]; total: number; pages: number }> {
  try {
    const offset = (page - 1) * limit;

    let countSql = `SELECT COUNT(*) as total FROM kudos WHERE deleted_at IS NULL AND is_visible = TRUE`;
    let dataSql = `
      SELECT 
        k.id, k.sender_id, k.recipient_id, k.message, 
        k.is_anonymous, k.created_at, k.updated_at,
        k.is_flagged, k.is_visible, k.flag_count,
        u_sender.id as sender_id_detail, u_sender.name as sender_name, u_sender.avatar_url as sender_avatar,
        u_recipient.id as recipient_id_detail, u_recipient.name as recipient_name, u_recipient.avatar_url as recipient_avatar
      FROM kudos k
      LEFT JOIN users u_sender ON k.sender_id = u_sender.id
      LEFT JOIN users u_recipient ON k.recipient_id = u_recipient.id
      WHERE k.deleted_at IS NULL AND k.is_visible = TRUE
    `;

    const params: any[] = [];

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      countSql += ` AND LOWER(u_recipient.name) LIKE LOWER($1)`;
      dataSql += ` AND LOWER(u_recipient.name) LIKE LOWER($${params.length + 1})`;
      params.push(searchPattern);
    }

    // Get total count
    const countResult = await query(countSql, params.length > 0 ? [params[0]] : []);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    dataSql += ` ORDER BY k.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(dataSql, params);

    const data: KudosWithDetails[] = result.rows.map((row: any) => ({
      id: row.id,
      sender_id: row.sender_id,
      recipient_id: row.recipient_id,
      message: row.message,
      is_anonymous: row.is_anonymous,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_flagged: row.is_flagged,
      is_visible: row.is_visible,
      flag_count: row.flag_count,
      sender: row.is_anonymous ? undefined : {
        id: row.sender_id_detail,
        name: row.sender_name,
        avatar_url: row.sender_avatar
      },
      recipient: {
        id: row.recipient_id_detail,
        name: row.recipient_name,
        avatar_url: row.recipient_avatar
      }
    }));

    const pages = Math.ceil(total / limit);

    return { data, total, pages };
  } catch (error) {
    logger.error('Error getting kudos feed:', error);
    throw error;
  }
}

/**
 * Get kudos received by a user
 */
export async function getKudosReceived(
  recipientId: string,
  page: number = 1,
  limit: number = 10
): Promise<{ data: KudosWithDetails[]; total: number; pages: number }> {
  try {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM kudos 
       WHERE recipient_id = $1 AND deleted_at IS NULL AND is_visible = TRUE`,
      [recipientId]
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      `SELECT 
        k.id, k.sender_id, k.recipient_id, k.message, 
        k.is_anonymous, k.created_at, k.updated_at,
        k.is_flagged, k.is_visible, k.flag_count,
        u_sender.id as sender_id_detail, u_sender.name as sender_name, u_sender.avatar_url as sender_avatar,
        u_recipient.id as recipient_id_detail, u_recipient.name as recipient_name, u_recipient.avatar_url as recipient_avatar
      FROM kudos k
      LEFT JOIN users u_sender ON k.sender_id = u_sender.id
      LEFT JOIN users u_recipient ON k.recipient_id = u_recipient.id
      WHERE k.recipient_id = $1 AND k.deleted_at IS NULL AND k.is_visible = TRUE
      ORDER BY k.created_at DESC
      LIMIT $2 OFFSET $3`,
      [recipientId, limit, offset]
    );

    const data = formatKudosResults(result.rows);
    const pages = Math.ceil(total / limit);

    return { data, total, pages };
  } catch (error) {
    logger.error('Error getting received kudos:', error);
    throw error;
  }
}

/**
 * Get kudos sent by a user
 */
export async function getKudosSent(
  senderId: string,
  page: number = 1,
  limit: number = 10
): Promise<{ data: KudosWithDetails[]; total: number; pages: number }> {
  try {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM kudos 
       WHERE sender_id = $1 AND deleted_at IS NULL`,
      [senderId]
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      `SELECT 
        k.id, k.sender_id, k.recipient_id, k.message, 
        k.is_anonymous, k.created_at, k.updated_at,
        k.is_flagged, k.is_visible, k.flag_count,
        u_sender.id as sender_id_detail, u_sender.name as sender_name, u_sender.avatar_url as sender_avatar,
        u_recipient.id as recipient_id_detail, u_recipient.name as recipient_name, u_recipient.avatar_url as recipient_avatar
      FROM kudos k
      LEFT JOIN users u_sender ON k.sender_id = u_sender.id
      LEFT JOIN users u_recipient ON k.recipient_id = u_recipient.id
      WHERE k.sender_id = $1 AND k.deleted_at IS NULL
      ORDER BY k.created_at DESC
      LIMIT $2 OFFSET $3`,
      [senderId, limit, offset]
    );

    const data = formatKudosResults(result.rows);
    const pages = Math.ceil(total / limit);

    return { data, total, pages };
  } catch (error) {
    logger.error('Error getting sent kudos:', error);
    throw error;
  }
}

/**
 * Flag a kudos as inappropriate
 */
export async function flagKudos(
  kudosId: string,
  userId: string,
  reason: string,
  details?: string
): Promise<{ id: string }> {
  try {
    const flagId = uuidv4();

    // Check if already flagged by this user
    const existingFlag = await query(
      `SELECT id FROM kudos_flags WHERE kudos_id = $1 AND user_id = $2`,
      [kudosId, userId]
    );

    if (existingFlag.rows.length > 0) {
      throw new Error('You have already flagged this kudos');
    }

    // Create flag record
    await query(
      `INSERT INTO kudos_flags (id, kudos_id, user_id, reason, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [flagId, kudosId, userId, reason, details || null, new Date()]
    );

    // Increment flag count on kudos
    const resultUpdate = await query(
      `UPDATE kudos 
       SET flag_count = flag_count + 1,
           is_flagged = CASE WHEN flag_count + 1 >= 3 THEN TRUE ELSE is_flagged END
       WHERE id = $1
       RETURNING id`,
      [kudosId]
    );

    logger.info(`Kudos ${kudosId} flagged by user ${userId} for reason: ${reason}`);

    return { id: resultUpdate.rows[0].id };
  } catch (error) {
    logger.error('Error flagging kudos:', error);
    throw error;
  }
}

/**
 * Hide kudos (admin moderation)
 */
export async function hideKudos(kudosId: string, reason?: string): Promise<void> {
  try {
    await query(
      `UPDATE kudos 
       SET is_visible = FALSE, updated_at = $2
       WHERE id = $1`,
      [kudosId, new Date()]
    );

    // Invalidate caches
    await deletePatternCache('kudos:feed:*');

    logger.info(`Kudos ${kudosId} hidden. Reason: ${reason || 'No reason provided'}`);
  } catch (error) {
    logger.error('Error hiding kudos:', error);
    throw error;
  }
}

/**
 * Permanently delete kudos (admin moderation)
 */
export async function deleteKudos(kudosId: string, reason?: string): Promise<void> {
  try {
    await query(
      `UPDATE kudos 
       SET deleted_at = $2
       WHERE id = $1`,
      [kudosId, new Date()]
    );

    // Invalidate caches
    await deletePatternCache('kudos:feed:*');

    logger.info(`Kudos ${kudosId} deleted (soft delete). Reason: ${reason || 'No reason provided'}`);
  } catch (error) {
    logger.error('Error deleting kudos:', error);
    throw error;
  }
}

/**
 * Delete own kudos (user initiated, within 24 hours)
 */
export async function deleteOwnKudos(kudosId: string, userId: string): Promise<void> {
  try {
    // Get the kudos to check sender and age
    const result = await query(
      `SELECT sender_id, created_at FROM kudos WHERE id = $1`,
      [kudosId]
    );

    if (result.rows.length === 0) {
      throw new Error('Kudos not found');
    }

    const { sender_id, created_at } = result.rows[0];

    if (sender_id !== userId) {
      throw new Error('You can only delete your own kudos');
    }

    const hoursOld = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60);
    if (hoursOld > 24) {
      throw new Error('Can only delete kudos within 24 hours of submission');
    }

    await deleteKudos(kudosId, 'User requested deletion within 24 hours');
  } catch (error) {
    logger.error('Error deleting own kudos:', error);
    throw error;
  }
}

/**
 * Helper to format kudos query results
 */
function formatKudosResults(rows: any[]): KudosWithDetails[] {
  return rows.map((row: any) => ({
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    message: row.message,
    is_anonymous: row.is_anonymous,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_flagged: row.is_flagged,
    is_visible: row.is_visible,
    flag_count: row.flag_count,
    sender: row.is_anonymous ? undefined : {
      id: row.sender_id_detail,
      name: row.sender_name,
      avatar_url: row.sender_avatar
    },
    recipient: {
      id: row.recipient_id_detail,
      name: row.recipient_name,
      avatar_url: row.recipient_avatar
    }
  }));
}
