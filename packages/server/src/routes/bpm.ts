import { Router } from 'express';
import { getBPM } from '../services/integration';

const router = Router();

// ============================================================
// Process Definitions
// ============================================================

router.get('/definitions', (_req, res) => {
  res.json(getBPM().allDefinitions);
});

router.get('/definitions/:id', (req, res) => {
  const d = getBPM().getDefinition(String(req.params.id));
  if (!d) return res.status(404).json({ error: 'Process definition not found' });
  res.json(d);
});

router.post('/definitions', (req, res) => {
  res.status(201).json(getBPM().createDefinition(req.body));
});

router.put('/definitions/:id', (req, res) => {
  try {
    res.json(getBPM().updateDefinition(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/definitions/:id', (req, res) => {
  getBPM().removeDefinition(String(req.params.id));
  res.status(204).end();
});

router.post('/definitions/:id/deploy', (req, res) => {
  try {
    res.json(getBPM().deployDefinition(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/definitions/:id/activate', (req, res) => {
  try {
    res.json(getBPM().activateDefinition(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/definitions/:id/suspend', (req, res) => {
  try {
    res.json(getBPM().suspendDefinition(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ── Nodes ──

router.get('/definitions/:defId/nodes', (req, res) => {
  const d = getBPM().getDefinition(String(req.params.defId));
  if (!d) return res.status(404).json({ error: 'Definition not found' });
  res.json(d.nodes);
});

router.get('/definitions/:defId/nodes/:nodeId', (req, res) => {
  const n = getBPM().getNode(String(req.params.defId), String(req.params.nodeId));
  if (!n) return res.status(404).json({ error: 'Node not found' });
  res.json(n);
});

router.post('/definitions/:defId/nodes', (req, res) => {
  try {
    res.status(201).json(getBPM().addNode(String(req.params.defId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.put('/definitions/:defId/nodes/:nodeId', (req, res) => {
  try {
    res.json(getBPM().updateNode(String(req.params.defId), String(req.params.nodeId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/definitions/:defId/nodes/:nodeId', (req, res) => {
  getBPM().removeNode(String(req.params.defId), String(req.params.nodeId));
  res.status(204).end();
});

// ── Transitions ──

router.post('/definitions/:defId/transitions', (req, res) => {
  try {
    res.status(201).json(getBPM().addTransition(String(req.params.defId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/definitions/:defId/transitions/:transId', (req, res) => {
  getBPM().removeTransition(String(req.params.defId), String(req.params.transId));
  res.status(204).end();
});

// ── Swimlanes ──

router.post('/definitions/:defId/swimlanes', (req, res) => {
  try {
    res.status(201).json(getBPM().addSwimlane(String(req.params.defId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/definitions/:defId/swimlanes/:slId', (req, res) => {
  getBPM().removeSwimlane(String(req.params.defId), String(req.params.slId));
  res.status(204).end();
});

// ============================================================
// Process Instances
// ============================================================

router.get('/instances', (req, res) => {
  const status = req.query.status ? String(req.query.status) as any : undefined;
  if (status) {
    res.json(getBPM().getInstancesByStatus(status));
  } else {
    res.json(getBPM().allInstances);
  }
});

router.get('/instances/:id', (req, res) => {
  const i = getBPM().getInstance(String(req.params.id));
  if (!i) return res.status(404).json({ error: 'Instance not found' });
  res.json(i);
});

router.post('/instances', (req, res) => {
  try {
    const { definitionId, startedBy, variables } = req.body;
    res.status(201).json(getBPM().startProcess(definitionId, startedBy || 'api', variables));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/instances/:id/suspend', (req, res) => {
  try {
    res.json(getBPM().suspendInstance(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/instances/:id/resume', (req, res) => {
  try {
    res.json(getBPM().resumeInstance(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/instances/:id/terminate', (req, res) => {
  try {
    res.json(getBPM().terminateInstance(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.get('/instances/definition/:defId', (req, res) => {
  res.json(getBPM().getInstancesByDefinition(String(req.params.defId)));
});

// ── Task Completion ──

router.post('/instances/:instId/tasks/:tokenId/complete', (req, res) => {
  try {
    const { performedBy, formData } = req.body;
    res.json(getBPM().completeTask(String(req.params.instId), String(req.params.tokenId), performedBy || 'api', formData));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/instances/:instId/tasks/:tokenId/assign', (req, res) => {
  try {
    res.json(getBPM().assignTask(String(req.params.instId), String(req.params.tokenId), req.body.assignee));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ============================================================
// Active Tasks
// ============================================================

router.get('/tasks', (req, res) => {
  const assignee = req.query.assignee ? String(req.query.assignee) : undefined;
  res.json(getBPM().getActiveTasks(assignee));
});

// ============================================================
// Analytics & Stats
// ============================================================

router.get('/analytics/:defId', (req, res) => {
  res.json(getBPM().getAnalytics(String(req.params.defId)));
});

router.get('/stats', (_req, res) => {
  res.json(getBPM().getStats());
});

export default router;
