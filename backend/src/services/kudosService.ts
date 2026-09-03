import { query } from '../database/db.js';
import { deletePatternCache, getCache, setCacheWithTTL } from '../cache/redis.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from './notificationService.js';

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
  sender?: { id: string; name: string; avatar_url?: string };
  recipient?: { id: string; name: string; avatar_url?: string };
}

/** Remove HTML while preserving plain-text markdown markers such as **bold** and *italic*. */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export async function createKudos(senderId: string, recipientId: string, message: string, isAnonymous = false): Promise<KudosData> {
  const id = uuidv4();
  const now = new Date();
  const safeMessage = sanitizeMessage(message);

  if (safeMessage.length < 10 || safeMessage.length > 500) {
    throw new Error('Message must be between 10 and 500 characters after sanitization');
  }

  try {
    const result = await query(
      `INSERT INTO kudos (id, sender_id, recipient_id, message, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, senderId, recipientId, safeMessage, isAnonymous, now, now]
    );

    await Promise.all([
      deletePatternCache('kudos:feed:*'),
      deletePatternCache(`kudos:user:${recipientId}:received:*`),
      deletePatternCache(`kudos:user:${senderId}:sent:*`),
      createNotification(recipientId, id)
    ]);

    logger.info(`Kudos created: ${id} from ${senderId} to ${recipientId}`);
    return result.rows[0] as KudosData;
  } catch (error) {
    logger.error('Error creating kudos:', error);
    throw error;
  }
}

export async function getKudosFeed(page = 1, limit = 10, searchTerm?: string): Promise<{ data: KudosWithDetails[]; total: number; pages: number }> {
  const cacheKey = `kudos:feed:${page}:${limit}:${encodeURIComponent(searchTerm || '')}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const offset = (page - 1) * limit;
    const searchClause = searchTerm ? ' AND LOWER(u_recipient.name) LIKE LOWER($1)' : '';
    const countParams = searchTerm ? [`%${searchTerm}%`] : [];

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM kudos k
       JOIN users u_recipient ON k.recipient_id = u_recipient.id
       WHERE k.deleted_at IS NULL AND k.is_visible = TRUE${searchClause}`,
      countParams
    );
    const total = countResult.rows[0].total;

    const params: any[] = searchTerm ? [`%${searchTerm}%`, limit, offset] : [limit, offset];
    const limitParam = searchTerm ? '$2' : '$1';
    const offsetParam = searchTerm ? '$3' : '$2';

    const result = await query(
      `SELECT k.id, k.sender_id, k.recipient_id, k.message, k.is_anonymous, k.created_at, k.updated_at,
              k.is_flagged, k.is_visible, k.flag_count,
              u_sender.id AS sender_id_detail, u_sender.name AS sender_name, u_sender.avatar_url AS sender_avatar,
              u_recipient.id AS recipient_id_detail, u_recipient.name AS recipient_name, u_recipient.avatar_url AS recipient_avatar
       FROM kudos k
       LEFT JOIN users u_sender ON k.sender_id = u_sender.id
       JOIN users u_recipient ON k.recipient_id = u_recipient.id
       WHERE k.deleted_at IS NULL AND k.is_visible = TRUE${searchClause}
       ORDER BY k.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const response = { data: formatKudosResults(result.rows), total, pages: Math.ceil(total / limit) };
    await setCacheWithTTL(cacheKey, response, 300);
    return response;
  } catch (error) {
    logger.error('Error getting kudos feed:', error);
    throw error;
  }
}

export async function getKudosReceived(recipientId: string, page = 1, limit = 10, startDate?: string, endDate?: string) {
  return getPersonalKudos('recipient_id', recipientId, page, limit, startDate, endDate, 'received');
}

export async function getKudosSent(senderId: string, page = 1, limit = 10, startDate?: string, endDate?: string) {
  return getPersonalKudos('sender_id', senderId, page, limit, startDate, endDate, 'sent');
}

async function getPersonalKudos(column: 'recipient_id' | 'sender_id', userId: string, page: number, limit: number, startDate?: string, endDate?: string, cacheType = 'history') {
  const cacheKey = `kudos:user:${userId}:${cacheType}:${page}:${limit}:${startDate || ''}:${endDate || ''}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * limit;
  const conditions = [`k.${column} = $1`, 'k.deleted_at IS NULL'];
  const params: any[] = [userId];
  if (startDate) { params.push(startDate); conditions.push(`k.created_at >= $${params.length}`); }
  if (endDate) { params.push(endDate); conditions.push(`k.created_at <= $${params.length}`); }

  const count = await query(`SELECT COUNT(*)::int AS total FROM kudos k WHERE ${conditions.join(' AND ')}`, params);
  const total = count.rows[0].total;
  params.push(limit, offset);
  const result = await query(
    `SELECT k.id, k.sender_id, k.recipient_id, k.message, k.is_anonymous, k.created_at, k.updated_at,
            k.is_flagged, k.is_visible, k.flag_count,
            us.id AS sender_id_detail, us.name AS sender_name, us.avatar_url AS sender_avatar,
            ur.id AS recipient_id_detail, ur.name AS recipient_name, ur.avatar_url AS recipient_avatar
     FROM kudos k
     JOIN users us ON k.sender_id = us.id
     JOIN users ur ON k.recipient_id = ur.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY k.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const response = { data: formatKudosResults(result.rows), total, pages: Math.ceil(total / limit) };
  await setCacheWithTTL(cacheKey, response, 300);
  return response;
}

export async function flagKudos(kudosId: string, userId: string, reason: string, details?: string): Promise<{ id: string }> {
  const flagId = uuidv4();
  try {
    const existing = await query('SELECT id FROM kudos_flags WHERE kudos_id = $1 AND user_id = $2', [kudosId, userId]);
    if (existing.rows.length) throw new Error('You have already flagged this kudos');

    const target = await query('SELECT id FROM kudos WHERE id = $1 AND deleted_at IS NULL', [kudosId]);
    if (!target.rows.length) throw new Error('Kudos not found');

    await query(
      `INSERT INTO kudos_flags (id, kudos_id, user_id, reason, details) VALUES ($1, $2, $3, $4, $5)`,
      [flagId, kudosId, userId, reason, details || null]
    );
    await query(
      `UPDATE kudos SET flag_count = flag_count + 1, is_flagged = CASE WHEN flag_count + 1 >= 3 THEN TRUE ELSE is_flagged END WHERE id = $1`,
      [kudosId]
    );
    await deletePatternCache('kudos:feed:*');
    return { id: flagId };
  } catch (error) {
    logger.error('Error flagging kudos:', error);
    throw error;
  }
}

export async function getFlaggedKudos(page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  const count = await query(`SELECT COUNT(*)::int AS total FROM kudos WHERE is_flagged = TRUE`);
  const result = await query(
    `SELECT k.id, k.message, k.is_anonymous, k.created_at, k.is_visible, k.deleted_at, k.flag_count,
            ur.name AS recipient_name,
            us.name AS sender_name,
            COALESCE(json_agg(json_build_object('id', f.id, 'reason', f.reason, 'details', f.details, 'created_at', f.created_at))
              FILTER (WHERE f.id IS NOT NULL), '[]') AS flags
     FROM kudos k
     JOIN users ur ON ur.id = k.recipient_id
     JOIN users us ON us.id = k.sender_id
     LEFT JOIN kudos_flags f ON f.kudos_id = k.id
     WHERE k.is_flagged = TRUE
     GROUP BY k.id, ur.name, us.name
     ORDER BY k.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { data: result.rows, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) };
}

export async function hideKudos(kudosId: string, adminId: string, reason?: string): Promise<void> {
  await moderateKudos(kudosId, adminId, 'hide', reason);
}

export async function deleteKudos(kudosId: string, adminId: string, reason?: string): Promise<void> {
  await moderateKudos(kudosId, adminId, 'delete', reason);
}

async function moderateKudos(kudosId: string, adminId: string, action: 'hide' | 'delete', reason?: string) {
  const client = await (await import('../database/db.js')).getDbPool().connect();
  try {
    await client.query('BEGIN');
    const update = action === 'hide'
      ? `UPDATE kudos SET is_visible = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`
      : `UPDATE kudos SET deleted_at = CURRENT_TIMESTAMP, is_visible = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const result = await client.query(update, [kudosId]);
    if (!result.rows.length) throw new Error('Kudos not found');
    await client.query(
      `INSERT INTO moderation_audit_logs (kudos_id, admin_user_id, action, reason) VALUES ($1, $2, $3, $4)`,
      [kudosId, adminId, action, reason || null]
    );
    await client.query('COMMIT');
    await deletePatternCache('kudos:feed:*');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error moderating kudos (${action}):`, error);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOwnKudos(kudosId: string, userId: string): Promise<void> {
  const result = await query('SELECT sender_id, created_at FROM kudos WHERE id = $1 AND deleted_at IS NULL', [kudosId]);
  if (!result.rows.length) throw new Error('Kudos not found');
  if (result.rows[0].sender_id !== userId) throw new Error('You can only delete your own kudos');
  if ((Date.now() - new Date(result.rows[0].created_at).getTime()) / 3600000 > 24) {
    throw new Error('Can only delete kudos within 24 hours of submission');
  }
  await query('UPDATE kudos SET deleted_at = CURRENT_TIMESTAMP, is_visible = FALSE WHERE id = $1', [kudosId]);
  await deletePatternCache('kudos:feed:*');
  await deletePatternCache(`kudos:user:${userId}:sent:*`);
}

function formatKudosResults(rows: any[]): KudosWithDetails[] {
  return rows.map(row => ({
    id: row.id, sender_id: row.sender_id, recipient_id: row.recipient_id, message: row.message,
    is_anonymous: row.is_anonymous, created_at: row.created_at, updated_at: row.updated_at,
    is_flagged: row.is_flagged, is_visible: row.is_visible, flag_count: row.flag_count,
    sender: row.is_anonymous ? undefined : { id: row.sender_id_detail, name: row.sender_name, avatar_url: row.sender_avatar },
    recipient: { id: row.recipient_id_detail, name: row.recipient_name, avatar_url: row.recipient_avatar }
  }));
}
