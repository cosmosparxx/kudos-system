import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getUserById, getUserStats } from '../services/userService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/users/:user_id
 * Get user profile
 */
router.get(
  '/:user_id',
  async (req: Request, res: Response) => {
    try {
      const { user_id } = req.params;

      const user = await getUserById(user_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const stats = await getUserStats(user_id);

      res.json({
        ...user,
        stats
      });
    } catch (error) {
      logger.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

/**
 * GET /api/v1/users/me/profile
 * Get current user profile
 */
router.get(
  '/me/profile',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;

      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const stats = await getUserStats(userId);

      res.json({
        ...user,
        stats
      });
    } catch (error) {
      logger.error('Error fetching current user:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  }
);

export default router;
