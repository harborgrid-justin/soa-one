import { Router } from 'express';
import { getMFT } from '../services/integration';

const router = Router();

// ============================================================
// MFT Endpoints
// ============================================================

router.get('/endpoints', (_req, res) => {
  res.json(getMFT().allEndpoints);
});

router.get('/endpoints/:id', (req, res) => {
  const ep = getMFT().getEndpoint(String(req.params.id));
  if (!ep) return res.status(404).json({ error: 'Endpoint not found' });
  res.json(ep);
});

router.post('/endpoints', (req, res) => {
  const ep = getMFT().createEndpoint(req.body);
  res.status(201).json(ep);
});

router.put('/endpoints/:id', (req, res) => {
  try {
    res.json(getMFT().updateEndpoint(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/endpoints/:id', (req, res) => {
  getMFT().removeEndpoint(String(req.params.id));
  res.status(204).end();
});

router.post('/endpoints/:id/test', (req, res) => {
  try {
    res.json(getMFT().testEndpoint(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.get('/endpoints/protocol/:protocol', (req, res) => {
  res.json(getMFT().getEndpointsByProtocol(String(req.params.protocol) as any));
});

// ============================================================
// MFT Transfer Definitions
// ============================================================

router.get('/definitions', (_req, res) => {
  res.json(getMFT().allDefinitions);
});

router.get('/definitions/:id', (req, res) => {
  const d = getMFT().getDefinition(String(req.params.id));
  if (!d) return res.status(404).json({ error: 'Definition not found' });
  res.json(d);
});

router.post('/definitions', (req, res) => {
  const d = getMFT().createDefinition(req.body);
  res.status(201).json(d);
});

router.put('/definitions/:id', (req, res) => {
  try {
    res.json(getMFT().updateDefinition(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/definitions/:id', (req, res) => {
  getMFT().removeDefinition(String(req.params.id));
  res.status(204).end();
});

router.post('/definitions/:id/enable', (req, res) => {
  getMFT().enableDefinition(String(req.params.id));
  res.json({ success: true });
});

router.post('/definitions/:id/disable', (req, res) => {
  getMFT().disableDefinition(String(req.params.id));
  res.json({ success: true });
});

// ── Callouts ──

router.get('/definitions/:id/callouts', (req, res) => {
  res.json(getMFT().getCallouts(String(req.params.id)));
});

router.post('/definitions/:id/callouts', (req, res) => {
  try {
    res.status(201).json(getMFT().addCallout(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/definitions/:defId/callouts/:calloutId', (req, res) => {
  getMFT().removeCallout(String(req.params.defId), String(req.params.calloutId));
  res.status(204).end();
});

// ============================================================
// MFT Transfers (Execution)
// ============================================================

router.get('/transfers', (_req, res) => {
  res.json(getMFT().allTransfers);
});

router.get('/transfers/:id', (req, res) => {
  const t = getMFT().getTransferInstance(String(req.params.id));
  if (!t) return res.status(404).json({ error: 'Transfer not found' });
  res.json(t);
});

router.post('/transfers', (req, res) => {
  try {
    const { definitionId, triggeredBy, files } = req.body;
    res.status(201).json(getMFT().executeTransfer(definitionId, triggeredBy || 'api', files));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/transfers/:id/cancel', (req, res) => {
  try {
    res.json(getMFT().cancelTransfer(String(req.params.id)));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/transfers/:id/retry', (req, res) => {
  try {
    res.json(getMFT().retryTransfer(String(req.params.id), req.body.triggeredBy || 'api'));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.get('/transfers/state/:state', (req, res) => {
  res.json(getMFT().getTransfersByState(String(req.params.state) as any));
});

router.get('/transfers/definition/:defId', (req, res) => {
  res.json(getMFT().getTransfersByDefinition(String(req.params.defId)));
});

// ============================================================
// MFT Alerts & Audit
// ============================================================

router.get('/alerts', (req, res) => {
  const severity = req.query.severity ? String(req.query.severity) as any : undefined;
  res.json(getMFT().getAlerts(severity));
});

router.post('/alerts/:id/acknowledge', (req, res) => {
  const ok = getMFT().acknowledgeAlert(String(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true });
});

router.get('/audit', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json(getMFT().getAuditLog(limit));
});

// ============================================================
// MFT Stats
// ============================================================

router.get('/stats', (_req, res) => {
  res.json(getMFT().getStats());
});

export default router;
