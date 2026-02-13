import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Projects
export const getProjects = () => api.get('/projects').then((r) => r.data);
export const getProject = (id: string) => api.get(`/projects/${id}`).then((r) => r.data);
export const createProject = (data: { name: string; description?: string }) =>
  api.post('/projects', data).then((r) => r.data);
export const updateProject = (id: string, data: any) =>
  api.put(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`).then((r) => r.data);

// Rule Sets
export const getRuleSets = (projectId?: string) =>
  api.get('/rule-sets', { params: { projectId } }).then((r) => r.data);
export const getRuleSet = (id: string) => api.get(`/rule-sets/${id}`).then((r) => r.data);
export const createRuleSet = (data: { projectId: string; name: string; description?: string; inputModelId?: string }) =>
  api.post('/rule-sets', data).then((r) => r.data);
export const updateRuleSet = (id: string, data: any) =>
  api.put(`/rule-sets/${id}`, data).then((r) => r.data);
export const deleteRuleSet = (id: string) =>
  api.delete(`/rule-sets/${id}`).then((r) => r.data);

// Rules
export const getRules = (ruleSetId: string) =>
  api.get('/rules', { params: { ruleSetId } }).then((r) => r.data);
export const getRule = (id: string) => api.get(`/rules/${id}`).then((r) => r.data);
export const createRule = (data: any) => api.post('/rules', data).then((r) => r.data);
export const updateRule = (id: string, data: any) =>
  api.put(`/rules/${id}`, data).then((r) => r.data);
export const deleteRule = (id: string) => api.delete(`/rules/${id}`).then((r) => r.data);

// Decision Tables
export const getDecisionTables = (ruleSetId: string) =>
  api.get('/decision-tables', { params: { ruleSetId } }).then((r) => r.data);
export const getDecisionTable = (id: string) =>
  api.get(`/decision-tables/${id}`).then((r) => r.data);
export const createDecisionTable = (data: any) =>
  api.post('/decision-tables', data).then((r) => r.data);
export const updateDecisionTable = (id: string, data: any) =>
  api.put(`/decision-tables/${id}`, data).then((r) => r.data);
export const deleteDecisionTable = (id: string) =>
  api.delete(`/decision-tables/${id}`).then((r) => r.data);

// Data Models
export const getDataModels = (projectId?: string) =>
  api.get('/data-models', { params: { projectId } }).then((r) => r.data);
export const getDataModel = (id: string) => api.get(`/data-models/${id}`).then((r) => r.data);
export const createDataModel = (data: any) =>
  api.post('/data-models', data).then((r) => r.data);
export const updateDataModel = (id: string, data: any) =>
  api.put(`/data-models/${id}`, data).then((r) => r.data);
export const deleteDataModel = (id: string) =>
  api.delete(`/data-models/${id}`).then((r) => r.data);

// Execution
export const executeRuleSet = (ruleSetId: string, input: any) =>
  api.post(`/execute/${ruleSetId}`, input).then((r) => r.data);
export const testRuleSet = (ruleSetId: string, input: any) =>
  api.post(`/execute/${ruleSetId}/test`, input).then((r) => r.data);

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats').then((r) => r.data);
export const getExecutionLogs = (ruleSetId: string) =>
  api.get(`/dashboard/executions/${ruleSetId}`).then((r) => r.data);
export const getAllExecutionLogs = (params?: any) =>
  api.get('/dashboard/executions', { params }).then((r) => r.data);
export const getAnalytics = (params?: { days?: number }) =>
  api.get('/dashboard/analytics', { params }).then((r) => r.data);

// Versions
export const publishRuleSet = (ruleSetId: string, data?: { changelog?: string }) =>
  api.post(`/versions/${ruleSetId}/publish`, data || {}).then((r) => r.data);
export const getVersions = (ruleSetId: string) =>
  api.get(`/versions/${ruleSetId}`).then((r) => r.data);
export const rollbackVersion = (ruleSetId: string, version: number) =>
  api.post(`/versions/${ruleSetId}/rollback/${version}`).then((r) => r.data);

// Queue
export const enqueueExecution = (data: { ruleSetId: string; input: any; callbackUrl?: string }) =>
  api.post('/queue/execute', data).then((r) => r.data);
export const getQueueJobs = () => api.get('/queue/jobs').then((r) => r.data);
export const getQueueJob = (id: string) => api.get(`/queue/jobs/${id}`).then((r) => r.data);

// Auth
export const login = (data: { email: string; password: string }) =>
  api.post('/auth/login', data).then((r) => r.data);
export const register = (data: { email: string; password: string; name: string; tenantName: string }) =>
  api.post('/auth/register', data).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data);
export const getUsers = () => api.get('/auth/users').then((r) => r.data);
export const updateUserRole = (userId: string, role: string) =>
  api.put(`/auth/users/${userId}/role`, { role }).then((r) => r.data);
export const deactivateUser = (userId: string) =>
  api.put(`/auth/users/${userId}/deactivate`).then((r) => r.data);
export const inviteUser = (data: { email: string; role?: string }) =>
  api.post('/auth/invite', data).then((r) => r.data);
export const getInvitations = () => api.get('/auth/invitations').then((r) => r.data);
export const getSsoConfig = () => api.get('/auth/sso-config').then((r) => r.data);
export const updateSsoConfig = (data: any) =>
  api.put('/auth/sso-config', data).then((r) => r.data);

// Workflows
export const getWorkflows = (projectId?: string) =>
  api.get('/workflows', { params: { projectId } }).then((r) => r.data);
export const getWorkflow = (id: string) => api.get(`/workflows/${id}`).then((r) => r.data);
export const createWorkflow = (data: { projectId: string; name: string; description?: string }) =>
  api.post('/workflows', data).then((r) => r.data);
export const updateWorkflow = (id: string, data: any) =>
  api.put(`/workflows/${id}`, data).then((r) => r.data);
export const deleteWorkflow = (id: string) =>
  api.delete(`/workflows/${id}`).then((r) => r.data);
export const executeWorkflow = (id: string, input: any) =>
  api.post(`/workflows/${id}/execute`, input).then((r) => r.data);
export const getWorkflowInstances = (id: string) =>
  api.get(`/workflows/${id}/instances`).then((r) => r.data);

// Adapters
export const getAdapters = (projectId?: string) =>
  api.get('/adapters', { params: { projectId } }).then((r) => r.data);
export const getAdapter = (id: string) => api.get(`/adapters/${id}`).then((r) => r.data);
export const createAdapter = (data: any) => api.post('/adapters', data).then((r) => r.data);
export const updateAdapter = (id: string, data: any) =>
  api.put(`/adapters/${id}`, data).then((r) => r.data);
export const deleteAdapter = (id: string) =>
  api.delete(`/adapters/${id}`).then((r) => r.data);
export const testAdapter = (id: string) =>
  api.post(`/adapters/${id}/test`).then((r) => r.data);

// Audit
export const getAuditLogs = (params?: any) =>
  api.get('/audit', { params }).then((r) => r.data);

// Tenants
export const getCurrentTenant = () => api.get('/tenants/current').then((r) => r.data);
export const getTenantUsage = () => api.get('/tenants/current/usage').then((r) => r.data);

// ============================================================
// V3: Notifications
// ============================================================
export const getNotifications = (params?: { unread?: boolean }) =>
  api.get('/notifications', { params }).then((r) => r.data);
export const getNotificationCount = () =>
  api.get('/notifications/count').then((r) => r.data);
export const markNotificationRead = (id: string) =>
  api.put(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () =>
  api.put('/notifications/read-all').then((r) => r.data);
export const deleteNotification = (id: string) =>
  api.delete(`/notifications/${id}`).then((r) => r.data);

// V3: Version Diff
export const getVersionDiff = (ruleSetId: string, v1: number, v2: number) =>
  api.get(`/version-diff/rule-sets/${ruleSetId}/diff/${v1}/${v2}`).then((r) => r.data);

// V3: Simulations
export const getSimulations = (ruleSetId?: string) =>
  api.get('/simulations', { params: { ruleSetId } }).then((r) => r.data);
export const getSimulation = (id: string) =>
  api.get(`/simulations/${id}`).then((r) => r.data);
export const createSimulation = (data: any) =>
  api.post('/simulations', data).then((r) => r.data);
export const deleteSimulation = (id: string) =>
  api.delete(`/simulations/${id}`).then((r) => r.data);

// V3: Rule Conflicts
export const getRuleConflicts = (ruleSetId: string) =>
  api.get(`/conflicts/rule-sets/${ruleSetId}/conflicts`).then((r) => r.data);

// V3: Import/Export
export const exportProject = (id: string) =>
  api.get(`/import-export/export/project/${id}`).then((r) => r.data);
export const exportRuleSet = (id: string) =>
  api.get(`/import-export/export/rule-set/${id}`).then((r) => r.data);
export const importProject = (data: any) =>
  api.post('/import-export/import/project', data).then((r) => r.data);
export const importRuleSet = (projectId: string, data: any) =>
  api.post(`/import-export/import/rule-set/${projectId}`, data).then((r) => r.data);

// ============================================================
// V4: Approvals
// ============================================================
export const getApprovalPipelines = () =>
  api.get('/approvals/pipelines').then((r) => r.data);
export const createApprovalPipeline = (data: any) =>
  api.post('/approvals/pipelines', data).then((r) => r.data);
export const updateApprovalPipeline = (id: string, data: any) =>
  api.put(`/approvals/pipelines/${id}`, data).then((r) => r.data);
export const deleteApprovalPipeline = (id: string) =>
  api.delete(`/approvals/pipelines/${id}`).then((r) => r.data);
export const getApprovalRequests = (params?: any) =>
  api.get('/approvals/requests', { params }).then((r) => r.data);
export const createApprovalRequest = (data: any) =>
  api.post('/approvals/requests', data).then((r) => r.data);
export const approveRequest = (id: string, comment?: string) =>
  api.put(`/approvals/requests/${id}/approve`, { comment }).then((r) => r.data);
export const rejectRequest = (id: string, comment?: string) =>
  api.put(`/approvals/requests/${id}/reject`, { comment }).then((r) => r.data);
export const addApprovalComment = (id: string, text: string) =>
  api.post(`/approvals/requests/${id}/comment`, { text }).then((r) => r.data);

// V4: API Keys
export const getApiKeys = () => api.get('/api-keys').then((r) => r.data);
export const createApiKey = (data: any) =>
  api.post('/api-keys', data).then((r) => r.data);
export const updateApiKey = (id: string, data: any) =>
  api.put(`/api-keys/${id}`, data).then((r) => r.data);
export const deleteApiKey = (id: string) =>
  api.delete(`/api-keys/${id}`).then((r) => r.data);

// V4: Scheduled Jobs
export const getScheduledJobs = (params?: any) =>
  api.get('/scheduled-jobs', { params }).then((r) => r.data);
export const getScheduledJob = (id: string) =>
  api.get(`/scheduled-jobs/${id}`).then((r) => r.data);
export const createScheduledJob = (data: any) =>
  api.post('/scheduled-jobs', data).then((r) => r.data);
export const updateScheduledJob = (id: string, data: any) =>
  api.put(`/scheduled-jobs/${id}`, data).then((r) => r.data);
export const deleteScheduledJob = (id: string) =>
  api.delete(`/scheduled-jobs/${id}`).then((r) => r.data);
export const runScheduledJobNow = (id: string) =>
  api.post(`/scheduled-jobs/${id}/run-now`).then((r) => r.data);

// V4: Templates
export const getTemplates = (params?: any) =>
  api.get('/templates', { params }).then((r) => r.data);
export const getTemplate = (id: string) =>
  api.get(`/templates/${id}`).then((r) => r.data);
export const createTemplate = (data: any) =>
  api.post('/templates', data).then((r) => r.data);
export const updateTemplate = (id: string, data: any) =>
  api.put(`/templates/${id}`, data).then((r) => r.data);
export const deleteTemplate = (id: string) =>
  api.delete(`/templates/${id}`).then((r) => r.data);
export const installTemplate = (id: string) =>
  api.post(`/templates/${id}/install`).then((r) => r.data);
export const rateTemplate = (id: string, rating: number) =>
  api.post(`/templates/${id}/rate`, { rating }).then((r) => r.data);

// V4: Compliance
export const getComplianceFrameworks = () =>
  api.get('/compliance').then((r) => r.data);
export const getComplianceFramework = (id: string) =>
  api.get(`/compliance/${id}`).then((r) => r.data);
export const createComplianceFramework = (data: any) =>
  api.post('/compliance', data).then((r) => r.data);
export const updateComplianceFramework = (id: string, data: any) =>
  api.put(`/compliance/${id}`, data).then((r) => r.data);
export const deleteComplianceFramework = (id: string) =>
  api.delete(`/compliance/${id}`).then((r) => r.data);
export const certifyFramework = (id: string) =>
  api.post(`/compliance/${id}/certify`).then((r) => r.data);
export const getComplianceAuditTrail = (id: string) =>
  api.get(`/compliance/${id}/audit-trail`).then((r) => r.data);

// ============================================================
// V7: Environments & Promotion
// ============================================================
export const getEnvironments = () => api.get('/environments').then((r) => r.data);
export const createEnvironment = (data: any) => api.post('/environments', data).then((r) => r.data);
export const updateEnvironment = (id: string, data: any) => api.put(`/environments/${id}`, data).then((r) => r.data);
export const deleteEnvironment = (id: string) => api.delete(`/environments/${id}`).then((r) => r.data);
export const promoteRuleSet = (data: any) => api.post('/environments/promote', data).then((r) => r.data);
export const getPromotions = (params?: any) => api.get('/environments/promotions', { params }).then((r) => r.data);
export const approvePromotion = (id: string) => api.put(`/environments/promotions/${id}/approve`).then((r) => r.data);
export const rejectPromotion = (id: string) => api.put(`/environments/promotions/${id}/reject`).then((r) => r.data);

// V7: Custom Functions
export const getCustomFunctions = () => api.get('/functions').then((r) => r.data);
export const getCustomFunction = (id: string) => api.get(`/functions/${id}`).then((r) => r.data);
export const createCustomFunction = (data: any) => api.post('/functions', data).then((r) => r.data);
export const updateCustomFunction = (id: string, data: any) => api.put(`/functions/${id}`, data).then((r) => r.data);
export const deleteCustomFunction = (id: string) => api.delete(`/functions/${id}`).then((r) => r.data);
export const testCustomFunction = (id: string, args: any[]) => api.post(`/functions/${id}/test`, { args }).then((r) => r.data);

// V7: Decision Trace
export const getDecisionTrace = (executionLogId: string) => api.get(`/decision-trace/executions/${executionLogId}/trace`).then((r) => r.data);
export const executeTraced = (ruleSetId: string, input: any) => api.post(`/decision-trace/execute-traced/${ruleSetId}`, input).then((r) => r.data);

// V7: RBAC Permissions
export const getPermissions = () => api.get('/permissions').then((r) => r.data);
export const getRolePermissions = (role: string) => api.get(`/permissions/role/${role}`).then((r) => r.data);
export const setPermission = (data: any) => api.post('/permissions', data).then((r) => r.data);
export const deletePermission = (id: string) => api.delete(`/permissions/${id}`).then((r) => r.data);
export const checkPermission = (resource: string, action: string) => api.get('/permissions/check', { params: { resource, action } }).then((r) => r.data);
export const seedDefaultPermissions = () => api.post('/permissions/seed-defaults').then((r) => r.data);

// V7: Compliance Reports
export const getReports = () => api.get('/reports').then((r) => r.data);
export const generateReport = (data: any) => api.post('/reports/generate', data).then((r) => r.data);
export const getReport = (id: string) => api.get(`/reports/${id}`).then((r) => r.data);
export const deleteReport = (id: string) => api.delete(`/reports/${id}`).then((r) => r.data);
export const downloadReport = (id: string) => api.get(`/reports/${id}/download`).then((r) => r.data);

// V7: Batch Execution
export const batchExecuteRuleSet = (ruleSetId: string, data: any) => api.post(`/batch/rule-sets/${ruleSetId}`, data).then((r) => r.data);

// ============================================================
// V8: Rule Copilot
// ============================================================
export const generateRuleFromNL = (data: { description: string; context?: string }) => api.post('/copilot/generate-rule', data).then((r) => r.data);
export const generateDecisionTableFromNL = (data: any) => api.post('/copilot/generate-decision-table', data).then((r) => r.data);
export const explainRule = (ruleId: string) => api.post('/copilot/explain-rule', { ruleId }).then((r) => r.data);

// V8: A/B Testing
export const getABTests = (params?: any) => api.get('/ab-tests', { params }).then((r) => r.data);
export const getABTest = (id: string) => api.get(`/ab-tests/${id}`).then((r) => r.data);
export const createABTest = (data: any) => api.post('/ab-tests', data).then((r) => r.data);
export const startABTest = (id: string) => api.put(`/ab-tests/${id}/start`).then((r) => r.data);
export const pauseABTest = (id: string) => api.put(`/ab-tests/${id}/pause`).then((r) => r.data);
export const completeABTest = (id: string) => api.put(`/ab-tests/${id}/complete`).then((r) => r.data);
export const deleteABTest = (id: string) => api.delete(`/ab-tests/${id}`).then((r) => r.data);
export const executeABTest = (id: string, input: any) => api.post(`/ab-tests/${id}/execute`, input).then((r) => r.data);

// V8: Impact Analysis
export const analyzeImpact = (data: any) => api.post('/impact-analysis/analyze', data).then((r) => r.data);
export const getImpactAnalyses = (ruleSetId: string) => api.get(`/impact-analysis/rule-sets/${ruleSetId}`).then((r) => r.data);
export const getImpactAnalysis = (id: string) => api.get(`/impact-analysis/${id}`).then((r) => r.data);

// V8: Rule Debugger
export const debugRuleSet = (ruleSetId: string, data: any) => api.post(`/debugger/rule-sets/${ruleSetId}/debug`, data).then((r) => r.data);
export const evaluateRule = (ruleId: string, input: any) => api.post(`/debugger/rules/${ruleId}/evaluate`, input).then((r) => r.data);

// V8: Execution Replay
export const replayExecution = (data: any) => api.post('/replay/replay', data).then((r) => r.data);
export const getReplays = (params?: any) => api.get('/replay', { params }).then((r) => r.data);
export const getReplay = (id: string) => api.get(`/replay/${id}`).then((r) => r.data);
export const batchReplay = (data: any) => api.post('/replay/batch-replay', data).then((r) => r.data);

// V8: Compliance Packs
export const getCompliancePacks = () => api.get('/compliance-packs/packs').then((r) => r.data);
export const getCompliancePack = (framework: string) => api.get(`/compliance-packs/packs/${framework}`).then((r) => r.data);
export const installCompliancePack = (framework: string) => api.post(`/compliance-packs/packs/${framework}/install`).then((r) => r.data);
export const getInstalledPacks = () => api.get('/compliance-packs/installed').then((r) => r.data);

// Aliases for frontend pages
export const getExecutionReplays = (params?: any) => api.get('/replay/executions', { params }).then((r) => r.data);
export const getImpactHistory = (params?: any) => api.get('/impact-analysis/history', { params }).then((r) => r.data);

// Set auth token on the api instance
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export default api;
