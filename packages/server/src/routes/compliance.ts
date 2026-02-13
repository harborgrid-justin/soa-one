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

// List compliance frameworks for tenant
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const frameworks = await prisma.complianceFramework.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  const parsed = frameworks.map((f) => ({
    ...f,
    requirements: safeJsonParse(f.requirements, []),
  }));

  res.json(parsed);
}));

// Get a single framework with requirements
router.get('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const framework = await prisma.complianceFramework.findUnique({
    where: { id: req.params.id },
  });

  if (!framework) {
    return res.status(404).json({ error: 'Compliance framework not found' });
  }

  if (framework.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    ...framework,
    requirements: safeJsonParse(framework.requirements, []),
  });
}));

// Create compliance framework
router.post('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['name', 'framework']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, framework, description, requirements, retentionDays } =
    req.body;

  const created = await prisma.complianceFramework.create({
    data: {
      tenantId,
      name,
      framework,
      description: description || '',
      requirements: JSON.stringify(requirements || []),
      retentionDays: retentionDays || 2555,
    },
  });

  res.status(201).json({
    ...created,
    requirements: safeJsonParse(created.requirements, []),
  });
}));

// Update compliance framework
router.put('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify framework belongs to tenant
  const existing = await prisma.complianceFramework.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Compliance framework not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, framework, description, requirements, retentionDays, status } =
    req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (framework !== undefined) data.framework = framework;
  if (description !== undefined) data.description = description;
  if (requirements !== undefined)
    data.requirements = JSON.stringify(requirements);
  if (retentionDays !== undefined) data.retentionDays = retentionDays;
  if (status !== undefined) data.status = status;

  const updated = await prisma.complianceFramework.update({
    where: { id: req.params.id },
    data,
  });

  res.json({
    ...updated,
    requirements: safeJsonParse(updated.requirements, []),
  });
}));

// Delete compliance framework
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify framework belongs to tenant
  const existing = await prisma.complianceFramework.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Compliance framework not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.complianceFramework.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true });
}));

// Certify a framework
router.post('/:id/certify', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const framework = await prisma.complianceFramework.findUnique({
    where: { id: req.params.id },
  });

  if (!framework) {
    return res.status(404).json({ error: 'Compliance framework not found' });
  }

  if (framework.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updated = await prisma.complianceFramework.update({
    where: { id: req.params.id },
    data: {
      certifiedAt: new Date(),
      certifiedBy: req.user?.name || 'Unknown',
    },
  });

  res.json({
    ...updated,
    requirements: safeJsonParse(updated.requirements, []),
  });
}));

// Get audit trail within the framework's retention period
router.get('/:id/audit-trail', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const framework = await prisma.complianceFramework.findUnique({
    where: { id: req.params.id },
  });

  if (!framework) {
    return res.status(404).json({ error: 'Compliance framework not found' });
  }

  // Verify framework belongs to tenant
  if (framework.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Calculate the retention window
  const retentionStart = new Date();
  retentionStart.setDate(
    retentionStart.getDate() - framework.retentionDays
  );

  // Always filter audit trail by tenantId
  const where: any = {
    tenantId,
    createdAt: { gte: retentionStart },
  };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const parsed = logs.map((log) => ({
    ...log,
    before: safeJsonParse(log.before, null),
    after: safeJsonParse(log.after, null),
    metadata: safeJsonParse(log.metadata, null),
  }));

  res.json({
    frameworkId: framework.id,
    frameworkName: framework.name,
    retentionDays: framework.retentionDays,
    retentionStart: retentionStart.toISOString(),
    totalLogs: parsed.length,
    logs: parsed,
  });
}));

export default router;
