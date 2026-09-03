import { Router, Request, Response } from 'express';
import {
  createKudos, getKudosFeed, getKudosReceived, getKudosSent, flagKudos,
  hideKudos, deleteKudos, deleteOwnKudos, getFlaggedKudos
} from '../services/kudosService.js';
import { searchUsers, validateKudosUsers } from '../services/userService.js';
import { getNotifications, markNotificationRead, getUnreadCount } from '../services/notificationService.js';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';
import { kudosRateLimiter } from '../middleware/rateLimiter.js';
import { validate, validateQuery, validateParams, kudosSubmitSchema, kudosFlagSchema, paginationSchema, userSearchSchema, kudosIdParamsSchema, notificationIdParamsSchema } from '../utils/validation.js';
import logger from '../utils/logger.js';

const router = Router();

router.post('/submit', authenticateToken, kudosRateLimiter, validate(kudosSubmitSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { recipient_id, message, is_anonymous } = req.body;
    const sender_id = req.user.id;
    if (!(await validateKudosUsers(sender_id, recipient_id))) {
      return res.status(400).json({ error: 'Invalid sender or recipient', details: 'Sender and recipient must be different users' });
    }
    const kudos = await createKudos(sender_id, recipient_id, message, is_anonymous);
    res.status(201).json(kudos);
  } catch (error) {
    logger.error('Error submitting kudos:', error);
    res.status(500).json({ error: 'Failed to submit kudos' });
  }
});

router.get('/feed', validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const search = req.query.search as string | undefined;
    const result = await getKudosFeed(page, limit, search);
    res.json({ data: result.data, pagination: { page, limit, total: result.total, total_pages: result.pages } });
  } catch (error) {
    logger.error('Error fetching kudos feed:', error);
    res.status(500).json({ error: 'Failed to fetch kudos feed' });
  }
});

router.get('/me/received', authenticateToken, validateQuery(paginationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await getKudosReceived(req.user.id, Number(req.query.page || 1), Number(req.query.limit || 10), req.query.start_date as string, req.query.end_date as string);
    res.json({ data: result.data, pagination: { page: Number(req.query.page || 1), limit: Number(req.query.limit || 10), total: result.total, total_pages: result.pages } });
  } catch (error) { logger.error('Error fetching received kudos:', error); res.status(500).json({ error: 'Failed to fetch received kudos' }); }
});

router.get('/me/sent', authenticateToken, validateQuery(paginationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await getKudosSent(req.user.id, Number(req.query.page || 1), Number(req.query.limit || 10), req.query.start_date as string, req.query.end_date as string);
    res.json({ data: result.data, pagination: { page: Number(req.query.page || 1), limit: Number(req.query.limit || 10), total: result.total, total_pages: result.pages } });
  } catch (error) { logger.error('Error fetching sent kudos:', error); res.status(500).json({ error: 'Failed to fetch sent kudos' }); }
});

router.get('/users/search', authenticateToken, validateQuery(userSearchSchema), async (req: AuthRequest, res: Response) => {
  try {
    const users = await searchUsers(req.query.q as string, req.user.id, Number(req.query.limit || 10));
    res.json({ data: users });
  } catch (error) { logger.error('Error searching users:', error); res.status(500).json({ error: 'Failed to search users' }); }
});

router.get('/notifications', authenticateToken, async (req: AuthRequest, res: Response) => {
  try { res.json({ data: await getNotifications(req.user.id, 30) }); }
  catch (error) { logger.error('Error fetching notifications:', error); res.status(500).json({ error: 'Failed to fetch notifications' }); }
});

router.get('/notifications/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try { res.json({ count: await getUnreadCount(req.user.id) }); }
  catch (error) { logger.error('Error fetching notification count:', error); res.status(500).json({ error: 'Failed to fetch notification count' }); }
});

router.post('/notifications/:id/read', authenticateToken, validateParams(notificationIdParamsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await markNotificationRead(req.params.id, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.status(204).send();
  } catch (error) { logger.error('Error marking notification read:', error); res.status(500).json({ error: 'Failed to mark notification read' }); }
});

router.post('/:kudos_id/flag', authenticateToken, validateParams(kudosIdParamsSchema), validate(kudosFlagSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await flagKudos(req.params.kudos_id, req.user.id, req.body.reason, req.body.details);
    res.status(201).json({ ...result, kudos_id: req.params.kudos_id });
  } catch (error: any) {
    if (error.message === 'You have already flagged this kudos') return res.status(409).json({ error: error.message });
    if (error.message === 'Kudos not found') return res.status(404).json({ error: error.message });
    logger.error('Error flagging kudos:', error); res.status(500).json({ error: 'Failed to flag kudos' });
  }
});

router.delete('/:kudos_id', authenticateToken, validateParams(kudosIdParamsSchema), async (req: AuthRequest, res: Response) => {
  try { await deleteOwnKudos(req.params.kudos_id, req.user.id); res.status(204).send(); }
  catch (error: any) {
    if (error.message.includes('only delete') || error.message.includes('within 24')) return res.status(403).json({ error: error.message });
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    logger.error('Error deleting own kudos:', error); res.status(500).json({ error: 'Failed to delete kudos' });
  }
});

router.get('/admin/flagged', authenticateToken, requireAdmin, validateQuery(paginationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await getFlaggedKudos(Number(req.query.page || 1), Number(req.query.limit || 10));
    res.json({ data: result.data, pagination: { page: Number(req.query.page || 1), limit: Number(req.query.limit || 10), total: result.total, total_pages: result.pages } });
  } catch (error) { logger.error('Error fetching flagged kudos:', error); res.status(500).json({ error: 'Failed to fetch flagged kudos' }); }
});

router.post('/admin/:kudos_id/hide', authenticateToken, requireAdmin, validateParams(kudosIdParamsSchema), async (req: AuthRequest, res: Response) => {
  try { await hideKudos(req.params.kudos_id, req.user.id, req.body.reason); res.json({ message: 'Kudos hidden successfully', kudos_id: req.params.kudos_id }); }
  catch (error: any) { if (error.message === 'Kudos not found') return res.status(404).json({ error: error.message }); logger.error('Error hiding kudos:', error); res.status(500).json({ error: 'Failed to hide kudos' }); }
});

router.post('/admin/:kudos_id/delete', authenticateToken, requireAdmin, validateParams(kudosIdParamsSchema), async (req: AuthRequest, res: Response) => {
  try { await deleteKudos(req.params.kudos_id, req.user.id, req.body.reason); res.json({ message: 'Kudos deleted successfully', kudos_id: req.params.kudos_id }); }
  catch (error: any) { if (error.message === 'Kudos not found') return res.status(404).json({ error: error.message }); logger.error('Error deleting kudos:', error); res.status(500).json({ error: 'Failed to delete kudos' }); }
});

export default router;
