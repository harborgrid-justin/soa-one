import { Router } from 'express';
import { prisma } from '../prisma';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

const router = Router();

// ============================================================
// Environments
// ============================================================

// List environments for tenant, ordered by `order`
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const environments = await prisma.environment.findMany({
    where: { tenantId },
    orderBy: { order: 'asc' },
  });

  res.json(environments);
}));

// Create environment
router.post('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['name', 'slug']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, slug, color, order } = req.body;

  const environment = await prisma.environment.create({
    data: {
      tenantId,
      name,
      slug,
      color: color || '#6366f1',
      order: order ?? 0,
    },
  });

  res.status(201).json(environment);
}));

// Update environment
router.put('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const existing = await prisma.environment.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Environment not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, slug, color, order, locked, isDefault } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (slug !== undefined) data.slug = slug;
  if (color !== undefined) data.color = color;
  if (order !== undefined) data.order = order;
  if (locked !== undefined) data.locked = locked;
  if (isDefault !== undefined) data.isDefault = isDefault;

  const updated = await prisma.environment.update({
    where: { id: req.params.id },
    data,
  });

  res.json(updated);
}));

// Delete environment (not if locked or has promotions)
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const existing = await prisma.environment.findUnique({
    where: { id: req.params.id },
    include: {
      promotions: { take: 1 },
      promotionTargets: { take: 1 },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Environment not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (existing.locked) {
    return res.status(400).json({ error: 'Cannot delete a locked environment' });
  }

  if (existing.promotions.length > 0 || existing.promotionTargets.length > 0) {
    return res.status(400).json({ error: 'Cannot delete an environment that has promotions' });
  }

  await prisma.environment.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ============================================================
// Promotions
// ============================================================

// Promote a rule set from one environment to another
router.post('/promote', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const error = validateRequired(req.body, ['ruleSetId', 'sourceEnvId', 'targetEnvId']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { ruleSetId, sourceEnvId, targetEnvId, notes } = req.body;

  // Verify both environments belong to this tenant
  const [sourceEnv, targetEnv] = await Promise.all([
    prisma.environment.findUnique({ where: { id: sourceEnvId } }),
    prisma.environment.findUnique({ where: { id: targetEnvId } }),
  ]);

  if (!sourceEnv || sourceEnv.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Source environment not found' });
  }

  if (!targetEnv || targetEnv.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Target environment not found' });
  }

  // Fetch the rule set with rules and decision tables
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: {
      rules: { orderBy: { priority: 'desc' } },
      decisionTables: true,
    },
  });

  if (!ruleSet) {
    return res.status(404).json({ error: 'Rule set not found' });
  }

  // Create a snapshot of the current rule set state
  const snapshot = JSON.stringify({
    id: ruleSet.id,
    name: ruleSet.name,
    description: ruleSet.description,
    version: ruleSet.version,
    status: ruleSet.status,
    rules: ruleSet.rules.map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      enabled: r.enabled,
      conditions: safeJsonParse(r.conditions, []),
      actions: safeJsonParse(r.actions, []),
    })),
    decisionTables: ruleSet.decisionTables.map((t) => ({
      id: t.id,
      name: t.name,
      columns: safeJsonParse(t.columns, []),
      rows: safeJsonParse(t.rows, []),
    })),
  });

  const promotion = await prisma.promotion.create({
    data: {
      tenantId,
      ruleSetId,
      sourceEnvId,
      targetEnvId,
      ruleSetVersion: ruleSet.version,
      snapshot,
      status: 'pending',
      promotedBy: userId,
      notes: notes || '',
    },
    include: {
      sourceEnv: true,
      targetEnv: true,
    },
  });

  res.status(201).json({
    ...promotion,
    snapshot: safeJsonParse(promotion.snapshot, {}),
  });
}));

// List promotions for tenant
router.get('/promotions', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const { status, ruleSetId } = req.query;
  const where: any = { tenantId };

  if (status) where.status = String(status);
  if (ruleSetId) where.ruleSetId = String(ruleSetId);

  const promotions = await prisma.promotion.findMany({
    where,
    include: {
      sourceEnv: true,
      targetEnv: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const parsed = promotions.map((p) => ({
    ...p,
    snapshot: safeJsonParse(p.snapshot, {}),
  }));

  res.json(parsed);
}));

// Approve a promotion
router.put('/promotions/:id/approve', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const promotion = await prisma.promotion.findUnique({
    where: { id: req.params.id },
    include: { sourceEnv: true, targetEnv: true },
  });

  if (!promotion) {
    return res.status(404).json({ error: 'Promotion not found' });
  }

  if (promotion.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (promotion.status !== 'pending') {
    return res.status(400).json({ error: `Promotion is already ${promotion.status}` });
  }

  const updated = await prisma.promotion.update({
    where: { id: req.params.id },
    data: {
      status: 'approved',
      approvedBy: userId,
      promotedAt: new Date(),
    },
    include: { sourceEnv: true, targetEnv: true },
  });

  res.json({
    ...updated,
    snapshot: safeJsonParse(updated.snapshot, {}),
  });
}));

// Reject a promotion
router.put('/promotions/:id/reject', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const promotion = await prisma.promotion.findUnique({
    where: { id: req.params.id },
  });

  if (!promotion) {
    return res.status(404).json({ error: 'Promotion not found' });
  }

  if (promotion.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (promotion.status !== 'pending') {
    return res.status(400).json({ error: `Promotion is already ${promotion.status}` });
  }

  const updated = await prisma.promotion.update({
    where: { id: req.params.id },
    data: { status: 'rejected' },
    include: { sourceEnv: true, targetEnv: true },
  });

  res.json({
    ...updated,
    snapshot: safeJsonParse(updated.snapshot, {}),
  });
}));

export default router;
