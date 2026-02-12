import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'soa-one-dev-secret-change-in-production';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/** Sign a JWT token for a user */
export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    JWT_SECRET,
    { expiresIn: '24h' },
  );
}

/** Verify and decode a JWT token */
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Auth middleware — extracts user from JWT Bearer token.
 * In dev mode, allows unauthenticated access with a default context.
 */
export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  // In development, if no auth, use a default user context
  if (!req.user && process.env.NODE_ENV !== 'production') {
    req.user = {
      id: 'dev-user',
      email: 'admin@soaone.local',
      name: 'Dev Admin',
      role: 'admin',
      tenantId: 'default',
    };
  }

  next();
}

/**
 * Require authentication — returns 401 if no user.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Require a specific role — returns 403 if insufficient permissions.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
