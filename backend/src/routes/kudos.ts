import { Router, Request, Response } from 'express';
import {
  createKudos,
  getKudosFeed,
  getKudosReceived,
  getKudosSent,
  flagKudos,
  hideKudos,
  deleteKudos,
  deleteOwnKudos
} from '../services/kudosService.js';
import { searchUsers, validateKudosUsers } from '../services/userService.js';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';
import { kudosRateLimiter } from '../middleware/rateLimiter.js';
import { validate, validateQuery, validateParams, kudosSubmitSchema, kudosFlagSchema, paginationSchema, userSearchSchema, userIdSchema } from '../utils/validation.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/kudos/submit
 * Submit a new kudos
 */
router.post(
  '/submit',
  authenticateToken,
  kudosRateLimiter,
  validate(kudosSubmitSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { recipient_id, message, is_anonymous } = req.body;
      const sender_id = req.user.id;

      if (sender_id === recipient_id) {
        return res.status(400).json({
          error: 'You cannot send kudos to yourself',
          details: 'Sender and recipient must be different users'
        });
      }

      // Validate that sender and recipient exist in database
      const usersValid = await validateKudosUsers(sender_id, recipient_id);
      if (!usersValid) {
        return res.status(400).json({
          error: 'Invalid sender or recipient',
          details: 'Both sender and recipient must exist in the system'
        });
      }

      const kudos = await createKudos(sender_id, recipient_id, message, is_anonymous);

      res.status(201).json({
        id: kudos.id,
        sender_id: kudos.sender_id,
        recipient_id: kudos.recipient_id,
        message: kudos.message,
        is_anonymous: kudos.is_anonymous,
        created_at: kudos.created_at
      });
    } catch (error) {
      logger.error('Error submitting kudos:', error);
      res.status(500).json({ error: 'Failed to submit kudos' });
    }
  }
);

/**
 * GET /api/v1/kudos/feed
 * Get recent kudos feed
 */
router.get(
  '/feed',
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    try {
      const page = req.query.page as any || 1;
      const limit = req.query.limit as any || 10;
      const search = req.query.search as string;

      const result = await getKudosFeed(page, limit, search);

      res.json({
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          total_pages: result.pages
        }
      });
    } catch (error) {
      logger.error('Error fetching kudos feed:', error);
      res.status(500).json({ error: 'Failed to fetch kudos feed' });
    }
  }
);

/**
 * GET /api/v1/kudos/me/received
 * Get kudos received by current user
 */
router.get(
  '/me/received',
  authenticateToken,
  validateQuery(paginationSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = req.query.page as any || 1;
      const limit = req.query.limit as any || 10;
      const userId = req.user.id;

      const result = await getKudosReceived(userId, page, limit);

      res.json({
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          total_pages: result.pages
        }
      });
    } catch (error) {
      logger.error('Error fetching received kudos:', error);
      res.status(500).json({ error: 'Failed to fetch received kudos' });
    }
  }
);

/**
 * GET /api/v1/kudos/me/sent
 * Get kudos sent by current user
 */
router.get(
  '/me/sent',
  authenticateToken,
  validateQuery(paginationSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = req.query.page as any || 1;
      const limit = req.query.limit as any || 10;
      const userId = req.user.id;

      const result = await getKudosSent(userId, page, limit);

      res.json({
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          total_pages: result.pages
        }
      });
    } catch (error) {
      logger.error('Error fetching sent kudos:', error);
      res.status(500).json({ error: 'Failed to fetch sent kudos' });
    }
  }
);

/**
 * GET /api/v1/kudos/users/search
 * Search for users (public endpoint)
 * IMPORTANT: Must come before /:kudos_id routes to avoid routing conflicts
 */
router.get(
  '/users/search',
  validateQuery(userSearchSchema),
  async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string;
      const limit = req.query.limit as any || 10;
      const excludeUserId = (req as AuthRequest).user?.id;

      const users = await searchUsers(q, excludeUserId, limit);

      res.json({
        data: users
      });
    } catch (error) {
      logger.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
);

/**
 * POST /api/v1/kudos/:kudos_id/flag
 * Report inappropriate kudos
 */
router.post(
  '/:kudos_id/flag',
  authenticateToken,
  validate(kudosFlagSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { kudos_id } = req.params;
      const { reason, details } = req.body;
      const userId = req.user.id;

      await flagKudos(kudos_id, userId, reason, details);

      res.status(201).json({
        message: 'Kudos flagged successfully',
        kudos_id
      });
    } catch (error: any) {
      logger.error('Error flagging kudos:', error);

      if (error.message === 'You have already flagged this kudos') {
        return res.status(409).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to flag kudos' });
    }
  }
);

/**
 * DELETE /api/v1/kudos/:kudos_id
 * Delete own kudos (within 24 hours)
 */
router.delete(
  '/:kudos_id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { kudos_id } = req.params;
      const userId = req.user.id;

      await deleteOwnKudos(kudos_id, userId);

      res.status(204).send();
    } catch (error: any) {
      logger.error('Error deleting kudos:', error);

      if (error.message.includes('only delete')) {
        return res.status(403).json({ error: error.message });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to delete kudos' });
    }
  }
);

/**
 * ADMIN ENDPOINTS
 */

/**
 * POST /api/v1/kudos/admin/:kudos_id/hide
 * Hide inappropriate kudos (admin)
 */
router.post(
  '/admin/:kudos_id/hide',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { kudos_id } = req.params;
      const { reason } = req.body;

      await hideKudos(kudos_id, reason);

      res.json({
        message: 'Kudos hidden successfully',
        kudos_id
      });
    } catch (error) {
      logger.error('Error hiding kudos:', error);
      res.status(500).json({ error: 'Failed to hide kudos' });
    }
  }
);

/**
 * POST /api/v1/kudos/admin/:kudos_id/delete
 * Permanently delete inappropriate kudos (admin)
 */
router.post(
  '/admin/:kudos_id/delete',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { kudos_id } = req.params;
      const { reason } = req.body;

      await deleteKudos(kudos_id, reason);

      res.json({
        message: 'Kudos deleted successfully',
        kudos_id
      });
    } catch (error) {
      logger.error('Error deleting kudos:', error);
      res.status(500).json({ error: 'Failed to delete kudos' });
    }
  }
);

export default router;
