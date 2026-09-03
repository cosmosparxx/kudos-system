import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../cache/redis.js';
import logger from '../utils/logger.js';
import { config } from 'dotenv';

config();

const KUDOS_PER_USER_PER_DAY = parseInt(process.env.KUDOS_PER_USER_PER_DAY || '50');

/**
 * Rate limiter for kudos submission
 * Limits each user to KUDOS_PER_USER_PER_DAY submissions per 24 hours
 */
export async function kudosRateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    // If no user (unauthenticated), allow to proceed (will be rejected by auth middleware)
    if (!req.user) {
      return next();
    }

    const redisClient = getRedisClient();
    const userId = req.user.id;
    const rateLimitKey = `kudos:submissions:${userId}`;
    const today = new Date().toISOString().split('T')[0];
    const dayKey = `${rateLimitKey}:${today}`;

    // Get current submission count for today
    const currentCount = await redisClient.get(dayKey);
    const submissionCount = currentCount ? parseInt(currentCount) : 0;

    if (submissionCount >= KUDOS_PER_USER_PER_DAY) {
      logger.warn(`Rate limit exceeded for user ${userId}`);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${KUDOS_PER_USER_PER_DAY} kudos per day allowed`,
        retryAfter: calculateRetryAfter()
      });
    }

    // Increment counter and set expiration to end of day
    const secondsUntilMidnight = calculateSecondsUntilMidnight();
    await redisClient.incr(dayKey);
    await redisClient.expire(dayKey, secondsUntilMidnight + 60); // +60 seconds buffer

    // Attach remaining count to response headers
    const remaining = KUDOS_PER_USER_PER_DAY - (submissionCount + 1);
    res.setHeader('X-Kudos-Remaining', remaining.toString());
    res.setHeader('X-Kudos-Limit', KUDOS_PER_USER_PER_DAY.toString());
    res.setHeader('X-Kudos-Reset', Math.ceil((Date.now() + secondsUntilMidnight * 1000) / 1000).toString());

    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    // Fail closed: Redis is required for enforcing the abuse-prevention limit.
    return res.status(503).json({ error: 'Rate limiting service unavailable' });
  }
}

/**
 * Calculate seconds until end of day (midnight UTC)
 */
function calculateSecondsUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
}

/**
 * Calculate retry-after value in seconds
 */
function calculateRetryAfter(): number {
  return calculateSecondsUntilMidnight();
}
