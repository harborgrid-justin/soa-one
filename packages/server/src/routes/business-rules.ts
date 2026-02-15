import { Router } from 'express';
import { getBusinessRules } from '../services/integration';

const router = Router();

// ============================================================
// Rule Sets
// ============================================================

router.get('/rule-sets', (_req, res) => {
  res.json(getBusinessRules().allRuleSets);
});

router.get('/rule-sets/:id', (req, res) => {
  const rs = getBusinessRules().getRuleSet(String(req.params.id));
  if (!rs) return res.status(404).json({ error: 'Rule set not found' });
  res.json(rs);
});

router.post('/rule-sets', (req, res) => {
  res.status(201).json(getBusinessRules().createRuleSet(req.body));
});

router.put('/rule-sets/:id', (req, res) => {
  try {
    res.json(getBusinessRules().updateRuleSet(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/rule-sets/:id', (req, res) => {
  getBusinessRules().removeRuleSet(String(req.params.id));
  res.status(204).end();
});

router.post('/rule-sets/:id/evaluate', (req, res) => {
  try {
    res.json(getBusinessRules().evaluateRuleSet(String(req.params.id), req.body.facts || req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Rules within Rule Sets ──

router.get('/rule-sets/:rsId/rules', (req, res) => {
  const rs = getBusinessRules().getRuleSet(String(req.params.rsId));
  if (!rs) return res.status(404).json({ error: 'Rule set not found' });
  res.json(rs.rules);
});

router.get('/rule-sets/:rsId/rules/:ruleId', (req, res) => {
  const r = getBusinessRules().getRule(String(req.params.rsId), String(req.params.ruleId));
  if (!r) return res.status(404).json({ error: 'Rule not found' });
  res.json(r);
});

router.post('/rule-sets/:rsId/rules', (req, res) => {
  try {
    res.status(201).json(getBusinessRules().addRule(String(req.params.rsId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.put('/rule-sets/:rsId/rules/:ruleId', (req, res) => {
  try {
    res.json(getBusinessRules().updateRule(String(req.params.rsId), String(req.params.ruleId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/rule-sets/:rsId/rules/:ruleId', (req, res) => {
  getBusinessRules().removeRule(String(req.params.rsId), String(req.params.ruleId));
  res.status(204).end();
});

// ============================================================
// Decision Tables
// ============================================================

router.get('/decision-tables', (_req, res) => {
  res.json(getBusinessRules().allDecisionTables);
});

router.get('/decision-tables/:id', (req, res) => {
  const dt = getBusinessRules().getDecisionTable(String(req.params.id));
  if (!dt) return res.status(404).json({ error: 'Decision table not found' });
  res.json(dt);
});

router.post('/decision-tables', (req, res) => {
  res.status(201).json(getBusinessRules().createDecisionTable(req.body));
});

router.put('/decision-tables/:id', (req, res) => {
  try {
    res.json(getBusinessRules().updateDecisionTable(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/decision-tables/:id', (req, res) => {
  getBusinessRules().removeDecisionTable(String(req.params.id));
  res.status(204).end();
});

router.post('/decision-tables/:id/evaluate', (req, res) => {
  try {
    res.json(getBusinessRules().evaluateDecisionTable(String(req.params.id), req.body.input || req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Decision Table Rows ──

router.post('/decision-tables/:id/rows', (req, res) => {
  try {
    res.status(201).json(getBusinessRules().addRow(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.put('/decision-tables/:dtId/rows/:rowId', (req, res) => {
  try {
    res.json(getBusinessRules().updateRow(String(req.params.dtId), String(req.params.rowId), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/decision-tables/:dtId/rows/:rowId', (req, res) => {
  getBusinessRules().removeRow(String(req.params.dtId), String(req.params.rowId));
  res.status(204).end();
});

// ============================================================
// Test Cases
// ============================================================

router.get('/test-cases', (_req, res) => {
  res.json(getBusinessRules().allTestCases);
});

router.get('/test-cases/:id', (req, res) => {
  const tc = getBusinessRules().getTestCase(String(req.params.id));
  if (!tc) return res.status(404).json({ error: 'Test case not found' });
  res.json(tc);
});

router.post('/test-cases', (req, res) => {
  res.status(201).json(getBusinessRules().createTestCase(req.body));
});

router.put('/test-cases/:id', (req, res) => {
  try {
    res.json(getBusinessRules().updateTestCase(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/test-cases/:id', (req, res) => {
  getBusinessRules().removeTestCase(String(req.params.id));
  res.status(204).end();
});

router.post('/test-cases/:id/run', (req, res) => {
  try {
    res.json(getBusinessRules().runTestCase(String(req.params.id)));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/test-cases/run-all', (_req, res) => {
  res.json(getBusinessRules().runAllTestCases());
});

// ============================================================
// Execution Log & Stats
// ============================================================

router.get('/execution-log', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json(getBusinessRules().getExecutionLog(limit));
});

router.get('/stats', (_req, res) => {
  res.json(getBusinessRules().getStats());
});

export default router;
