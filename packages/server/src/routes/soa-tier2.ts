import { Router } from 'express';
import { getNotificationService, getGovernanceManager, getDeploymentManager } from '../services/integration';

const router = Router();

// ============================================================
// Notification Templates
// ============================================================

router.get('/templates', (_req, res) => {
  res.json(getNotificationService().allTemplates);
});

router.get('/templates/:id', (req, res) => {
  const t = getNotificationService().getTemplate(String(req.params.id));
  if (!t) return res.status(404).json({ error: 'Template not found' });
  res.json(t);
});

router.post('/templates', (req, res) => {
  res.status(201).json(getNotificationService().registerTemplate(req.body));
});

router.put('/templates/:id', (req, res) => {
  try {
    res.json(getNotificationService().updateTemplate(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/templates/:id', (req, res) => {
  getNotificationService().removeTemplate(String(req.params.id));
  res.status(204).end();
});

// ============================================================
// Notification Preferences
// ============================================================

router.get('/preferences/:id', (req, res) => {
  const p = getNotificationService().getPreference(String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Preference not found' });
  res.json(p);
});

router.post('/preferences', (req, res) => {
  res.status(201).json(getNotificationService().setPreference(req.body));
});

router.put('/preferences/:id', (req, res) => {
  try {
    res.json(getNotificationService().updatePreference(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ============================================================
// Delivery Policies
// ============================================================

router.get('/delivery-policies', (_req, res) => {
  res.json(getNotificationService().allDeliveryPolicies);
});

router.get('/delivery-policies/:id', (req, res) => {
  const p = getNotificationService().getDeliveryPolicy(String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Policy not found' });
  res.json(p);
});

router.post('/delivery-policies', (req, res) => {
  res.status(201).json(getNotificationService().registerDeliveryPolicy(req.body));
});

router.put('/delivery-policies/:id', (req, res) => {
  try {
    res.json(getNotificationService().updateDeliveryPolicy(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/delivery-policies/:id', (req, res) => {
  getNotificationService().removeDeliveryPolicy(String(req.params.id));
  res.status(204).end();
});

// ============================================================
// Webhooks
// ============================================================

router.get('/webhooks', (_req, res) => {
  res.json(getNotificationService().allWebhooks);
});

router.get('/webhooks/:id', (req, res) => {
  const w = getNotificationService().getWebhook(String(req.params.id));
  if (!w) return res.status(404).json({ error: 'Webhook not found' });
  res.json(w);
});

router.post('/webhooks', (req, res) => {
  res.status(201).json(getNotificationService().registerWebhook(req.body));
});

router.put('/webhooks/:id', (req, res) => {
  try {
    res.json(getNotificationService().updateWebhook(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/webhooks/:id', (req, res) => {
  getNotificationService().removeWebhook(String(req.params.id));
  res.status(204).end();
});

// ============================================================
// Send / Messages
// ============================================================

router.post('/send', (req, res) => {
  try {
    res.status(201).json(getNotificationService().send(req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/send-template', (req, res) => {
  try {
    const { templateId, recipient, variables, priority, category, sender } = req.body;
    res.status(201).json(getNotificationService().sendFromTemplate(templateId, recipient, variables, { priority, category, sender }));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/broadcast', (req, res) => {
  try {
    const { recipients, subject, body, channel, priority } = req.body;
    res.json(getNotificationService().sendBroadcast(recipients, subject, body, channel, priority));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/messages', (_req, res) => {
  res.json(getNotificationService().allMessages);
});

router.get('/messages/:id', (req, res) => {
  const m = getNotificationService().getMessage(String(req.params.id));
  if (!m) return res.status(404).json({ error: 'Message not found' });
  res.json(m);
});

router.post('/messages/:id/delivered', (req, res) => {
  try {
    getNotificationService().markDelivered(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/messages/:id/failed', (req, res) => {
  try {
    getNotificationService().markFailed(String(req.params.id), req.body.reason || 'Unknown');
    res.json({ success: true });
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/messages/:id/retry', (req, res) => {
  try {
    res.json(getNotificationService().retry(String(req.params.id)));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/messages/:id/cancel', (req, res) => {
  try {
    getNotificationService().cancel(String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

// ============================================================
// Notification Stats
// ============================================================

router.get('/stats', (_req, res) => {
  res.json(getNotificationService().getStats());
});

// ============================================================
// ====== GOVERNANCE ==========================================
// ============================================================

// ── Service Versions ──

router.get('/governance/versions', (_req, res) => {
  res.json(getGovernanceManager().allVersions);
});

router.get('/governance/versions/:id', (req, res) => {
  const v = getGovernanceManager().getVersion(String(req.params.id));
  if (!v) return res.status(404).json({ error: 'Version not found' });
  res.json(v);
});

router.post('/governance/versions', (req, res) => {
  res.status(201).json(getGovernanceManager().createVersion(req.body));
});

router.put('/governance/versions/:id', (req, res) => {
  try {
    res.json(getGovernanceManager().updateVersion(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.get('/governance/versions/service/:serviceId', (req, res) => {
  res.json(getGovernanceManager().getVersionsByService(String(req.params.serviceId)));
});

router.get('/governance/versions/service/:serviceId/active', (req, res) => {
  const v = getGovernanceManager().getActiveVersion(String(req.params.serviceId));
  if (!v) return res.status(404).json({ error: 'No active version' });
  res.json(v);
});

// ── Lifecycle Transitions ──

router.post('/governance/versions/:id/transition', (req, res) => {
  try {
    res.json(getGovernanceManager().transition(String(req.params.id), req.body.targetState, req.body.performedBy || 'api', req.body.notes));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Approval Requests ──

router.get('/governance/approvals', (_req, res) => {
  res.json(getGovernanceManager().allApprovals);
});

router.get('/governance/approvals/pending', (_req, res) => {
  res.json(getGovernanceManager().getPendingApprovals());
});

router.get('/governance/approvals/:id', (req, res) => {
  const a = getGovernanceManager().getApproval(String(req.params.id));
  if (!a) return res.status(404).json({ error: 'Approval not found' });
  res.json(a);
});

router.post('/governance/approvals', (req, res) => {
  res.status(201).json(getGovernanceManager().createApproval(req.body));
});

router.post('/governance/approvals/:id/decide', (req, res) => {
  try {
    const { approver, decision, comment } = req.body;
    res.json(getGovernanceManager().decide(String(req.params.id), approver, decision, comment));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/governance/approvals/:id/withdraw', (req, res) => {
  try {
    res.json(getGovernanceManager().withdrawApproval(String(req.params.id)));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Compliance Policies ──

router.get('/governance/compliance-policies', (_req, res) => {
  res.json(getGovernanceManager().allCompliancePolicies);
});

router.get('/governance/compliance-policies/:id', (req, res) => {
  const p = getGovernanceManager().getCompliancePolicy(String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Policy not found' });
  res.json(p);
});

router.post('/governance/compliance-policies', (req, res) => {
  res.status(201).json(getGovernanceManager().createCompliancePolicy(req.body));
});

router.put('/governance/compliance-policies/:id', (req, res) => {
  try {
    res.json(getGovernanceManager().updateCompliancePolicy(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/governance/compliance-policies/:id', (req, res) => {
  getGovernanceManager().removeCompliancePolicy(String(req.params.id));
  res.status(204).end();
});

// ── Compliance Assessments ──

router.post('/governance/assess/:serviceId', (req, res) => {
  try {
    res.json(getGovernanceManager().assess(req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/governance/assessments/service/:serviceId', (req, res) => {
  res.json(getGovernanceManager().getAssessmentsByService(String(req.params.serviceId)));
});

router.get('/governance/assessments/service/:serviceId/latest', (req, res) => {
  const policyId = String(req.query.policyId || '');
  const a = getGovernanceManager().getLatestAssessment(String(req.params.serviceId), policyId);
  if (!a) return res.status(404).json({ error: 'No assessment found' });
  res.json(a);
});

router.post('/governance/assessments/:id/waive', (req, res) => {
  try {
    res.json(getGovernanceManager().waiveAssessment(String(req.params.id), req.body.reason, req.body.expiresAt));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Impact Analysis ──

router.post('/governance/impact/:serviceId', (req, res) => {
  try {
    res.json(getGovernanceManager().analyzeImpact(req.body));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/governance/impact/service/:serviceId', (req, res) => {
  res.json(getGovernanceManager().getImpactAnalysesByService(String(req.params.serviceId)));
});

// ── Service Ownership ──

router.post('/governance/ownership', (req, res) => {
  res.status(201).json(getGovernanceManager().assignOwner(req.body));
});

router.get('/governance/ownership/:serviceId', (req, res) => {
  res.json(getGovernanceManager().getOwner(String(req.params.serviceId)));
});

router.delete('/governance/ownership/:id', (req, res) => {
  getGovernanceManager().removeOwner(String(req.params.id));
  res.status(204).end();
});

// ── Governance Stats ──

router.get('/governance/stats', (_req, res) => {
  res.json(getGovernanceManager().getStats());
});

// ============================================================
// ====== DEPLOYMENT ==========================================
// ============================================================

// ── Composites ──

router.get('/deployment/composites', (_req, res) => {
  res.json(getDeploymentManager().allComposites);
});

router.get('/deployment/composites/:id', (req, res) => {
  const c = getDeploymentManager().getComposite(String(req.params.id));
  if (!c) return res.status(404).json({ error: 'Composite not found' });
  res.json(c);
});

router.post('/deployment/composites', (req, res) => {
  res.status(201).json(getDeploymentManager().createComposite(req.body));
});

router.put('/deployment/composites/:id', (req, res) => {
  try {
    res.json(getDeploymentManager().updateComposite(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/deployment/composites/:id', (req, res) => {
  getDeploymentManager().removeComposite(String(req.params.id));
  res.status(204).end();
});

router.get('/deployment/composites/state/:state', (req, res) => {
  res.json(getDeploymentManager().getCompositesByState(String(req.params.state) as any));
});

router.get('/deployment/composites/environment/:env', (req, res) => {
  res.json(getDeploymentManager().getCompositesByEnvironment(String(req.params.env) as any));
});

// ── Deploy/Undeploy Operations ──

router.post('/deployment/composites/:id/deploy', (req, res) => {
  try {
    const { environment, performedBy, planId } = req.body;
    res.json(getDeploymentManager().deploy(String(req.params.id), environment, performedBy || 'api', planId));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/deployment/composites/:id/undeploy', (req, res) => {
  try {
    res.json(getDeploymentManager().undeploy(String(req.params.id), req.body.performedBy || 'api'));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/deployment/composites/:id/redeploy', (req, res) => {
  try {
    res.json(getDeploymentManager().redeploy(String(req.params.id), req.body.performedBy || 'api'));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/deployment/composites/:id/suspend', (req, res) => {
  try {
    res.json(getDeploymentManager().suspend(String(req.params.id), req.body.performedBy || 'api'));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/deployment/composites/:id/resume', (req, res) => {
  try {
    res.json(getDeploymentManager().resume(String(req.params.id), req.body.performedBy || 'api'));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/deployment/composites/:id/retire', (req, res) => {
  try {
    res.json(getDeploymentManager().retire(String(req.params.id), req.body.performedBy || 'api'));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Deployment Plans ──

router.get('/deployment/plans', (_req, res) => {
  res.json(getDeploymentManager().allPlans);
});

router.get('/deployment/plans/:id', (req, res) => {
  const p = getDeploymentManager().getPlan(String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Plan not found' });
  res.json(p);
});

router.post('/deployment/plans', (req, res) => {
  res.status(201).json(getDeploymentManager().createPlan(req.body));
});

router.put('/deployment/plans/:id', (req, res) => {
  try {
    res.json(getDeploymentManager().updatePlan(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/deployment/plans/:id', (req, res) => {
  getDeploymentManager().removePlan(String(req.params.id));
  res.status(204).end();
});

router.get('/deployment/plans/composite/:compositeId', (req, res) => {
  res.json(getDeploymentManager().getPlansByComposite(String(req.params.compositeId)));
});

// ── Deployment Records ──

router.get('/deployment/records', (_req, res) => {
  res.json(getDeploymentManager().allRecords);
});

router.get('/deployment/records/:id', (req, res) => {
  const r = getDeploymentManager().getRecord(String(req.params.id));
  if (!r) return res.status(404).json({ error: 'Record not found' });
  res.json(r);
});

router.get('/deployment/records/composite/:compositeId', (req, res) => {
  res.json(getDeploymentManager().getRecordsByComposite(String(req.params.compositeId)));
});

router.get('/deployment/records/environment/:env', (req, res) => {
  res.json(getDeploymentManager().getRecordsByEnvironment(String(req.params.env) as any));
});

// ── Environments ──

router.get('/deployment/environments', (_req, res) => {
  res.json(getDeploymentManager().allEnvironments);
});

router.get('/deployment/environments/:id', (req, res) => {
  const e = getDeploymentManager().getEnvironment(String(req.params.id));
  if (!e) return res.status(404).json({ error: 'Environment not found' });
  res.json(e);
});

router.post('/deployment/environments', (req, res) => {
  res.status(201).json(getDeploymentManager().createEnvironment(req.body));
});

router.put('/deployment/environments/:id', (req, res) => {
  try {
    res.json(getDeploymentManager().updateEnvironment(String(req.params.id), req.body));
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.delete('/deployment/environments/:id', (req, res) => {
  getDeploymentManager().removeEnvironment(String(req.params.id));
  res.status(204).end();
});

// ── Deployment Stats ──

router.get('/deployment/stats', (_req, res) => {
  res.json(getDeploymentManager().getStats());
});

export default router;
