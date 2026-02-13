import { Router } from 'express';
import { prisma } from '../prisma';

export const dataModelRoutes = Router();

// List data models (optionally filtered by project)
dataModelRoutes.get('/', async (req, res) => {
  const { projectId } = req.query;
  const where = projectId ? { projectId: String(projectId) } : {};
  const models = await prisma.dataModel.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });
  const parsed = models.map((m) => ({
    ...m,
    schema: JSON.parse(m.schema),
  }));
  res.json(parsed);
});

// Get single data model
dataModelRoutes.get('/:id', async (req, res) => {
  const model = await prisma.dataModel.findUnique({ where: { id: req.params.id } });
  if (!model) return res.status(404).json({ error: 'Data model not found' });
  res.json({ ...model, schema: JSON.parse(model.schema) });
});

// Create data model
dataModelRoutes.post('/', async (req, res) => {
  const { projectId, name, schema } = req.body;
  if (!projectId || !name) {
    return res.status(400).json({ error: 'projectId and name are required' });
  }
  const model = await prisma.dataModel.create({
    data: {
      projectId,
      name,
      schema: JSON.stringify(schema || { fields: [] }),
    },
  });
  res.status(201).json({ ...model, schema: JSON.parse(model.schema) });
});

// Update data model
dataModelRoutes.put('/:id', async (req, res) => {
  const { name, schema } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (schema !== undefined) data.schema = JSON.stringify(schema);

  const model = await prisma.dataModel.update({ where: { id: req.params.id }, data });
  res.json({ ...model, schema: JSON.parse(model.schema) });
});

// Delete data model
dataModelRoutes.delete('/:id', async (req, res) => {
  await prisma.dataModel.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
