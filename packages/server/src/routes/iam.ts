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
  const identity = iam.identities.getIdentity(req.params.id);
  if (!identity) return res.status(404).json({ error: 'Identity not found' });
  res.json(identity);
});

router.post('/identities', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.username) return res.status(400).json({ error: 'username is required' });
  const identity = iam.identities.createIdentity(body);
  res.status(201).json(identity);
});

router.put('/identities/:id', (req, res) => {
  const iam = getIAM();
  const updated = iam.identities.updateIdentity(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Identity not found' });
  res.json(updated);
});

router.delete('/identities/:id', (req, res) => {
  const iam = getIAM();
  iam.identities.deleteIdentity(req.params.id);
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

router.post('/identities/:id/deactivate', (req, res) => {
  const iam = getIAM();
  iam.identities.deactivate(String(req.params.id));
  res.json({ success: true, status: 'deactivated' });
});

router.post('/identities/:id/provision', (req, res) => {
  const iam = getIAM();
  iam.identities.provision(String(req.params.id));
  res.json({ success: true, status: 'provisioned' });
});

router.post('/identities/search', (req, res) => {
  const iam = getIAM();
  const results = iam.identities.searchIdentities(req.body);
  res.json(results);
});

router.post('/identities/bulk/create', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkCreateIdentities(req.body.identities ?? []);
  res.json(result);
});

router.post('/identities/bulk/activate', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkActivate(req.body.identityIds ?? []);
  res.json(result);
});

router.post('/identities/bulk/suspend', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkSuspend(req.body.identityIds ?? [], undefined, req.body.reason);
  res.json(result);
});

router.post('/identities/bulk/deactivate', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkDeactivate(req.body.identityIds ?? []);
  res.json(result);
});

router.post('/identities/bulk/delete', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkDelete(req.body.identityIds ?? []);
  res.json(result);
});

// ── Identity Roles ──

router.get('/identities/:id/roles', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getRoles(String(req.params.id)));
});

router.post('/identities/:id/roles', (req, res) => {
  const iam = getIAM();
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role is required' });
  iam.identities.assignRole(String(req.params.id), role);
  res.json({ success: true });
});

router.delete('/identities/:id/roles/:role', (req, res) => {
  const iam = getIAM();
  iam.identities.revokeRole(String(req.params.id), String(req.params.role));
  res.json({ success: true });
});

router.post('/identities/bulk/assign-role', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkAssignRole(req.body.identityIds ?? [], req.body.role);
  res.json(result);
});

router.post('/identities/bulk/revoke-role', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkRevokeRole(req.body.identityIds ?? [], req.body.role);
  res.json(result);
});

// ── Identity Groups ──

router.get('/identities/:id/groups', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getGroups(String(req.params.id)));
});

router.post('/identities/:id/groups', (req, res) => {
  const iam = getIAM();
  const { groupId } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });
  iam.identities.assignGroup(String(req.params.id), groupId);
  res.json({ success: true });
});

router.delete('/identities/:id/groups/:groupId', (req, res) => {
  const iam = getIAM();
  iam.identities.removeGroup(String(req.params.id), String(req.params.groupId));
  res.json({ success: true });
});

router.post('/identities/bulk/assign-group', (req, res) => {
  const iam = getIAM();
  const result = iam.identities.bulkAssignGroup(req.body.identityIds ?? [], req.body.groupId);
  res.json(result);
});

// ── Identity Management Chain ──

router.get('/identities/:id/manager', (req, res) => {
  const iam = getIAM();
  const manager = iam.identities.getManager(String(req.params.id));
  if (!manager) return res.status(404).json({ error: 'No manager found' });
  res.json(manager);
});

router.get('/identities/:id/direct-reports', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getDirectReports(String(req.params.id)));
});

router.get('/identities/:id/management-chain', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getManagementChain(String(req.params.id)));
});

// ============================================================
// IAM Organizations
// ============================================================

router.get('/organizations', (_req, res) => {
  const iam = getIAM();
  res.json(iam.identities.allOrganizations);
});

router.get('/organizations/:id', (req, res) => {
  const iam = getIAM();
  const org = iam.identities.getOrganization(String(req.params.id));
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  res.json(org);
});

router.post('/organizations', (req, res) => {
  const iam = getIAM();
  const org = iam.identities.createOrganization(req.body);
  res.status(201).json(org);
});

router.put('/organizations/:id', (req, res) => {
  const iam = getIAM();
  const org = iam.identities.updateOrganization(String(req.params.id), req.body);
  res.json(org);
});

router.get('/organizations/:id/children', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getChildOrganizations(String(req.params.id)));
});

router.get('/organizations/:id/hierarchy', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getOrganizationHierarchy(String(req.params.id)));
});

router.get('/organizations/:id/members', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getOrganizationMembers(String(req.params.id)));
});

// ============================================================
// IAM Groups
// ============================================================

router.get('/groups', (_req, res) => {
  const iam = getIAM();
  res.json(iam.identities.allGroups);
});

router.get('/groups/:id', (req, res) => {
  const iam = getIAM();
  const group = iam.identities.getGroup(String(req.params.id));
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
});

router.post('/groups', (req, res) => {
  const iam = getIAM();
  const group = iam.identities.createGroup(req.body);
  res.status(201).json(group);
});

router.put('/groups/:id', (req, res) => {
  const iam = getIAM();
  const group = iam.identities.updateGroup(String(req.params.id), req.body);
  res.json(group);
});

router.delete('/groups/:id', (req, res) => {
  const iam = getIAM();
  iam.identities.deleteGroup(String(req.params.id));
  res.json({ success: true });
});

router.get('/groups/:id/members', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getGroupMembers(String(req.params.id)));
});

router.get('/groups/:id/children', (req, res) => {
  const iam = getIAM();
  res.json(iam.identities.getChildGroups(String(req.params.id)));
});

// ============================================================
// IAM Provisioning
// ============================================================

router.get('/provisioning', (_req, res) => {
  const iam = getIAM();
  res.json(iam.identities.allProvisioningRecords);
});

router.get('/provisioning/:id', (req, res) => {
  const iam = getIAM();
  const record = iam.identities.getProvisioningRecord(String(req.params.id));
  if (!record) return res.status(404).json({ error: 'Provisioning record not found' });
  res.json(record);
});

router.post('/provisioning', (req, res) => {
  const iam = getIAM();
  const { identityId, action, requestedBy, details, reason } = req.body;
  if (!identityId || !action || !requestedBy) {
    return res.status(400).json({ error: 'identityId, action, and requestedBy are required' });
  }
  const record = iam.identities.createProvisioningRecord(identityId, action, requestedBy, details, reason);
  res.status(201).json(record);
});

router.post('/provisioning/:id/approve', (req, res) => {
  const iam = getIAM();
  iam.identities.approveProvisioning(String(req.params.id), req.body.approvedBy ?? 'system');
  res.json({ success: true });
});

router.post('/provisioning/:id/reject', (req, res) => {
  const iam = getIAM();
  iam.identities.rejectProvisioning(String(req.params.id), req.body.rejectedBy ?? 'system', req.body.reason);
  res.json({ success: true });
});

// ============================================================
// IAM Roles
// ============================================================

router.get('/roles', (_req, res) => {
  const iam = getIAM();
  res.json(iam.authorization.listRoles());
});

router.get('/roles/:id', (req, res) => {
  const iam = getIAM();
  const role = iam.authorization.getRole(req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json(role);
});

router.post('/roles', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const role = iam.authorization.createRole(body);
  res.status(201).json(role);
});

router.delete('/roles/:id', (req, res) => {
  const iam = getIAM();
  iam.authorization.deleteRole(String(req.params.id));
  res.json({ success: true });
});

router.put('/roles/:id', (req, res) => {
  const iam = getIAM();
  const role = iam.authorization.updateRole(String(req.params.id), req.body);
  res.json(role);
});

router.get('/roles/:id/hierarchy', (req, res) => {
  const iam = getIAM();
  res.json(iam.authorization.getRoleHierarchy(String(req.params.id)));
});

router.get('/roles/:id/inherited', (req, res) => {
  const iam = getIAM();
  res.json(iam.authorization.getInheritedRoles(String(req.params.id)));
});

// ============================================================
// IAM Authorization Policies
// ============================================================

router.get('/policies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.authorization.listPolicies());
});

router.get('/policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.authorization.getPolicy(String(req.params.id));
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  res.json(policy);
});

router.post('/policies', (req, res) => {
  const iam = getIAM();
  const policy = iam.authorization.createPolicy(req.body);
  res.status(201).json(policy);
});

router.put('/policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.authorization.updatePolicy(String(req.params.id), req.body);
  res.json(policy);
});

router.delete('/policies/:id', (req, res) => {
  const iam = getIAM();
  iam.authorization.deletePolicy(String(req.params.id));
  res.json({ success: true });
});

// ── Role Assignments ──

router.get('/role-assignments/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.authorization.getRoleAssignments(String(req.params.identityId)));
});

router.post('/role-assignments', (req, res) => {
  const iam = getIAM();
  const { identityId, roleId, grantedBy, options } = req.body;
  const assignment = iam.authorization.assignRole(identityId, roleId, grantedBy ?? 'system', options);
  res.status(201).json(assignment);
});

router.delete('/role-assignments/:identityId/:roleId', (req, res) => {
  const iam = getIAM();
  iam.authorization.revokeRole(String(req.params.identityId), String(req.params.roleId), 'system');
  res.json({ success: true });
});

router.get('/effective-permissions/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.authorization.getEffectivePermissions(String(req.params.identityId)));
});

router.post('/authorize/batch', (req, res) => {
  const iam = getIAM();
  const results = iam.authorization.batchAuthorize(req.body.requests ?? []);
  res.json(results);
});

// ============================================================
// IAM Authentication
// ============================================================

router.post('/authenticate', (req, res) => {
  const iam = getIAM();
  const result = iam.authentication.authenticate(req.body);
  res.json(result);
});

router.post('/mfa/enroll', (req, res) => {
  const iam = getIAM();
  const { identityId, factorType, method } = req.body;
  const enrollment = iam.authentication.enrollMFA(identityId, factorType, method);
  res.status(201).json(enrollment);
});

router.get('/mfa/enrollments/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.authentication.getMFAEnrollments(String(req.params.identityId)));
});

router.delete('/mfa/enrollments/:identityId/:enrollmentId', (req, res) => {
  const iam = getIAM();
  iam.authentication.unenrollMFA(String(req.params.identityId), String(req.params.enrollmentId));
  res.json({ success: true });
});

router.post('/mfa/verify', (req, res) => {
  const iam = getIAM();
  const { identityId, method, code } = req.body;
  const result = iam.authentication.verifyMFA(identityId, method, code);
  res.json(result);
});

router.get('/auth-policies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.authentication.listAuthPolicies());
});

router.get('/auth-policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.authentication.getAuthPolicy(String(req.params.id));
  if (!policy) return res.status(404).json({ error: 'Auth policy not found' });
  res.json(policy);
});

router.post('/auth-policies', (req, res) => {
  const iam = getIAM();
  const policy = iam.authentication.createAuthPolicy(req.body);
  res.status(201).json(policy);
});

router.delete('/auth-policies/:id', (req, res) => {
  const iam = getIAM();
  iam.authentication.deleteAuthPolicy(String(req.params.id));
  res.json({ success: true });
});

router.get('/sso-configs', (_req, res) => {
  const iam = getIAM();
  res.json(iam.authentication.listSSOConfigs());
});

router.post('/sso-configs', (req, res) => {
  const iam = getIAM();
  const config = iam.authentication.configureSSOConfig(req.body);
  res.status(201).json(config);
});

router.get('/login-history/:identityId', (req, res) => {
  const iam = getIAM();
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json(iam.authentication.getLoginHistory(String(req.params.identityId), limit));
});

// ============================================================
// IAM Sessions
// ============================================================

router.get('/sessions', (_req, res) => {
  const iam = getIAM();
  res.json(iam.sessions.getActiveSessions());
});

router.get('/sessions/:id', (req, res) => {
  const iam = getIAM();
  const session = iam.sessions.getSession(String(req.params.id));
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

router.post('/sessions', (req, res) => {
  const iam = getIAM();
  const session = iam.sessions.createSession(req.body.identityId, req.body);
  res.status(201).json(session);
});

router.post('/sessions/:id/refresh', (req, res) => {
  const iam = getIAM();
  const session = iam.sessions.refreshSession(String(req.params.id));
  res.json(session);
});

router.post('/sessions/:id/validate', (req, res) => {
  const iam = getIAM();
  res.json(iam.sessions.validateSession(String(req.params.id)));
});

router.post('/sessions/:id/revoke', (req, res) => {
  const iam = getIAM();
  iam.sessions.revokeSession(String(req.params.id));
  res.json({ success: true });
});

router.delete('/sessions/:id', (req, res) => {
  const iam = getIAM();
  iam.sessions.destroySession(String(req.params.id));
  res.json({ success: true });
});

router.delete('/sessions/identity/:identityId', (req, res) => {
  const iam = getIAM();
  const count = iam.sessions.revokeAllSessions(String(req.params.identityId));
  res.json({ success: true, revokedCount: count });
});

router.get('/sessions/identity/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.sessions.getSessionsByIdentity(String(req.params.identityId)));
});

router.post('/sessions/query', (req, res) => {
  const iam = getIAM();
  res.json(iam.sessions.querySessions(req.body));
});

router.post('/sessions/cleanup', (_req, res) => {
  const iam = getIAM();
  const cleaned = iam.sessions.cleanupExpiredSessions();
  res.json({ cleaned });
});

// ============================================================
// IAM Tokens
// ============================================================

router.post('/tokens/issue', (req, res) => {
  const iam = getIAM();
  const token = iam.tokens.issueToken(req.body);
  res.status(201).json(token);
});

router.post('/tokens/access', (req, res) => {
  const iam = getIAM();
  const { identityId, scope, claims, ttlSeconds } = req.body;
  const token = iam.tokens.issueAccessToken(identityId, scope, claims, ttlSeconds);
  res.status(201).json(token);
});

router.post('/tokens/refresh', (req, res) => {
  const iam = getIAM();
  const { identityId, accessTokenId, scope } = req.body;
  const token = iam.tokens.issueRefreshToken(identityId, accessTokenId, scope);
  res.status(201).json(token);
});

router.post('/tokens/refresh/:id', (req, res) => {
  const iam = getIAM();
  const token = iam.tokens.refreshAccessToken(String(req.params.id));
  res.json(token);
});

router.post('/tokens/id-token', (req, res) => {
  const iam = getIAM();
  const { identityId, clientId, claims } = req.body;
  const token = iam.tokens.issueIdToken(identityId, clientId, claims);
  res.status(201).json(token);
});

router.post('/tokens/api-key', (req, res) => {
  const iam = getIAM();
  const token = iam.tokens.issueAPIKey(req.body.identityId, req.body);
  res.status(201).json(token);
});

router.get('/tokens/:id/validate', (req, res) => {
  const iam = getIAM();
  const result = iam.tokens.validateToken(String(req.params.id));
  res.json(result);
});

router.get('/tokens/:id/introspect', (req, res) => {
  const iam = getIAM();
  const token = iam.tokens.introspectToken(String(req.params.id));
  if (!token) return res.status(404).json({ error: 'Token not found' });
  res.json(token);
});

router.post('/tokens/:id/revoke', (req, res) => {
  const iam = getIAM();
  iam.tokens.revokeToken(String(req.params.id));
  res.json({ success: true });
});

router.delete('/tokens/identity/:identityId', (req, res) => {
  const iam = getIAM();
  const count = iam.tokens.revokeAllTokens(String(req.params.identityId));
  res.json({ success: true, revokedCount: count });
});

router.delete('/tokens/client/:clientId', (req, res) => {
  const iam = getIAM();
  const count = iam.tokens.revokeByClient(String(req.params.clientId));
  res.json({ success: true, revokedCount: count });
});

router.get('/tokens/identity/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.tokens.getTokensByIdentity(String(req.params.identityId)));
});

router.get('/tokens/identity/:identityId/active', (req, res) => {
  const iam = getIAM();
  res.json(iam.tokens.getActiveTokensByIdentity(String(req.params.identityId)));
});

router.post('/tokens/exchange', (req, res) => {
  const iam = getIAM();
  const result = iam.tokens.exchangeToken(req.body);
  res.json(result);
});

router.post('/tokens/cleanup', (_req, res) => {
  const iam = getIAM();
  const cleaned = iam.tokens.cleanupExpiredTokens();
  res.json({ cleaned });
});

// ============================================================
// IAM Federation (Identity Providers)
// ============================================================

router.get('/federation/idps', (_req, res) => {
  const iam = getIAM();
  res.json(iam.federation.listIdentityProviders());
});

router.get('/federation/idps/:id', (req, res) => {
  const iam = getIAM();
  const provider = iam.federation.getIdentityProvider(String(req.params.id));
  if (!provider) return res.status(404).json({ error: 'Identity provider not found' });
  res.json(provider);
});

router.post('/federation/idps', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const provider = iam.federation.registerIdentityProvider(body);
  res.status(201).json(provider);
});

router.put('/federation/idps/:id', (req, res) => {
  const iam = getIAM();
  const provider = iam.federation.updateIdentityProvider(String(req.params.id), req.body);
  res.json(provider);
});

router.delete('/federation/idps/:id', (req, res) => {
  const iam = getIAM();
  iam.federation.deleteIdentityProvider(String(req.params.id));
  res.json({ success: true });
});

// ── Service Providers ──

router.get('/federation/sps', (_req, res) => {
  const iam = getIAM();
  res.json(iam.federation.listServiceProviders());
});

router.get('/federation/sps/:id', (req, res) => {
  const iam = getIAM();
  const sp = iam.federation.getServiceProvider(String(req.params.id));
  if (!sp) return res.status(404).json({ error: 'Service provider not found' });
  res.json(sp);
});

router.post('/federation/sps', (req, res) => {
  const iam = getIAM();
  const sp = iam.federation.registerServiceProvider(req.body);
  res.status(201).json(sp);
});

router.put('/federation/sps/:id', (req, res) => {
  const iam = getIAM();
  const sp = iam.federation.updateServiceProvider(String(req.params.id), req.body);
  res.json(sp);
});

router.delete('/federation/sps/:id', (req, res) => {
  const iam = getIAM();
  iam.federation.deleteServiceProvider(String(req.params.id));
  res.json({ success: true });
});

// ── Federation Trusts ──

router.get('/federation/trusts', (_req, res) => {
  const iam = getIAM();
  res.json(iam.federation.listTrusts());
});

router.get('/federation/trusts/:id', (req, res) => {
  const iam = getIAM();
  const trust = iam.federation.getTrust(String(req.params.id));
  if (!trust) return res.status(404).json({ error: 'Trust not found' });
  res.json(trust);
});

router.post('/federation/trusts', (req, res) => {
  const iam = getIAM();
  const trust = iam.federation.createTrust(req.body);
  res.status(201).json(trust);
});

router.delete('/federation/trusts/:id', (req, res) => {
  const iam = getIAM();
  iam.federation.deleteTrust(String(req.params.id));
  res.json({ success: true });
});

// ── SCIM Provisioning ──

router.get('/federation/scim', (_req, res) => {
  const iam = getIAM();
  res.json(iam.federation.listSCIMConfigs());
});

router.get('/federation/scim/:id', (req, res) => {
  const iam = getIAM();
  const config = iam.federation.getSCIMConfig(String(req.params.id));
  if (!config) return res.status(404).json({ error: 'SCIM config not found' });
  res.json(config);
});

router.post('/federation/scim', (req, res) => {
  const iam = getIAM();
  const config = iam.federation.configureSCIM(req.body);
  res.status(201).json(config);
});

router.post('/federation/scim/:id/sync', (req, res) => {
  const iam = getIAM();
  const result = iam.federation.triggerSCIMSync(String(req.params.id));
  res.json(result);
});

// ============================================================
// IAM Governance
// ============================================================

// ── Campaigns ──

router.get('/governance/campaigns', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.listCampaigns());
});

router.get('/governance/campaigns/:id', (req, res) => {
  const iam = getIAM();
  const campaign = iam.governance.getCampaign(String(req.params.id));
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.post('/governance/campaigns', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const campaign = iam.governance.createCampaign(body);
  res.status(201).json(campaign);
});

router.post('/governance/campaigns/:id/start', (req, res) => {
  const iam = getIAM();
  iam.governance.startCampaign(String(req.params.id));
  res.json({ success: true });
});

router.post('/governance/campaigns/:id/complete', (req, res) => {
  const iam = getIAM();
  iam.governance.completeCampaign(String(req.params.id));
  res.json({ success: true });
});

router.get('/governance/campaigns/:id/decisions', (req, res) => {
  const iam = getIAM();
  res.json(iam.governance.getDecisionsByCampaign(String(req.params.id)));
});

router.get('/governance/campaigns/:id/pending', (req, res) => {
  const iam = getIAM();
  res.json({ pendingCount: iam.governance.getPendingDecisions(String(req.params.id)) });
});

// ── Decisions ──

router.get('/governance/decisions/:id', (req, res) => {
  const iam = getIAM();
  const decision = iam.governance.getDecision(String(req.params.id));
  if (!decision) return res.status(404).json({ error: 'Decision not found' });
  res.json(decision);
});

router.post('/governance/decisions', (req, res) => {
  const iam = getIAM();
  const decision = iam.governance.recordDecision(req.body);
  res.status(201).json(decision);
});

router.get('/governance/decisions/reviewer/:reviewerId', (req, res) => {
  const iam = getIAM();
  res.json(iam.governance.getDecisionsByReviewer(String(req.params.reviewerId)));
});

// ── SoD Policies ──

router.get('/governance/sod-policies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.listSoDPolicies());
});

router.get('/governance/sod-policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.governance.getSoDPolicy(String(req.params.id));
  if (!policy) return res.status(404).json({ error: 'SoD policy not found' });
  res.json(policy);
});

router.post('/governance/sod-policies', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const policy = iam.governance.createSoDPolicy(body);
  res.status(201).json(policy);
});

router.put('/governance/sod-policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.governance.updateSoDPolicy(String(req.params.id), req.body);
  res.json(policy);
});

router.delete('/governance/sod-policies/:id', (req, res) => {
  const iam = getIAM();
  iam.governance.deleteSoDPolicy(String(req.params.id));
  res.json({ success: true });
});

router.post('/governance/sod-evaluate', (req, res) => {
  const iam = getIAM();
  const { identityId, proposedRoleId } = req.body;
  const violations = iam.governance.evaluateSoD(identityId, proposedRoleId);
  res.json(violations);
});

router.post('/governance/sod-evaluate-all', (req, res) => {
  const iam = getIAM();
  const { identityId, currentRoles } = req.body;
  const violations = iam.governance.evaluateAllSoD(identityId, currentRoles);
  res.json(violations);
});

// ── SoD Exemptions ──

router.get('/governance/exemptions', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.listExemptions());
});

router.get('/governance/exemptions/:id', (req, res) => {
  const iam = getIAM();
  const exemption = iam.governance.getExemption(String(req.params.id));
  if (!exemption) return res.status(404).json({ error: 'Exemption not found' });
  res.json(exemption);
});

router.post('/governance/exemptions', (req, res) => {
  const iam = getIAM();
  const exemption = iam.governance.createExemption(req.body);
  res.status(201).json(exemption);
});

// ── SoD Violations ──

router.get('/governance/violations', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.getActiveViolations());
});

router.get('/governance/violations/:id', (req, res) => {
  const iam = getIAM();
  const violation = iam.governance.getViolation(String(req.params.id));
  if (!violation) return res.status(404).json({ error: 'Violation not found' });
  res.json(violation);
});

router.get('/governance/violations/identity/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.governance.getViolationsByIdentity(String(req.params.identityId)));
});

router.post('/governance/violations/:id/resolve', (req, res) => {
  const iam = getIAM();
  iam.governance.resolveViolation(String(req.params.id), req.body.resolvedBy ?? 'system');
  res.json({ success: true });
});

// ── Access Requests ──

router.get('/governance/access-requests', (_req, res) => {
  const iam = getIAM();
  res.json(iam.governance.getPendingAccessRequests());
});

router.get('/governance/access-requests/:id', (req, res) => {
  const iam = getIAM();
  const request = iam.governance.getAccessRequest(String(req.params.id));
  if (!request) return res.status(404).json({ error: 'Access request not found' });
  res.json(request);
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

router.post('/governance/access-requests/:id/approve', (req, res) => {
  const iam = getIAM();
  iam.governance.approveAccessRequest(String(req.params.id), req.body.approverId ?? 'system', req.body.justification);
  res.json({ success: true });
});

router.post('/governance/access-requests/:id/reject', (req, res) => {
  const iam = getIAM();
  iam.governance.rejectAccessRequest(String(req.params.id), req.body.approverId ?? 'system', req.body.justification);
  res.json({ success: true });
});

router.post('/governance/access-requests/:id/cancel', (req, res) => {
  const iam = getIAM();
  iam.governance.cancelAccessRequest(String(req.params.id));
  res.json({ success: true });
});

router.post('/governance/access-requests/:id/fulfill', (req, res) => {
  const iam = getIAM();
  iam.governance.fulfillAccessRequest(String(req.params.id));
  res.json({ success: true });
});

router.get('/governance/access-requests/identity/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.governance.getAccessRequestsByIdentity(String(req.params.identityId)));
});

// ============================================================
// IAM PAM (Privileged Access Management)
// ============================================================

// ── Vaults ──

router.get('/pam/vaults', (_req, res) => {
  const iam = getIAM();
  res.json(iam.pam.listVaults());
});

router.get('/pam/vaults/:id', (req, res) => {
  const iam = getIAM();
  const vault = iam.pam.getVault(String(req.params.id));
  if (!vault) return res.status(404).json({ error: 'Vault not found' });
  res.json(vault);
});

router.post('/pam/vaults', (req, res) => {
  const iam = getIAM();
  const vault = iam.pam.createVault(req.body);
  res.status(201).json(vault);
});

router.post('/pam/vaults/:id/seal', (req, res) => {
  const iam = getIAM();
  iam.pam.sealVault(String(req.params.id));
  res.json({ success: true });
});

router.post('/pam/vaults/:id/unseal', (req, res) => {
  const iam = getIAM();
  iam.pam.unsealVault(String(req.params.id));
  res.json({ success: true });
});

// ── Privileged Accounts ──

router.get('/pam/accounts', (_req, res) => {
  const iam = getIAM();
  res.json(iam.pam.listAccounts());
});

router.get('/pam/accounts/:id', (req, res) => {
  const iam = getIAM();
  const account = iam.pam.getAccount(String(req.params.id));
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

router.post('/pam/accounts', (req, res) => {
  const iam = getIAM();
  const body = req.body;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const account = iam.pam.registerAccount(body);
  res.status(201).json(account);
});

router.put('/pam/accounts/:id', (req, res) => {
  const iam = getIAM();
  const account = iam.pam.updateAccount(String(req.params.id), req.body);
  res.json(account);
});

router.post('/pam/accounts/:id/disable', (req, res) => {
  const iam = getIAM();
  iam.pam.disableAccount(String(req.params.id));
  res.json({ success: true });
});

router.post('/pam/accounts/:id/enable', (req, res) => {
  const iam = getIAM();
  iam.pam.enableAccount(String(req.params.id));
  res.json({ success: true });
});

router.get('/pam/accounts/vault/:vaultId', (req, res) => {
  const iam = getIAM();
  res.json(iam.pam.getAccountsByVault(String(req.params.vaultId)));
});

// ── Checkouts ──

router.post('/pam/accounts/:id/checkout', (req, res) => {
  const iam = getIAM();
  const { identityId, reason, approvedBy } = req.body;
  if (!identityId || !reason) {
    return res.status(400).json({ error: 'identityId and reason are required' });
  }
  const checkout = iam.pam.checkout(String(req.params.id), identityId, reason, approvedBy);
  res.status(201).json(checkout);
});

router.post('/pam/checkouts/:id/checkin', (req, res) => {
  const iam = getIAM();
  iam.pam.checkin(String(req.params.id));
  res.json({ success: true });
});

router.get('/pam/checkouts', (_req, res) => {
  const iam = getIAM();
  res.json(iam.pam.getActiveCheckouts());
});

router.get('/pam/checkouts/:id', (req, res) => {
  const iam = getIAM();
  const checkout = iam.pam.getCheckout(String(req.params.id));
  if (!checkout) return res.status(404).json({ error: 'Checkout not found' });
  res.json(checkout);
});

router.get('/pam/checkouts/identity/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.pam.getCheckoutsByIdentity(String(req.params.identityId)));
});

router.post('/pam/checkouts/:id/terminate', (req, res) => {
  const iam = getIAM();
  iam.pam.terminateCheckout(String(req.params.id), req.body.reason ?? 'terminated');
  res.json({ success: true });
});

// ── Session Recordings ──

router.post('/pam/checkouts/:id/recording/start', (req, res) => {
  const iam = getIAM();
  const recording = iam.pam.startRecording(String(req.params.id));
  res.status(201).json(recording);
});

router.post('/pam/recordings/:id/stop', (req, res) => {
  const iam = getIAM();
  const recording = iam.pam.stopRecording(String(req.params.id));
  res.json(recording);
});

router.get('/pam/recordings/:id', (req, res) => {
  const iam = getIAM();
  const recording = iam.pam.getRecording(String(req.params.id));
  if (!recording) return res.status(404).json({ error: 'Recording not found' });
  res.json(recording);
});

router.get('/pam/recordings/account/:accountId', (req, res) => {
  const iam = getIAM();
  res.json(iam.pam.getRecordingsByAccount(String(req.params.accountId)));
});

// ── Command Execution ──

router.post('/pam/checkouts/:id/execute', (req, res) => {
  const iam = getIAM();
  const result = iam.pam.executeCommand(String(req.params.id), req.body.command);
  res.json(result);
});

// ── Credential Rotation ──

router.get('/pam/rotation-policies', (_req, res) => {
  const iam = getIAM();
  const accounts = iam.pam.listAccounts();
  res.json(accounts.filter((a: any) => a.rotationPolicyId));
});

router.post('/pam/rotation-policies', (req, res) => {
  const iam = getIAM();
  const policy = iam.pam.registerRotationPolicy(req.body);
  res.status(201).json(policy);
});

router.post('/pam/accounts/:id/rotate', (req, res) => {
  const iam = getIAM();
  const result = iam.pam.rotateCredential(String(req.params.id));
  res.json(result);
});

router.get('/pam/accounts/requiring-rotation', (_req, res) => {
  const iam = getIAM();
  res.json(iam.pam.getAccountsRequiringRotation());
});

// ============================================================
// IAM Risk
// ============================================================

router.post('/risk/assess', (req, res) => {
  const iam = getIAM();
  const { identityId, context } = req.body;
  if (!identityId) return res.status(400).json({ error: 'identityId is required' });
  const assessment = iam.risk.assessRisk(identityId, context ?? {});
  res.json(assessment);
});

router.get('/risk/assessments/:identityId', (req, res) => {
  const iam = getIAM();
  const assessment = iam.risk.getLatestAssessment(String(req.params.identityId));
  if (!assessment) return res.status(404).json({ error: 'No assessment found for identity' });
  res.json(assessment);
});

router.get('/risk/history/:identityId', (req, res) => {
  const iam = getIAM();
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json(iam.risk.getRiskHistory(String(req.params.identityId), limit));
});

router.get('/risk/anomalies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.risk.getRecentAnomalies());
});

router.get('/risk/anomalies/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.risk.getAnomalies(String(req.params.identityId)));
});

router.post('/risk/detect-anomalies', (req, res) => {
  const iam = getIAM();
  const { identityId, context } = req.body;
  const results = iam.risk.detectAnomalies(identityId, context ?? {});
  res.json(results);
});

// ── Risk Rules ──

router.get('/risk/rules', (_req, res) => {
  const iam = getIAM();
  res.json(iam.risk.listRules());
});

router.get('/risk/rules/:id', (req, res) => {
  const iam = getIAM();
  const rule = iam.risk.getRule(String(req.params.id));
  if (!rule) return res.status(404).json({ error: 'Risk rule not found' });
  res.json(rule);
});

router.post('/risk/rules', (req, res) => {
  const iam = getIAM();
  const rule = iam.risk.createRule(req.body);
  res.status(201).json(rule);
});

router.put('/risk/rules/:id', (req, res) => {
  const iam = getIAM();
  const rule = iam.risk.updateRule(String(req.params.id), req.body);
  res.json(rule);
});

router.delete('/risk/rules/:id', (req, res) => {
  const iam = getIAM();
  iam.risk.deleteRule(String(req.params.id));
  res.json({ success: true });
});

// ── Behavioral Profiles ──

router.get('/risk/profiles', (_req, res) => {
  const iam = getIAM();
  res.json(iam.risk.listProfiles());
});

router.get('/risk/profiles/:identityId', (req, res) => {
  const iam = getIAM();
  const profile = iam.risk.getProfile(String(req.params.identityId));
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

router.post('/risk/profiles/:identityId', (req, res) => {
  const iam = getIAM();
  const profile = iam.risk.updateProfile(String(req.params.identityId), req.body);
  res.json(profile);
});

// ── Threat Indicators ──

router.get('/risk/threat-indicators', (_req, res) => {
  const iam = getIAM();
  res.json(iam.risk.listThreatIndicators());
});

router.get('/risk/threat-indicators/:id', (req, res) => {
  const iam = getIAM();
  const indicator = iam.risk.getThreatIndicator(String(req.params.id));
  if (!indicator) return res.status(404).json({ error: 'Threat indicator not found' });
  res.json(indicator);
});

router.post('/risk/threat-indicators', (req, res) => {
  const iam = getIAM();
  const indicator = iam.risk.addThreatIndicator(req.body);
  res.status(201).json(indicator);
});

router.delete('/risk/threat-indicators/:id', (req, res) => {
  const iam = getIAM();
  iam.risk.removeThreatIndicator(String(req.params.id));
  res.json({ success: true });
});

router.post('/risk/threat-indicators/check', (req, res) => {
  const iam = getIAM();
  const { type, value } = req.body;
  const match = iam.risk.checkThreatIntel(type, value);
  res.json({ matched: !!match, indicator: match ?? null });
});

router.post('/risk/threat-indicators/cleanup', (_req, res) => {
  const iam = getIAM();
  const cleaned = iam.risk.cleanupExpiredIndicators();
  res.json({ cleaned });
});

// ============================================================
// IAM Credentials
// ============================================================

// ── Password Policies ──

router.get('/credentials/password-policies', (_req, res) => {
  const iam = getIAM();
  res.json(iam.credentials.listPasswordPolicies());
});

router.get('/credentials/password-policies/default', (_req, res) => {
  const iam = getIAM();
  res.json(iam.credentials.getDefaultPolicy());
});

router.get('/credentials/password-policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.credentials.getPasswordPolicy(String(req.params.id));
  if (!policy) return res.status(404).json({ error: 'Password policy not found' });
  res.json(policy);
});

router.post('/credentials/password-policies', (req, res) => {
  const iam = getIAM();
  const policy = iam.credentials.createPasswordPolicy(req.body);
  res.status(201).json(policy);
});

router.put('/credentials/password-policies/:id', (req, res) => {
  const iam = getIAM();
  const policy = iam.credentials.updatePasswordPolicy(String(req.params.id), req.body);
  res.json(policy);
});

router.delete('/credentials/password-policies/:id', (req, res) => {
  const iam = getIAM();
  iam.credentials.deletePasswordPolicy(String(req.params.id));
  res.json({ success: true });
});

// ── Password Operations ──

router.post('/credentials/set-password', (req, res) => {
  const iam = getIAM();
  const { identityId, password, policyId } = req.body;
  const result = iam.credentials.setPassword(identityId, password, policyId);
  res.json(result);
});

router.post('/credentials/change-password', (req, res) => {
  const iam = getIAM();
  const { identityId, oldPassword, newPassword } = req.body;
  const result = iam.credentials.changePassword(identityId, oldPassword, newPassword);
  res.json(result);
});

router.post('/credentials/reset-password', (req, res) => {
  const iam = getIAM();
  const { identityId, newPassword } = req.body;
  const result = iam.credentials.resetPassword(identityId, newPassword);
  res.json(result);
});

router.post('/credentials/validate-strength', (req, res) => {
  const iam = getIAM();
  const { password, policyId } = req.body;
  const result = iam.credentials.validatePasswordStrength(password, policyId);
  res.json(result);
});

router.post('/credentials/force-change', (req, res) => {
  const iam = getIAM();
  iam.credentials.forcePasswordChange(req.body.identityId);
  res.json({ success: true });
});

// ── Credential Records ──

router.get('/credentials/identity/:identityId', (req, res) => {
  const iam = getIAM();
  res.json(iam.credentials.getCredentialsByIdentity(String(req.params.identityId)));
});

router.get('/credentials/:id', (req, res) => {
  const iam = getIAM();
  const credential = iam.credentials.getCredential(String(req.params.id));
  if (!credential) return res.status(404).json({ error: 'Credential not found' });
  res.json(credential);
});

router.post('/credentials', (req, res) => {
  const iam = getIAM();
  const { identityId, type, name, metadata } = req.body;
  if (!identityId || !type) return res.status(400).json({ error: 'identityId and type are required' });
  const credential = iam.credentials.createCredential(identityId, type, name, metadata);
  res.status(201).json(credential);
});

router.post('/credentials/:id/revoke', (req, res) => {
  const iam = getIAM();
  iam.credentials.revokeCredential(String(req.params.id));
  res.json({ success: true });
});

router.post('/credentials/:id/rotate', (req, res) => {
  const iam = getIAM();
  const credential = iam.credentials.rotateCredential(String(req.params.id));
  res.json(credential);
});

router.post('/credentials/:id/compromised', (req, res) => {
  const iam = getIAM();
  iam.credentials.markCompromised(String(req.params.id));
  res.json({ success: true });
});

// ── API Keys ──

router.post('/credentials/api-keys', (req, res) => {
  const iam = getIAM();
  const result = iam.credentials.generateAPIKey(req.body.identityId, req.body);
  res.status(201).json(result);
});

router.post('/credentials/api-keys/validate', (req, res) => {
  const iam = getIAM();
  const result = iam.credentials.validateAPIKey(req.body.apiKey);
  res.json(result);
});

// ── Recovery Codes ──

router.post('/credentials/recovery-codes', (req, res) => {
  const iam = getIAM();
  const codes = iam.credentials.generateRecoveryCodes(req.body.identityId, req.body);
  res.status(201).json(codes);
});

router.post('/credentials/recovery-codes/validate', (req, res) => {
  const iam = getIAM();
  const { identityId, code } = req.body;
  const valid = iam.credentials.validateRecoveryCode(identityId, code);
  res.json({ valid });
});

// ============================================================
// IAM Directory
// ============================================================

router.get('/directory/entries', (req, res) => {
  const iam = getIAM();
  const baseDn = String(req.query.baseDn ?? '');
  const entries = iam.directory.search({ baseDn, scope: 'subtree', filter: {} as any });
  res.json(entries);
});

router.get('/directory/entries/:dn', (req, res) => {
  const iam = getIAM();
  const entry = iam.directory.getEntry(String(req.params.dn));
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  res.json(entry);
});

router.post('/directory/entries', (req, res) => {
  const iam = getIAM();
  const entry = iam.directory.addEntry(req.body);
  res.status(201).json(entry);
});

router.put('/directory/entries/:dn', (req, res) => {
  const iam = getIAM();
  const entry = iam.directory.modifyEntry(String(req.params.dn), req.body);
  res.json(entry);
});

router.delete('/directory/entries/:dn', (req, res) => {
  const iam = getIAM();
  iam.directory.deleteEntry(String(req.params.dn));
  res.json({ success: true });
});

router.post('/directory/entries/:dn/move', (req, res) => {
  const iam = getIAM();
  const entry = iam.directory.moveEntry(String(req.params.dn), req.body.newParentDn);
  res.json(entry);
});

router.get('/directory/entries/:dn/children', (req, res) => {
  const iam = getIAM();
  res.json(iam.directory.getChildren(String(req.params.dn)));
});

router.get('/directory/entries/:dn/subtree', (req, res) => {
  const iam = getIAM();
  res.json(iam.directory.getSubtree(String(req.params.dn)));
});

router.post('/directory/search', (req, res) => {
  const iam = getIAM();
  res.json(iam.directory.search(req.body));
});

router.post('/directory/compare', (req, res) => {
  const iam = getIAM();
  const { dn, attribute, value } = req.body;
  res.json({ match: iam.directory.compare(dn, attribute, value) });
});

// ── Directory Schemas ──

router.get('/directory/schemas/:id', (req, res) => {
  const iam = getIAM();
  const schema = iam.directory.getSchema(String(req.params.id));
  if (!schema) return res.status(404).json({ error: 'Schema not found' });
  res.json(schema);
});

router.post('/directory/schemas', (req, res) => {
  const iam = getIAM();
  iam.directory.registerSchema(req.body);
  res.status(201).json({ success: true });
});

router.post('/directory/validate', (req, res) => {
  const iam = getIAM();
  res.json(iam.directory.validateEntry(req.body));
});

// ============================================================
// IAM Security (Audit, Masking, Access Control)
// ============================================================

router.get('/security/audit', (req, res) => {
  const iam = getIAM();
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  res.json(iam.security.auditLogger.getAuditLog({ limit }));
});

router.post('/security/audit', (req, res) => {
  const iam = getIAM();
  const entry = iam.security.recordAudit(req.body);
  res.status(201).json(entry);
});

router.post('/security/mask', (req, res) => {
  const iam = getIAM();
  const { data } = req.body;
  res.json(iam.security.masker.maskData(data));
});

// ============================================================
// IAM Monitoring
// ============================================================

router.get('/monitoring/alerts', (_req, res) => {
  const iam = getIAM();
  res.json(iam.monitoring.alerts.getActiveAlerts());
});

router.post('/monitoring/alerts/:id/acknowledge', (req, res) => {
  const iam = getIAM();
  iam.monitoring.alerts.acknowledgeAlert(String(req.params.id));
  res.json({ success: true });
});

router.post('/monitoring/alerts/:id/resolve', (req, res) => {
  const iam = getIAM();
  iam.monitoring.alerts.resolveAlert(String(req.params.id));
  res.json({ success: true });
});

router.get('/monitoring/alert-rules', (_req, res) => {
  const iam = getIAM();
  res.json(iam.monitoring.alerts.listRules());
});

router.post('/monitoring/alert-rules', (req, res) => {
  const iam = getIAM();
  iam.monitoring.alerts.registerRule(req.body);
  res.status(201).json({ success: true });
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
