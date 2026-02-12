import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';

export const tenantRoutes = Router();

// Get current tenant
tenantRoutes.get('/current', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.tenantId === 'default') {
    return res.json({
      id: 'default',
      name: 'Development',
      slug: 'dev',
      plan: 'enterprise',
      ssoEnabled: false,
      ldapEnabled: false,
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    include: { _count: { select: { users: true, projects: true } } },
  });

  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  res.json({
    ...tenant,
    settings: JSON.parse(tenant.settings),
    ssoConfig: tenant.ssoConfig ? JSON.parse(tenant.ssoConfig) : null,
    ldapConfig: tenant.ldapConfig ? JSON.parse(tenant.ldapConfig) : null,
    userCount: tenant._count.users,
    projectCount: tenant._count.projects,
  });
});

// Update tenant settings (admin only)
tenantRoutes.put('/current', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, settings } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (settings !== undefined) data.settings = JSON.stringify(settings);

  const tenant = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data,
  });

  await createAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userName: req.user!.name,
    action: 'update',
    entity: 'tenant',
    entityId: tenant.id,
    entityName: tenant.name,
  });

  res.json({
    ...tenant,
    settings: JSON.parse(tenant.settings),
  });
});

// Get tenant usage/stats
tenantRoutes.get('/current/usage', requireAuth, async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  if (tenantId === 'default') {
    // Dev mode: count everything
    const [projects, ruleSets, rules, users, executions, workflows, adapters] = await Promise.all([
      prisma.project.count(),
      prisma.ruleSet.count(),
      prisma.rule.count(),
      0,
      prisma.executionLog.count(),
      prisma.workflow.count(),
      prisma.adapter.count(),
    ]);

    return res.json({ projects, ruleSets, rules, users, executions, workflows, adapters });
  }

  // Scoped by tenant through project relation
  const projects = await prisma.project.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  const [ruleSets, rules, users, executions, workflows, adapters] = await Promise.all([
    prisma.ruleSet.count({ where: { projectId: { in: projectIds } } }),
    prisma.rule.count({ where: { ruleSet: { projectId: { in: projectIds } } } }),
    prisma.user.count({ where: { tenantId } }),
    prisma.executionLog.count({ where: { ruleSet: { projectId: { in: projectIds } } } }),
    prisma.workflow.count({ where: { projectId: { in: projectIds } } }),
    prisma.adapter.count({ where: { projectId: { in: projectIds } } }),
  ]);

  res.json({
    projects: projects.length,
    ruleSets,
    rules,
    users,
    executions,
    workflows,
    adapters,
  });
});
