import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

const router = Router();

// List API keys for tenant (mask key values showing only last 8 chars)
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const apiKeys = await prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  // Never return the full key value -- only show last 8 chars
  const masked = apiKeys.map((k) => ({
    ...k,
    key: '••••••••' + k.key.slice(-8),
    permissions: safeJsonParse(k.permissions, []),
  }));

  res.json(masked);
}));

// Create API key
router.post('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['name']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, permissions, rateLimit, expiresAt } = req.body;

  // Validate permissions is array if provided
  if (permissions !== undefined && !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions must be an array' });
  }

  // Validate rateLimit is a positive number if provided
  if (rateLimit !== undefined && (typeof rateLimit !== 'number' || rateLimit <= 0)) {
    return res.status(400).json({ error: 'rateLimit must be a positive number' });
  }

  // Generate a long random key
  const key = crypto.randomUUID() + crypto.randomUUID();

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      name,
      key,
      permissions: JSON.stringify(permissions || []),
      rateLimit: rateLimit || 1000,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return the full key ONLY on creation (this is the only time it is visible)
  res.status(201).json({
    ...apiKey,
    permissions: safeJsonParse(apiKey.permissions, []),
  });
}));

// Update API key (name, permissions, rateLimit, isActive)
router.put('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify the API key belongs to tenant
  const existing = await prisma.apiKey.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'API key not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, permissions, rateLimit, isActive } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }
    data.permissions = JSON.stringify(permissions);
  }
  if (rateLimit !== undefined) {
    if (typeof rateLimit !== 'number' || rateLimit <= 0) {
      return res.status(400).json({ error: 'rateLimit must be a positive number' });
    }
    data.rateLimit = rateLimit;
  }
  if (isActive !== undefined) data.isActive = isActive;

  const apiKey = await prisma.apiKey.update({
    where: { id: req.params.id },
    data,
  });

  // Never return full key on update
  res.json({
    ...apiKey,
    key: '••••••••' + apiKey.key.slice(-8),
    permissions: safeJsonParse(apiKey.permissions, []),
  });
}));

// Delete API key
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify the API key belongs to tenant
  const existing = await prisma.apiKey.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'API key not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.apiKey.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Validate an API key
router.post('/validate', asyncHandler(async (req: any, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'key is required' });
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { key } });

  if (!apiKey) {
    return res.status(404).json({ valid: false, error: 'API key not found' });
  }

  if (!apiKey.isActive) {
    return res
      .status(403)
      .json({ valid: false, error: 'API key is inactive' });
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return res
      .status(403)
      .json({ valid: false, error: 'API key has expired' });
  }

  // Increment usage count and update lastUsedAt
  const updated = await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  // Never return full key on validate
  res.json({
    valid: true,
    apiKey: {
      ...updated,
      key: '••••••••' + updated.key.slice(-8),
      permissions: safeJsonParse(updated.permissions, []),
    },
  });
}));

export default router;
