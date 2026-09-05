import { Router, Request, Response } from 'express';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { getUserById, getUserByEmail, getUserStats, createUser } from '../services/userService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/users/login
 * User login by email
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    let user = await getUserByEmail(email);
    if (!user) {
      const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
      user = await createUser({ name, email, role });
    }
    const token = generateToken(user.id, user.email, user.name);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Error logging in user:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

/**
 * GET /api/v1/users/me/profile
 * Get current user profile
 *
 * IMPORTANT:
 * This route must come BEFORE /:user_id
 */
router.get(
  '/me/profile',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const userId = req.user.id;

      const user = await getUserById(userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const stats = await getUserStats(userId);

      res.json({
        ...user,
        stats
      });
    } catch (error) {
      logger.error('Error fetching current user:', error);

      res.status(500).json({
        error: 'Failed to fetch user profile'
      });
    }
  }
);

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
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const stats = await getUserStats(user_id);

      res.json({
        ...user,
        stats
      });
    } catch (error) {
      logger.error('Error fetching user:', error);

      res.status(500).json({
        error: 'Failed to fetch user'
      });
    }
  }
);

export default router;
