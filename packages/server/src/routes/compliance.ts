import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// List compliance frameworks for tenant
router.get('/', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const frameworks = await prisma.complianceFramework.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const parsed = frameworks.map((f) => ({
      ...f,
      requirements: JSON.parse(f.requirements),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single framework with requirements
router.get('/:id', async (req: any, res) => {
  try {
    const framework = await prisma.complianceFramework.findUnique({
      where: { id: req.params.id },
    });

    if (!framework) {
      return res.status(404).json({ error: 'Compliance framework not found' });
    }

    res.json({
      ...framework,
      requirements: JSON.parse(framework.requirements),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create compliance framework
router.post('/', async (req: any, res) => {
  try {
    const { name, framework, description, requirements, retentionDays } =
      req.body;

    if (!name || !framework) {
      return res
        .status(400)
        .json({ error: 'name and framework are required' });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

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
      requirements: JSON.parse(created.requirements),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update compliance framework
router.put('/:id', async (req: any, res) => {
  try {
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
      requirements: JSON.parse(updated.requirements),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete compliance framework
router.delete('/:id', async (req: any, res) => {
  try {
    await prisma.complianceFramework.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Certify a framework
router.post('/:id/certify', async (req: any, res) => {
  try {
    const framework = await prisma.complianceFramework.findUnique({
      where: { id: req.params.id },
    });

    if (!framework) {
      return res.status(404).json({ error: 'Compliance framework not found' });
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
      requirements: JSON.parse(updated.requirements),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get audit trail within the framework's retention period
router.get('/:id/audit-trail', async (req: any, res) => {
  try {
    const framework = await prisma.complianceFramework.findUnique({
      where: { id: req.params.id },
    });

    if (!framework) {
      return res.status(404).json({ error: 'Compliance framework not found' });
    }

    // Calculate the retention window
    const retentionStart = new Date();
    retentionStart.setDate(
      retentionStart.getDate() - framework.retentionDays
    );

    const where: any = {
      createdAt: { gte: retentionStart },
    };

    // Scope to tenant if available
    if (framework.tenantId) {
      where.tenantId = framework.tenantId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    res.json({
      frameworkId: framework.id,
      frameworkName: framework.name,
      retentionDays: framework.retentionDays,
      retentionStart: retentionStart.toISOString(),
      totalLogs: parsed.length,
      logs: parsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
