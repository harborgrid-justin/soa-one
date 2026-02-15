import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, type AuthRequest } from '../auth/middleware';

export const auditRoutes = Router();

interface AuditLogInput {
  tenantId?: string;
  userId?: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  entityName?: string;
  before?: string;
  after?: string;
  metadata?: string;
}

/** Helper to create an audit log entry (used throughout the app) */
export async function createAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({ data: input });
  } catch {
    // Audit logging should never break the main operation
  }
}

/** Audit middleware — wraps route handlers to auto-log mutations */
export function auditMiddleware(action: string, entity: string) {
  return (req: AuthRequest, _res: any, next: any) => {
    // Store audit context on the request for later use
    (req as any)._audit = { action, entity };
    next();
  };
}

// List audit logs (filtered by tenant)
auditRoutes.get('/', requireAuth, async (req: AuthRequest, res) => {
  const {
    limit = '50',
    offset = '0',
    action,
    entity,
    userId,
    entityId,
    startDate,
    endDate,
  } = req.query;

  const where: any = {};

  // Scope to tenant in production
  if (req.user!.tenantId !== 'default') {
    where.tenantId = req.user!.tenantId;
  }

  if (action) where.action = String(action);
  if (entity) where.entity = String(entity);
  if (userId) where.userId = String(userId);
  if (entityId) where.entityId = String(entityId);

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(String(startDate));
    if (endDate) where.createdAt.lte = new Date(String(endDate));
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      take: Number(limit),
      skip: Number(offset),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    }),
  ]);

  const parsed = logs.map((log) => ({
    ...log,
    before: log.before ? JSON.parse(log.before) : null,
    after: log.after ? JSON.parse(log.after) : null,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));

  res.json({ total, logs: parsed });
});

// Get audit log for a specific entity
auditRoutes.get('/entity/:entity/:entityId', requireAuth, async (req: AuthRequest, res) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: String(req.params.entity),
      entityId: String(req.params.entityId),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const parsed = logs.map((log) => ({
    ...log,
    before: log.before ? JSON.parse(log.before) : null,
    after: log.after ? JSON.parse(log.after) : null,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));

  res.json(parsed);
});

// Export audit logs as JSON (admin only)
auditRoutes.get('/export', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { startDate, endDate } = req.query;
  const where: any = {};

  if (req.user!.tenantId !== 'default') {
    where.tenantId = req.user!.tenantId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(String(startDate));
    if (endDate) where.createdAt.lte = new Date(String(endDate));
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.json`);
  res.json(logs);
});
