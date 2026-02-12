import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';

const router = Router();

// List API keys for tenant (mask key values showing only last 8 chars)
router.get('/', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const apiKeys = await prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const masked = apiKeys.map((k) => ({
      ...k,
      key: '••••••••' + k.key.slice(-8),
      permissions: JSON.parse(k.permissions),
    }));

    res.json(masked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create API key
router.post('/', async (req: any, res) => {
  try {
    const { name, permissions, rateLimit, expiresAt } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
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

    // Return the full key only on creation (this is the only time it is visible)
    res.status(201).json({
      ...apiKey,
      permissions: JSON.parse(apiKey.permissions),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update API key (name, permissions, rateLimit, isActive)
router.put('/:id', async (req: any, res) => {
  try {
    const { name, permissions, rateLimit, isActive } = req.body;
    const data: any = {};

    if (name !== undefined) data.name = name;
    if (permissions !== undefined) data.permissions = JSON.stringify(permissions);
    if (rateLimit !== undefined) data.rateLimit = rateLimit;
    if (isActive !== undefined) data.isActive = isActive;

    const apiKey = await prisma.apiKey.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      ...apiKey,
      key: '••••••••' + apiKey.key.slice(-8),
      permissions: JSON.parse(apiKey.permissions),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete API key
router.delete('/:id', async (req: any, res) => {
  try {
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate an API key
router.post('/validate', async (req: any, res) => {
  try {
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

    res.json({
      valid: true,
      apiKey: {
        ...updated,
        key: '••••••••' + updated.key.slice(-8),
        permissions: JSON.parse(updated.permissions),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
