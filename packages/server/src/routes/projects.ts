import { Router } from 'express';
import { prisma } from '../prisma';

export const projectRoutes = Router();

// List all projects
projectRoutes.get('/', async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { ruleSets: true, dataModels: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(projects);
});

// Get single project
projectRoutes.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      ruleSets: { orderBy: { updatedAt: 'desc' } },
      dataModels: { orderBy: { updatedAt: 'desc' } },
    },
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// Create project
projectRoutes.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const project = await prisma.project.create({
    data: { name, description: description || '' },
  });
  res.status(201).json(project);
});

// Update project
projectRoutes.put('/:id', async (req, res) => {
  const { name, description } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { name, description },
  });
  res.json(project);
});

// Delete project
projectRoutes.delete('/:id', async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
