import { Router } from 'express';
import { prisma } from '../prisma';

export const ruleRoutes = Router();

// List rules for a rule set
ruleRoutes.get('/', async (req, res) => {
  const { ruleSetId } = req.query;
  if (!ruleSetId) return res.status(400).json({ error: 'ruleSetId is required' });
  const rules = await prisma.rule.findMany({
    where: { ruleSetId: String(ruleSetId) },
    orderBy: { priority: 'desc' },
  });
  // Parse JSON fields
  const parsed = rules.map((r) => ({
    ...r,
    conditions: JSON.parse(r.conditions),
    actions: JSON.parse(r.actions),
  }));
  res.json(parsed);
});

// Get single rule
ruleRoutes.get('/:id', async (req, res) => {
  const rule = await prisma.rule.findUnique({ where: { id: req.params.id } });
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json({
    ...rule,
    conditions: JSON.parse(rule.conditions),
    actions: JSON.parse(rule.actions),
  });
});

// Create rule
ruleRoutes.post('/', async (req, res) => {
  const { ruleSetId, name, description, priority, conditions, actions, enabled } = req.body;
  if (!ruleSetId || !name) {
    return res.status(400).json({ error: 'ruleSetId and name are required' });
  }
  const rule = await prisma.rule.create({
    data: {
      ruleSetId,
      name,
      description: description || '',
      priority: priority || 0,
      conditions: JSON.stringify(conditions || { logic: 'AND', conditions: [] }),
      actions: JSON.stringify(actions || []),
      enabled: enabled !== false,
    },
  });
  res.status(201).json({
    ...rule,
    conditions: JSON.parse(rule.conditions),
    actions: JSON.parse(rule.actions),
  });
});

// Update rule
ruleRoutes.put('/:id', async (req, res) => {
  const { name, description, priority, conditions, actions, enabled } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (priority !== undefined) data.priority = priority;
  if (conditions !== undefined) data.conditions = JSON.stringify(conditions);
  if (actions !== undefined) data.actions = JSON.stringify(actions);
  if (enabled !== undefined) data.enabled = enabled;

  const rule = await prisma.rule.update({ where: { id: req.params.id }, data });
  res.json({
    ...rule,
    conditions: JSON.parse(rule.conditions),
    actions: JSON.parse(rule.actions),
  });
});

// Delete rule
ruleRoutes.delete('/:id', async (req, res) => {
  await prisma.rule.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
