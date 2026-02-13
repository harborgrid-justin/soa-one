import { Router } from 'express';
import { prisma } from '../prisma';

export const versionRoutes = Router();

// Publish a rule set (create a version snapshot)
versionRoutes.post('/:ruleSetId/publish', async (req, res) => {
  const { ruleSetId } = req.params;
  const { changelog, publishedBy } = req.body;

  try {
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: ruleSetId },
      include: {
        rules: true,
        decisionTables: true,
      },
    });

    if (!ruleSet) return res.status(404).json({ error: 'Rule set not found' });

    const newVersion = ruleSet.version + 1;

    // Create snapshot
    const snapshot = {
      rules: ruleSet.rules.map((r) => ({
        ...r,
        conditions: JSON.parse(r.conditions),
        actions: JSON.parse(r.actions),
      })),
      decisionTables: ruleSet.decisionTables.map((t) => ({
        ...t,
        columns: JSON.parse(t.columns),
        rows: JSON.parse(t.rows),
      })),
    };

    // Create version and update rule set in a transaction
    const [version] = await prisma.$transaction([
      prisma.ruleSetVersion.create({
        data: {
          ruleSetId,
          version: newVersion,
          snapshot: JSON.stringify(snapshot),
          changelog: changelog || '',
          publishedBy: publishedBy || 'system',
        },
      }),
      prisma.ruleSet.update({
        where: { id: ruleSetId },
        data: { version: newVersion, status: 'published' },
      }),
    ]);

    res.status(201).json(version);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List versions for a rule set
versionRoutes.get('/:ruleSetId', async (req, res) => {
  const versions = await prisma.ruleSetVersion.findMany({
    where: { ruleSetId: req.params.ruleSetId },
    orderBy: { version: 'desc' },
  });
  const parsed = versions.map((v) => ({
    ...v,
    snapshot: JSON.parse(v.snapshot),
  }));
  res.json(parsed);
});

// Get a specific version
versionRoutes.get('/:ruleSetId/:version', async (req, res) => {
  const version = await prisma.ruleSetVersion.findFirst({
    where: {
      ruleSetId: req.params.ruleSetId,
      version: Number(req.params.version),
    },
  });
  if (!version) return res.status(404).json({ error: 'Version not found' });
  res.json({ ...version, snapshot: JSON.parse(version.snapshot) });
});

// Rollback to a specific version
versionRoutes.post('/:ruleSetId/rollback/:version', async (req, res) => {
  try {
    const version = await prisma.ruleSetVersion.findFirst({
      where: {
        ruleSetId: req.params.ruleSetId,
        version: Number(req.params.version),
      },
    });

    if (!version) return res.status(404).json({ error: 'Version not found' });

    const snapshot = JSON.parse(version.snapshot);

    // Delete current rules and tables, recreate from snapshot
    await prisma.$transaction([
      prisma.rule.deleteMany({ where: { ruleSetId: req.params.ruleSetId } }),
      prisma.decisionTable.deleteMany({ where: { ruleSetId: req.params.ruleSetId } }),
      ...snapshot.rules.map((r: any) =>
        prisma.rule.create({
          data: {
            id: r.id,
            ruleSetId: req.params.ruleSetId,
            name: r.name,
            description: r.description || '',
            priority: r.priority,
            conditions: JSON.stringify(r.conditions),
            actions: JSON.stringify(r.actions),
            enabled: r.enabled,
          },
        }),
      ),
      ...snapshot.decisionTables.map((t: any) =>
        prisma.decisionTable.create({
          data: {
            id: t.id,
            ruleSetId: req.params.ruleSetId,
            name: t.name,
            description: t.description || '',
            columns: JSON.stringify(t.columns),
            rows: JSON.stringify(t.rows),
          },
        }),
      ),
    ]);

    res.json({ success: true, restoredVersion: version.version });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
