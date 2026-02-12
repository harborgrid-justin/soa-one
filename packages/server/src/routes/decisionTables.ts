import { Router } from 'express';
import { prisma } from '../prisma';

export const decisionTableRoutes = Router();

// List decision tables for a rule set
decisionTableRoutes.get('/', async (req, res) => {
  const { ruleSetId } = req.query;
  if (!ruleSetId) return res.status(400).json({ error: 'ruleSetId is required' });
  const tables = await prisma.decisionTable.findMany({
    where: { ruleSetId: String(ruleSetId) },
    orderBy: { createdAt: 'asc' },
  });
  const parsed = tables.map((t) => ({
    ...t,
    columns: JSON.parse(t.columns),
    rows: JSON.parse(t.rows),
  }));
  res.json(parsed);
});

// Get single decision table
decisionTableRoutes.get('/:id', async (req, res) => {
  const table = await prisma.decisionTable.findUnique({ where: { id: req.params.id } });
  if (!table) return res.status(404).json({ error: 'Decision table not found' });
  res.json({
    ...table,
    columns: JSON.parse(table.columns),
    rows: JSON.parse(table.rows),
  });
});

// Create decision table
decisionTableRoutes.post('/', async (req, res) => {
  const { ruleSetId, name, description, columns, rows } = req.body;
  if (!ruleSetId || !name) {
    return res.status(400).json({ error: 'ruleSetId and name are required' });
  }
  const table = await prisma.decisionTable.create({
    data: {
      ruleSetId,
      name,
      description: description || '',
      columns: JSON.stringify(columns || []),
      rows: JSON.stringify(rows || []),
    },
  });
  res.status(201).json({
    ...table,
    columns: JSON.parse(table.columns),
    rows: JSON.parse(table.rows),
  });
});

// Update decision table
decisionTableRoutes.put('/:id', async (req, res) => {
  const { name, description, columns, rows } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (columns !== undefined) data.columns = JSON.stringify(columns);
  if (rows !== undefined) data.rows = JSON.stringify(rows);

  const table = await prisma.decisionTable.update({ where: { id: req.params.id }, data });
  res.json({
    ...table,
    columns: JSON.parse(table.columns),
    rows: JSON.parse(table.rows),
  });
});

// Delete decision table
decisionTableRoutes.delete('/:id', async (req, res) => {
  await prisma.decisionTable.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
