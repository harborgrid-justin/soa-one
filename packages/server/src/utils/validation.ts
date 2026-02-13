import { Request, Response, NextFunction } from 'express';

/**
 * Safe JSON parse — returns parsed value or fallback (never throws).
 */
export function safeJsonParse(value: string | null | undefined, fallback: any = null): any {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Extract tenant ID from request, throw 403 if missing.
 */
export function requireTenantId(req: any): string {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    const err: any = new Error('Tenant context required');
    err.statusCode = 403;
    throw err;
  }
  return tenantId;
}

/**
 * Extract user ID from request, throw 401 if missing.
 */
export function requireUserId(req: any): string {
  const userId = req.user?.id;
  if (!userId) {
    const err: any = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  return userId;
}

/**
 * Validate required fields exist in the request body.
 * Returns an error message string or null if valid.
 */
export function validateRequired(body: any, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Verify an entity exists and optionally belongs to a tenant.
 * Returns the entity or null.
 */
export async function verifyEntityOwnership(
  prismaModel: any,
  entityId: string,
  tenantId?: string,
): Promise<any | null> {
  const where: any = { id: entityId };
  // Check direct tenantId
  const entity = await prismaModel.findUnique({ where });
  if (!entity) return null;
  // If entity has tenantId, verify ownership
  if (tenantId && entity.tenantId && entity.tenantId !== tenantId) return null;
  return entity;
}

/**
 * Wrap an async route handler with error handling.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err: any) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message || 'Internal server error' });
    });
  };
}
