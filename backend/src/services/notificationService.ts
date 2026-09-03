import { query } from '../database/db.js';
import logger from '../utils/logger.js';

export interface Notification {
  id: string;
  user_id: string;
  kudos_id: string;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  sender_name?: string;
  message_preview?: string;
}

export async function createNotification(userId: string, kudosId: string): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, kudos_id)
       VALUES ($1, $2)`,
      [userId, kudosId]
    );
  } catch (error) {
    // Notifications must not make a successful kudos submission fail.
    logger.error('Failed to create notification:', error);
  }
}

export async function getNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const result = await query(
    `SELECT n.id, n.user_id, n.kudos_id, n.is_read, n.created_at, n.read_at,
            u.name AS sender_name, LEFT(k.message, 100) AS message_preview
     FROM notifications n
     JOIN kudos k ON k.id = n.kudos_id
     JOIN users u ON u.id = k.sender_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  return result.rowCount === 1;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return result.rows[0]?.count ?? 0;
}
