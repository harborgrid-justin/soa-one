import { Router } from 'express';
import { getEDN, getXRef, getDVM, getAdapterFramework, getReliableMessaging } from '../services/integration';

const router = Router();

// ============================================================
// EDN — Event Delivery Network
// ============================================================

// ── Topics ──

router.get('/edn/topics', (_req, res) => {
  res.json(getEDN().allTopics);
});

router.get('/edn/topics/:id', (req, res) => {
  const t = getEDN().getTopic(String(req.params.id));
  if (!t) return res.status(404).json({ error: 'Topic not found' });
  res.json(t);
});

router.post('/edn/topics', (req, res) => {
  res.status(201).json(getEDN().createTopic(req.body));
});

router.put('/edn/topics/:id', (req, res) => {
  try {
    res.json(getEDN().updateTopic(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/edn/topics/:id', (req, res) => {
  getEDN().removeTopic(String(req.params.id));
  res.status(204).end();
});

// ── Subscriptions ──

router.get('/edn/subscriptions', (_req, res) => {
  res.json(getEDN().allSubscriptions.map((s: any) => ({ ...s, handler: '[function]' })));
});

router.get('/edn/subscriptions/:id', (req, res) => {
  const s = getEDN().getSubscription(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Subscription not found' });
  res.json({ ...s, handler: '[function]' });
});

router.get('/edn/subscriptions/topic/:topicId', (req, res) => {
  res.json(getEDN().getSubscriptionsByTopic(String(req.params.topicId)).map((s: any) => ({ ...s, handler: '[function]' })));
});

router.post('/edn/subscriptions/:id/enable', (req, res) => {
  getEDN().enableSubscription(String(req.params.id));
  res.json({ success: true });
});

router.post('/edn/subscriptions/:id/disable', (req, res) => {
  getEDN().disableSubscription(String(req.params.id));
  res.json({ success: true });
});

router.delete('/edn/subscriptions/:id', (req, res) => {
  getEDN().unsubscribe(String(req.params.id));
  res.status(204).end();
});

// ── Publish ──

router.post('/edn/topics/:topicId/publish', (req, res) => {
  try {
    res.status(201).json(getEDN().publish(String(req.params.topicId), req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Events ──

router.get('/edn/events', (_req, res) => {
  res.json(getEDN().allEvents);
});

router.get('/edn/events/:id', (req, res) => {
  const e = getEDN().getEvent(String(req.params.id));
  if (!e) return res.status(404).json({ error: 'Event not found' });
  res.json(e);
});

// ── Dead Letters ──

router.get('/edn/dead-letters', (_req, res) => {
  res.json(getEDN().getDeadLetters());
});

router.post('/edn/dead-letters/:id/retry', (req, res) => {
  const ok = getEDN().retryDeadLetter(String(req.params.id));
  res.json({ success: ok });
});

router.delete('/edn/dead-letters', (_req, res) => {
  const count = getEDN().purgeDeadLetters();
  res.json({ purged: count });
});

// ── EDN Stats ──

router.get('/edn/stats', (_req, res) => {
  res.json(getEDN().getStats());
});

// ============================================================
// XRef — Cross-Reference Tables
// ============================================================

// ── Tables ──

router.get('/xref/tables', (_req, res) => {
  res.json(getXRef().allTables);
});

router.get('/xref/tables/:id', (req, res) => {
  const t = getXRef().getTable(String(req.params.id));
  if (!t) return res.status(404).json({ error: 'XRef table not found' });
  res.json(t);
});

router.post('/xref/tables', (req, res) => {
  res.status(201).json(getXRef().createTable(req.body));
});

router.put('/xref/tables/:id', (req, res) => {
  try {
    res.json(getXRef().updateTable(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/xref/tables/:id', (req, res) => {
  getXRef().removeTable(String(req.params.id));
  res.status(204).end();
});

// ── Rows ──

router.get('/xref/tables/:tableId/rows', (req, res) => {
  res.json(getXRef().getRowsByTable(String(req.params.tableId)));
});

router.get('/xref/rows/:id', (req, res) => {
  const r = getXRef().getRow(String(req.params.id));
  if (!r) return res.status(404).json({ error: 'XRef row not found' });
  res.json(r);
});

router.post('/xref/tables/:tableId/rows', (req, res) => {
  try {
    res.status(201).json(getXRef().addRow(String(req.params.tableId), req.body.values || req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/xref/rows/:id', (req, res) => {
  try {
    res.json(getXRef().updateRow(String(req.params.id), req.body.values || req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/xref/rows/:id', (req, res) => {
  getXRef().removeRow(String(req.params.id));
  res.status(204).end();
});

// ── Lookups ──

router.post('/xref/tables/:tableId/lookup', (req, res) => {
  const { sourceColumn, sourceValue, targetColumn } = req.body;
  const result = getXRef().lookup(String(req.params.tableId), sourceColumn, sourceValue, targetColumn);
  res.json({ value: result });
});

router.post('/xref/tables/:tableId/reverse-lookup', (req, res) => {
  const { targetColumn, targetValue, sourceColumn } = req.body;
  const result = getXRef().reverseLookup(String(req.params.tableId), targetColumn, targetValue, sourceColumn);
  res.json({ value: result });
});

router.post('/xref/tables/:tableId/bulk-lookup', (req, res) => {
  const { sourceColumn, sourceValues, targetColumn } = req.body;
  res.json(getXRef().bulkLookup(String(req.params.tableId), sourceColumn, sourceValues, targetColumn));
});

router.delete('/xref/tables/:tableId/purge', (req, res) => {
  const count = getXRef().purgeTable(String(req.params.tableId));
  res.json({ purged: count });
});

router.get('/xref/stats', (_req, res) => {
  res.json(getXRef().getStats());
});

// ============================================================
// DVM — Domain Value Maps
// ============================================================

router.get('/dvm/maps', (_req, res) => {
  res.json(getDVM().allMaps);
});

router.get('/dvm/maps/:id', (req, res) => {
  const m = getDVM().getMap(String(req.params.id));
  if (!m) return res.status(404).json({ error: 'DVM not found' });
  res.json(m);
});

router.post('/dvm/maps', (req, res) => {
  res.status(201).json(getDVM().createMap(req.body));
});

router.put('/dvm/maps/:id', (req, res) => {
  try {
    res.json(getDVM().updateMap(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/dvm/maps/:id', (req, res) => {
  getDVM().removeMap(String(req.params.id));
  res.status(204).end();
});

// ── DVM Entries ──

router.get('/dvm/maps/:mapId/entries', (req, res) => {
  res.json(getDVM().getEntries(String(req.params.mapId)));
});

router.get('/dvm/maps/:mapId/entries/:entryId', (req, res) => {
  const e = getDVM().getEntry(String(req.params.mapId), String(req.params.entryId));
  if (!e) return res.status(404).json({ error: 'Entry not found' });
  res.json(e);
});

router.post('/dvm/maps/:mapId/entries', (req, res) => {
  try {
    res.status(201).json(getDVM().addEntry(String(req.params.mapId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.put('/dvm/maps/:mapId/entries/:entryId', (req, res) => {
  try {
    res.json(getDVM().updateEntry(String(req.params.mapId), String(req.params.entryId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/dvm/maps/:mapId/entries/:entryId', (req, res) => {
  getDVM().removeEntry(String(req.params.mapId), String(req.params.entryId));
  res.status(204).end();
});

// ── DVM Lookups ──

router.post('/dvm/maps/:mapId/lookup', (req, res) => {
  const { sourceDomain, sourceValue, targetDomain, qualifier } = req.body;
  res.json({ value: getDVM().lookup(String(req.params.mapId), sourceDomain, sourceValue, targetDomain, qualifier) });
});

router.post('/dvm/maps/:mapId/reverse-lookup', (req, res) => {
  const { targetDomain, targetValue, sourceDomain, qualifier } = req.body;
  res.json({ value: getDVM().reverseLookup(String(req.params.mapId), targetDomain, targetValue, sourceDomain, qualifier) });
});

router.post('/dvm/maps/:mapId/bulk-lookup', (req, res) => {
  const { sourceDomain, sourceValues, targetDomain, qualifier } = req.body;
  res.json(getDVM().bulkLookup(String(req.params.mapId), sourceDomain, sourceValues, targetDomain, qualifier));
});

router.get('/dvm/stats', (_req, res) => {
  res.json(getDVM().getStats());
});

// ============================================================
// Adapter Framework (JCA)
// ============================================================

// ── Adapters ──

router.get('/adapters', (_req, res) => {
  res.json(getAdapterFramework().allAdapters);
});

router.get('/adapters/:id', (req, res) => {
  const a = getAdapterFramework().getAdapter(String(req.params.id));
  if (!a) return res.status(404).json({ error: 'Adapter not found' });
  res.json(a);
});

router.post('/adapters', (req, res) => {
  res.status(201).json(getAdapterFramework().registerAdapter(req.body));
});

router.put('/adapters/:id', (req, res) => {
  try {
    res.json(getAdapterFramework().updateAdapter(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/adapters/:id', (req, res) => {
  getAdapterFramework().removeAdapter(String(req.params.id));
  res.status(204).end();
});

router.get('/adapters/type/:type', (req, res) => {
  res.json(getAdapterFramework().getAdaptersByType(String(req.params.type) as any));
});

// ── Adapter Lifecycle ──

router.post('/adapters/:id/connect', (req, res) => {
  try { getAdapterFramework().connect(String(req.params.id)); res.json({ success: true }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/adapters/:id/activate', (req, res) => {
  try { getAdapterFramework().activate(String(req.params.id)); res.json({ success: true }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/adapters/:id/pause', (req, res) => {
  try { getAdapterFramework().pause(String(req.params.id)); res.json({ success: true }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/adapters/:id/disconnect', (req, res) => {
  try { getAdapterFramework().disconnect(String(req.params.id)); res.json({ success: true }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/adapters/:id/test', (req, res) => {
  try { res.json(getAdapterFramework().testConnection(String(req.params.id))); }
  catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ── Adapter Operations ──

router.get('/adapters/:id/operations', (req, res) => {
  res.json(getAdapterFramework().getOperationsByAdapter(String(req.params.id)));
});

router.post('/adapters/:id/operations', (req, res) => {
  try {
    res.status(201).json(getAdapterFramework().addOperation({ ...req.body, adapterId: String(req.params.id) }));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/operations/:id', (req, res) => {
  try {
    res.json(getAdapterFramework().updateOperation(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/operations/:id', (req, res) => {
  getAdapterFramework().removeOperation(String(req.params.id));
  res.status(204).end();
});

// ── Adapter Endpoints ──

router.get('/adapters/:id/endpoints', (req, res) => {
  res.json(getAdapterFramework().getEndpointsByAdapter(String(req.params.id)));
});

router.post('/adapters/:id/endpoints', (req, res) => {
  try {
    res.status(201).json(getAdapterFramework().addEndpoint({ ...req.body, adapterId: String(req.params.id) }));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/adapter-endpoints/:id', (req, res) => {
  try {
    res.json(getAdapterFramework().updateEndpoint(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/adapter-endpoints/:id', (req, res) => {
  getAdapterFramework().removeEndpoint(String(req.params.id));
  res.status(204).end();
});

// ── Adapter Metrics ──

router.get('/adapters/:id/metrics', (req, res) => {
  const m = getAdapterFramework().getMetrics(String(req.params.id));
  if (!m) return res.status(404).json({ error: 'Metrics not found' });
  res.json(m);
});

router.get('/adapter-metrics', (_req, res) => {
  res.json(getAdapterFramework().allMetrics);
});

router.get('/adapter-stats', (_req, res) => {
  res.json(getAdapterFramework().getStats());
});

// ============================================================
// WS-ReliableMessaging
// ============================================================

// ── Sequences ──

router.get('/rm/sequences', (_req, res) => {
  res.json(getReliableMessaging().allSequences);
});

router.get('/rm/sequences/:id', (req, res) => {
  const s = getReliableMessaging().getSequence(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Sequence not found' });
  res.json(s);
});

router.post('/rm/sequences', (req, res) => {
  res.status(201).json(getReliableMessaging().createSequence(req.body));
});

router.post('/rm/sequences/:id/close', (req, res) => {
  try { res.json(getReliableMessaging().closeSequence(String(req.params.id))); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/rm/sequences/:id/terminate', (req, res) => {
  try { res.json(getReliableMessaging().terminateSequence(String(req.params.id))); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/rm/sequences/:id', (req, res) => {
  getReliableMessaging().removeSequence(String(req.params.id));
  res.status(204).end();
});

// ── Messages ──

router.post('/rm/sequences/:seqId/messages', (req, res) => {
  try {
    res.status(201).json(getReliableMessaging().sendMessage(String(req.params.seqId), req.body.payload, req.body.headers));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/rm/sequences/:seqId/messages', (req, res) => {
  res.json(getReliableMessaging().getMessagesBySequence(String(req.params.seqId)));
});

router.get('/rm/sequences/:seqId/pending', (req, res) => {
  res.json(getReliableMessaging().getPendingMessages(String(req.params.seqId)));
});

router.post('/rm/messages/:id/retransmit', (req, res) => {
  try { res.json(getReliableMessaging().retransmitMessage(String(req.params.id))); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Acknowledgments ──

router.post('/rm/sequences/:seqId/acknowledge', (req, res) => {
  try {
    res.json(getReliableMessaging().acknowledge(String(req.params.seqId), req.body.ranges, req.body.nacks));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/rm/sequences/:seqId/acknowledgments', (req, res) => {
  res.json(getReliableMessaging().getAcknowledgments(String(req.params.seqId)));
});

// ── RM Policies ──

router.get('/rm/policies', (_req, res) => {
  res.json(getReliableMessaging().allPolicies);
});

router.get('/rm/policies/:id', (req, res) => {
  const p = getReliableMessaging().getPolicy(String(req.params.id));
  if (!p) return res.status(404).json({ error: 'RM Policy not found' });
  res.json(p);
});

router.post('/rm/policies', (req, res) => {
  res.status(201).json(getReliableMessaging().createPolicy(req.body));
});

router.put('/rm/policies/:id', (req, res) => {
  try {
    res.json(getReliableMessaging().updatePolicy(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/rm/policies/:id', (req, res) => {
  getReliableMessaging().removePolicy(String(req.params.id));
  res.status(204).end();
});

// ── RM Stats ──

router.get('/rm/stats', (_req, res) => {
  res.json(getReliableMessaging().getStats());
});

export default router;
