import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';
import { executeWorkflow } from '../services/workflowEngine';

export const workflowRoutes = Router();

// List workflows (optionally by project)
workflowRoutes.get('/', async (req, res) => {
  const { projectId } = req.query;
  const where = projectId ? { projectId: String(projectId) } : {};
  const workflows = await prisma.workflow.findMany({
    where,
    include: { _count: { select: { instances: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const parsed = workflows.map((w) => ({
    ...w,
    nodes: JSON.parse(w.nodes),
    edges: JSON.parse(w.edges),
    variables: JSON.parse(w.variables),
    instanceCount: w._count.instances,
  }));
  res.json(parsed);
});

// Get single workflow
workflowRoutes.get('/:id', async (req, res) => {
  const workflow = await prisma.workflow.findUnique({
    where: { id: req.params.id },
    include: {
      instances: { orderBy: { startedAt: 'desc' }, take: 20 },
    },
  });
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

  res.json({
    ...workflow,
    nodes: JSON.parse(workflow.nodes),
    edges: JSON.parse(workflow.edges),
    variables: JSON.parse(workflow.variables),
    instances: workflow.instances.map((i) => ({
      ...i,
      input: JSON.parse(i.input),
      state: JSON.parse(i.state),
      output: i.output ? JSON.parse(i.output) : null,
      logs: JSON.parse(i.logs),
    })),
  });
});

// Create workflow
workflowRoutes.post('/', async (req: AuthRequest, res) => {
  const { projectId, name, description } = req.body;
  if (!projectId || !name) {
    return res.status(400).json({ error: 'projectId and name are required' });
  }

  // Create with default start/end nodes
  const defaultNodes = [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 250, y: 50 },
      data: { label: 'Start' },
    },
    {
      id: 'end-1',
      type: 'end',
      position: { x: 250, y: 400 },
      data: { label: 'End' },
    },
  ];

  const workflow = await prisma.workflow.create({
    data: {
      projectId,
      name,
      description: description || '',
      nodes: JSON.stringify(defaultNodes),
      edges: JSON.stringify([]),
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      action: 'create',
      entity: 'workflow',
      entityId: workflow.id,
      entityName: workflow.name,
    });
  }

  res.status(201).json({
    ...workflow,
    nodes: JSON.parse(workflow.nodes),
    edges: JSON.parse(workflow.edges),
    variables: JSON.parse(workflow.variables),
  });
});

// Update workflow (save canvas)
workflowRoutes.put('/:id', async (req: AuthRequest, res) => {
  const { name, description, nodes, edges, variables, status } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (nodes !== undefined) data.nodes = JSON.stringify(nodes);
  if (edges !== undefined) data.edges = JSON.stringify(edges);
  if (variables !== undefined) data.variables = JSON.stringify(variables);
  if (status !== undefined) data.status = status;

  const workflow = await prisma.workflow.update({
    where: { id: req.params.id },
    data,
  });

  res.json({
    ...workflow,
    nodes: JSON.parse(workflow.nodes),
    edges: JSON.parse(workflow.edges),
    variables: JSON.parse(workflow.variables),
  });
});

// Delete workflow
workflowRoutes.delete('/:id', async (req, res) => {
  await prisma.workflow.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Execute workflow (create instance and run)
workflowRoutes.post('/:id/execute', async (req, res) => {
  const { id } = req.params;
  const input = req.body;

  try {
    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const instance = await prisma.workflowInstance.create({
      data: {
        workflowId: id,
        input: JSON.stringify(input),
        status: 'running',
      },
    });

    // Execute the workflow asynchronously
    const result = await executeWorkflow(workflow, instance.id, input);

    res.json({
      instanceId: instance.id,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get workflow instance
workflowRoutes.get('/instances/:instanceId', async (req, res) => {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: req.params.instanceId },
  });
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  res.json({
    ...instance,
    input: JSON.parse(instance.input),
    state: JSON.parse(instance.state),
    output: instance.output ? JSON.parse(instance.output) : null,
    logs: JSON.parse(instance.logs),
  });
});

// List instances for a workflow
workflowRoutes.get('/:id/instances', async (req, res) => {
  const instances = await prisma.workflowInstance.findMany({
    where: { workflowId: req.params.id },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  const parsed = instances.map((i) => ({
    ...i,
    input: JSON.parse(i.input),
    state: JSON.parse(i.state),
    output: i.output ? JSON.parse(i.output) : null,
    logs: JSON.parse(i.logs),
  }));

  res.json(parsed);
});
