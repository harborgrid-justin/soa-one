import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Default API rate limiter — 100 requests per 15 minutes per IP.
 * Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS env vars.
 */
export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers (RFC 6585)
  legacyHeaders: false,  // Disable `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For behind load balancer, fall back to socket IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000),
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/v1/health';
  },
});

/**
 * Stricter rate limiter for authentication endpoints — 20 requests per 15 minutes.
 * Prevents brute-force attacks on login/register.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please wait before trying again.',
      retryAfter: 900,
    });
  },
});

/**
 * Rate limiter for rule execution endpoints — 500 requests per 15 minutes.
 * Higher limit since execution is the core value of the platform.
 */
export const executionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Execution rate limit exceeded',
      message: 'Too many execution requests. Please try again later.',
      retryAfter: 900,
    });
  },
});
