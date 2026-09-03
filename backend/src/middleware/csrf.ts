import { Request, Response, NextFunction } from 'express';

/**
 * Origin check for browser state-changing requests.
 * The API uses Bearer tokens rather than cookie authentication, so this is a
 * lightweight CSRF defence that rejects cross-origin browser submissions.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!origin && !referer) return next(); // non-browser clients such as curl

  let source: string;
  try { source = origin || new URL(referer as string).origin; }
  catch { return res.status(403).json({ error: 'Invalid request origin' }); }
  if (source !== allowedOrigin) {
    return res.status(403).json({ error: 'Cross-origin request blocked' });
  }

  next();
}
