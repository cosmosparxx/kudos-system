import { Router, Request, Response } from 'express';
import { getUserByEmail, createUser } from '../services/userService.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Log in with user email and return JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user = await getUserByEmail(email);

    if (!user) {
      // Auto-create user if email provided so login always succeeds
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
    logger.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

export default router;

