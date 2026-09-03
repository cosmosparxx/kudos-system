import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserRole } from '../services/userService.js';
import logger from '../utils/logger.js';
import { config } from 'dotenv';

config();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return secret || 'development-only-secret-change-me';
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Check if user is admin
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = await getUserRole(req.user.id);
    if (role !== 'admin') {
      logger.warn(`Non-admin user ${req.user.id} attempted to access admin endpoint`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string, email: string, name: string): string {
  return jwt.sign(
    { id: userId, email, name },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
  );
}

/**
 * Verify token without Express middleware (for testing/utilities)
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
}
