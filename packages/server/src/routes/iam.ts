import { Router } from 'express';
import { getIAM } from '../services/integration';

const router = Router();

// ============================================================
// IAM Identities
// ============================================================

router.get('/identities', (_req, res) => {
  const iam = getIAM();
  const identities = iam.identities.allIdentities.map((i: any) => ({
    id: i.id,
    username: i.username,
    displayName: i.displayName,
    email: i.email,
    status: i.status,
    type: i.type,
    roleCount: i.roles?.length ?? 0,
    createdAt: i.createdAt,
  }));
  res.json(identities);
});

router.get('/identities/:id', (req, res) => {
  const iam = getIAM();
  const identity = iam.identities.get(req.params.id);
  if (!identity) return res.status(404).json({ error: 'Identity not found' });
  res.json(identity);
});

router.post('/identities', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.username) return res.status(400).json({ error: 'username is required' });
  const identity = iam.identities.create(body);
  res.status(201).json(identity);
});

router.put('/identities/:id', (req, res) => {
  const iam = getIAM();
  const updated = iam.identities.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Identity not found' });
  res.json(updated);
});

router.delete('/identities/:id', (req, res) => {
  const iam = getIAM();
  iam.identities.delete(req.params.id);
  res.json({ success: true });
});

router.post('/identities/:id/activate', (req, res) => {
  const iam = getIAM();
  iam.identities.activate(req.params.id);
  res.json({ success: true, status: 'active' });
});

router.post('/identities/:id/suspend', (req, res) => {
  const iam = getIAM();
  iam.identities.suspend(req.params.id);
  res.json({ success: true, status: 'suspended' });
});

router.post('/identities/:id/lock', (req, res) => {
  const iam = getIAM();
  iam.identities.lock(req.params.id);
  res.json({ success: true, status: 'locked' });
});

router.post('/identities/:id/unlock', (req, res) => {
  const iam = getIAM();
  iam.identities.unlock(req.params.id);
  res.json({ success: true, status: 'unlocked' });
});

// ============================================================
// IAM Roles
// ============================================================

router.get('/roles', (_req, res) => {
  const iam = getIAM();
  res.json(iam.roles.allRoles);
});

router.get('/roles/:id', (req, res) => {
  const iam = getIAM();
  const role = iam.roles.get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json(role);
});

router.post('/roles', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const role = iam.roles.create(body);
  res.status(201).json(role);
});

router.delete('/roles/:id', (req, res) => {
  const iam = getIAM();
  iam.roles.delete(req.params.id);
  res.json({ success: true });
});

// ============================================================
// IAM Authorization
// ============================================================

router.post('/authorize', (req, res) => {
  const iam = getIAM();
  const { subjectId, resource, action } = req.body;
  if (!subjectId || !resource || !action) {
    return res.status(400).json({ error: 'subjectId, resource, and action are required' });
  }
  const result = iam.authorization.authorize({ subjectId, resource, action });
  res.json(result);
});

// ============================================================
// IAM Sessions
// ============================================================

router.get('/sessions', (_req, res) => {
  const iam = getIAM();
  res.json(iam.sessions.activeSessions);
});

router.get('/sessions/:id', (req, res) => {
  const iam = getIAM();
  const session = iam.sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

router.post('/sessions/:id/revoke', (req, res) => {
  const iam = getIAM();
  iam.sessions.revoke(req.params.id);
  res.json({ success: true });
});

router.delete('/sessions/identity/:identityId', (req, res) => {
  const iam = getIAM();
  iam.sessions.revokeAllForIdentity(req.params.identityId);
  res.json({ success: true });
});

// ============================================================
// IAM Tokens
// ============================================================

router.post('/tokens/issue', (req, res) => {
  const iam = getIAM();
  const token = iam.tokens.issue(req.body);
  res.status(201).json(token);
});

router.get('/tokens/:id/validate', (req, res) => {
  const iam = getIAM();
  const result = iam.tokens.validate(req.params.id);
  res.json(result);
});

router.post('/tokens/:id/revoke', (req, res) => {
  const iam = getIAM();
  iam.tokens.revoke(req.params.id);
  res.json({ success: true });
});

// ============================================================
// IAM Federation (Identity Providers)
// ============================================================

router.get('/federation/idps', (_req, res) => {
  const iam = getIAM();
  res.json(iam.federation.allProviders);
});

router.get('/federation/idps/:id', (req, res) => {
  const iam = getIAM();
  const provider = iam.federation.getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Identity provider not found' });
  res.json(provider);
});

router.post('/federation/idps', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const provider = iam.federation.registerProvider(body);
  res.status(201).json(provider);
});

// ============================================================
// IAM Governance
// ============================================================

router.get('/governance/campaigns', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.allCampaigns);
});

router.post('/governance/campaigns', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const campaign = iam.governance.createCampaign(body);
  res.status(201).json(campaign);
});

router.get('/governance/sod-policies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.allSodPolicies);
});

router.post('/governance/sod-policies', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const policy = iam.governance.createSodPolicy(body);
  res.status(201).json(policy);
});

router.get('/governance/access-requests', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.pendingAccessRequests);
});

router.post('/governance/access-requests', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.identityId || !body.resource) {
    return res.status(400).json({ error: 'identityId and resource are required' });
  }
  const request = iam.governance.createAccessRequest(body);
  res.status(201).json(request);
});

// ============================================================
// IAM PAM (Privileged Access Management)
// ============================================================

router.get('/pam/accounts', (_req, res) => {
  const iam = getIAM();
  res.json(iam.pam.allAccounts);
});

router.post('/pam/accounts', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const account = iam.pam.registerAccount(body);
  res.status(201).json(account);
});

router.post('/pam/accounts/:id/checkout', (req, res) => {
  const iam = getIAM();
  const checkout = iam.pam.checkout(req.params.id, req.body);
  res.status(201).json(checkout);
});

router.post('/pam/checkouts/:id/checkin', (req, res) => {
  const iam = getIAM();
  iam.pam.checkin(req.params.id);
  res.json({ success: true });
});

// ============================================================
// IAM Risk
// ============================================================

router.post('/risk/assess', (req, res) => {
  const iam = getIAM();
  const { identityId, context } = req.body;
  if (!identityId) return res.status(400).json({ error: 'identityId is required' });
  const assessment = iam.risk.assess(identityId, context ?? {});
  res.json(assessment);
});

router.get('/risk/assessments/:identityId', (req, res) => {
  const iam = getIAM();
  const assessment = iam.risk.getLatestAssessment(req.params.identityId);
  if (!assessment) return res.status(404).json({ error: 'No assessment found for identity' });
  res.json(assessment);
});

router.get('/risk/anomalies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.risk.recentAnomalies);
});

// ============================================================
// IAM Metrics
// ============================================================

router.get('/metrics', (_req, res) => {
  const iam = getIAM();
  const metrics = iam.getMetrics();
  res.json(metrics);
});

export default router;
