import { Router } from 'express';
import { prisma } from '../prisma';

export const ruleSetRoutes = Router();

// List rule sets (optionally filtered by project)
ruleSetRoutes.get('/', async (req, res) => {
  const { projectId } = req.query;
  const where = projectId ? { projectId: String(projectId) } : {};
  const ruleSets = await prisma.ruleSet.findMany({
    where,
    include: {
      _count: { select: { rules: true, decisionTables: true } },
      inputModel: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(ruleSets);
});

// Get single rule set with all children
ruleSetRoutes.get('/:id', async (req, res) => {
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: req.params.id },
    include: {
      rules: { orderBy: { priority: 'desc' } },
      decisionTables: { orderBy: { createdAt: 'asc' } },
      inputModel: true,
      versions: { orderBy: { version: 'desc' }, take: 10 },
    },
  });
  if (!ruleSet) return res.status(404).json({ error: 'Rule set not found' });
  res.json(ruleSet);
});

// Create rule set
ruleSetRoutes.post('/', async (req, res) => {
  const { projectId, name, description, inputModelId } = req.body;
  if (!projectId || !name) {
    return res.status(400).json({ error: 'projectId and name are required' });
  }
  const ruleSet = await prisma.ruleSet.create({
    data: { projectId, name, description: description || '', inputModelId },
  });
  res.status(201).json(ruleSet);
});

// Update rule set
ruleSetRoutes.put('/:id', async (req, res) => {
  const { name, description, status, inputModelId } = req.body;
  const ruleSet = await prisma.ruleSet.update({
    where: { id: req.params.id },
    data: { name, description, status, inputModelId },
  });
  res.json(ruleSet);
});

// Delete rule set
ruleSetRoutes.delete('/:id', async (req, res) => {
  await prisma.ruleSet.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
