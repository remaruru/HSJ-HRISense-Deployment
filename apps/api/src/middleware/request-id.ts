import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * A short, non-sensitive reference for every request. It goes back in the
 * `X-Request-Id` header and in the body of an unexpected-error response, and it
 * starts each server-side error log line — so when a user quotes
 * "Reference: 3F9A1C2B", that exact failure can be found in the log.
 *
 * Random, never derived from the user, the route or the time.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = crypto.randomBytes(4).toString('hex').toUpperCase();
  res.setHeader('X-Request-Id', req.id);
  next();
}
