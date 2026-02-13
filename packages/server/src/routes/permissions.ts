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

// List all permissions for tenant
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const permissions = await prisma.permission.findMany({
    where: { tenantId },
    orderBy: [{ role: 'asc' }, { resource: 'asc' }],
  });

  const parsed = permissions.map((p) => ({
    ...p,
    actions: safeJsonParse(p.actions, []),
  }));

  res.json(parsed);
}));

// Get permissions for a specific role
router.get('/role/:role', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const { role } = req.params;

  const permissions = await prisma.permission.findMany({
    where: { tenantId, role },
    orderBy: { resource: 'asc' },
  });

  const parsed = permissions.map((p) => ({
    ...p,
    actions: safeJsonParse(p.actions, []),
  }));

  res.json(parsed);
}));

// Create or update permission (upsert by role + resource)
router.post('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['role', 'resource', 'actions']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { role, resource, actions } = req.body;

  if (!Array.isArray(actions)) {
    return res.status(400).json({ error: 'actions must be an array' });
  }

  // Find existing permission for this role + resource combo
  const existing = await prisma.permission.findFirst({
    where: { tenantId, role, resource },
  });

  let permission;

  if (existing) {
    // Update existing permission
    permission = await prisma.permission.update({
      where: { id: existing.id },
      data: { actions: JSON.stringify(actions) },
    });
  } else {
    // Create new permission
    permission = await prisma.permission.create({
      data: {
        tenantId,
        role,
        resource,
        actions: JSON.stringify(actions),
      },
    });
  }

  res.status(existing ? 200 : 201).json({
    ...permission,
    actions: safeJsonParse(permission.actions, []),
  });
}));

// Delete permission
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const existing = await prisma.permission.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Permission not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.permission.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Check if current user has a specific permission
router.get('/check', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const { resource, action } = req.query;

  if (!resource || !action) {
    return res.status(400).json({ error: 'resource and action query parameters are required' });
  }

  const userRole = req.user?.role;

  if (!userRole) {
    return res.json({ allowed: false, reason: 'No role assigned' });
  }

  // Look up the permission for this role and resource
  const permission = await prisma.permission.findFirst({
    where: {
      tenantId,
      role: userRole,
      resource: String(resource),
    },
  });

  if (!permission) {
    return res.json({ allowed: false, reason: 'No permission found for role and resource' });
  }

  const actions = safeJsonParse(permission.actions, []);
  const allowed = actions.includes(String(action));

  res.json({
    allowed,
    role: userRole,
    resource: String(resource),
    action: String(action),
    grantedActions: actions,
  });
}));

// Seed default permissions for common roles
router.post('/seed-defaults', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const allResources = [
    'project',
    'ruleSet',
    'rule',
    'workflow',
    'adapter',
    'execution',
    'approval',
    'user',
  ];

  const allActions = ['create', 'read', 'update', 'delete', 'publish', 'execute', 'approve'];

  const defaults: { role: string; resource: string; actions: string[] }[] = [];

  // Admin: all actions on all resources
  for (const resource of allResources) {
    defaults.push({ role: 'admin', resource, actions: allActions });
  }

  // Editor: create, read, update on rules + workflows, plus execute
  const editorResources = ['ruleSet', 'rule', 'workflow'];
  for (const resource of editorResources) {
    defaults.push({ role: 'editor', resource, actions: ['create', 'read', 'update'] });
  }
  defaults.push({ role: 'editor', resource: 'execution', actions: ['create', 'read', 'execute'] });
  defaults.push({ role: 'editor', resource: 'project', actions: ['read', 'update'] });
  defaults.push({ role: 'editor', resource: 'adapter', actions: ['read'] });
  defaults.push({ role: 'editor', resource: 'approval', actions: ['read', 'create'] });
  defaults.push({ role: 'editor', resource: 'user', actions: ['read'] });

  // Viewer: read only on all resources
  for (const resource of allResources) {
    defaults.push({ role: 'viewer', resource, actions: ['read'] });
  }

  // Approver: read + approve
  for (const resource of allResources) {
    defaults.push({ role: 'approver', resource, actions: ['read'] });
  }
  defaults.push({ role: 'approver', resource: 'approval', actions: ['read', 'approve'] });
  defaults.push({ role: 'approver', resource: 'ruleSet', actions: ['read', 'approve'] });

  let created = 0;
  let updated = 0;

  for (const def of defaults) {
    const existing = await prisma.permission.findFirst({
      where: { tenantId, role: def.role, resource: def.resource },
    });

    if (existing) {
      await prisma.permission.update({
        where: { id: existing.id },
        data: { actions: JSON.stringify(def.actions) },
      });
      updated++;
    } else {
      await prisma.permission.create({
        data: {
          tenantId,
          role: def.role,
          resource: def.resource,
          actions: JSON.stringify(def.actions),
        },
      });
      created++;
    }
  }

  res.json({
    success: true,
    created,
    updated,
    total: defaults.length,
  });
}));

export default router;
