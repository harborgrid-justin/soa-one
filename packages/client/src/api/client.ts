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

// ============================================================
// V9: Enterprise Service Bus (ESB)
// ============================================================

// ESB Channels
export const getESBChannels = () => api.get('/esb/channels').then((r) => r.data);
export const getESBChannel = (id: string) => api.get(`/esb/channels/${id}`).then((r) => r.data);
export const createESBChannel = (data: any) => api.post('/esb/channels', data).then((r) => r.data);
export const updateESBChannel = (id: string, data: any) => api.put(`/esb/channels/${id}`, data).then((r) => r.data);
export const deleteESBChannel = (id: string) => api.delete(`/esb/channels/${id}`).then((r) => r.data);

// ESB Endpoints
export const getESBEndpoints = () => api.get('/esb/endpoints').then((r) => r.data);
export const getESBEndpoint = (id: string) => api.get(`/esb/endpoints/${id}`).then((r) => r.data);
export const createESBEndpoint = (data: any) => api.post('/esb/endpoints', data).then((r) => r.data);
export const updateESBEndpoint = (id: string, data: any) => api.put(`/esb/endpoints/${id}`, data).then((r) => r.data);
export const deleteESBEndpoint = (id: string) => api.delete(`/esb/endpoints/${id}`).then((r) => r.data);

// ESB Routes
export const getESBRoutes = () => api.get('/esb/routes').then((r) => r.data);
export const getESBRoute = (id: string) => api.get(`/esb/routes/${id}`).then((r) => r.data);
export const createESBRoute = (data: any) => api.post('/esb/routes', data).then((r) => r.data);
export const updateESBRoute = (id: string, data: any) => api.put(`/esb/routes/${id}`, data).then((r) => r.data);
export const deleteESBRoute = (id: string) => api.delete(`/esb/routes/${id}`).then((r) => r.data);

// ESB Transformers
export const getESBTransformers = () => api.get('/esb/transformers').then((r) => r.data);
export const getESBTransformer = (id: string) => api.get(`/esb/transformers/${id}`).then((r) => r.data);
export const createESBTransformer = (data: any) => api.post('/esb/transformers', data).then((r) => r.data);
export const updateESBTransformer = (id: string, data: any) => api.put(`/esb/transformers/${id}`, data).then((r) => r.data);
export const deleteESBTransformer = (id: string) => api.delete(`/esb/transformers/${id}`).then((r) => r.data);

// ESB Sagas
export const getESBSagas = () => api.get('/esb/sagas').then((r) => r.data);
export const getESBSaga = (id: string) => api.get(`/esb/sagas/${id}`).then((r) => r.data);
export const createESBSaga = (data: any) => api.post('/esb/sagas', data).then((r) => r.data);
export const updateESBSaga = (id: string, data: any) => api.put(`/esb/sagas/${id}`, data).then((r) => r.data);
export const deleteESBSaga = (id: string) => api.delete(`/esb/sagas/${id}`).then((r) => r.data);
export const getESBSagaInstances = (id: string) => api.get(`/esb/sagas/${id}/instances`).then((r) => r.data);

// ESB Messages
export const getESBMessages = (params?: any) => api.get('/esb/messages', { params }).then((r) => r.data);
export const sendESBMessage = (data: any) => api.post('/esb/messages', data).then((r) => r.data);

// ESB Metrics
export const getESBMetrics = () => api.get('/esb/metrics').then((r) => r.data);
export const getESBMetricSnapshots = (params?: any) => api.get('/esb/metrics/snapshots', { params }).then((r) => r.data);
export const createESBMetricSnapshot = () => api.post('/esb/metrics/snapshots').then((r) => r.data);

// ============================================================
// V10: Content Management System (CMS)
// ============================================================

// CMS Documents
export const getCMSDocuments = (params?: any) => api.get('/cms/documents', { params }).then((r) => r.data);
export const getCMSDocument = (id: string) => api.get(`/cms/documents/${id}`).then((r) => r.data);
export const createCMSDocument = (data: any) => api.post('/cms/documents', data).then((r) => r.data);
export const updateCMSDocument = (id: string, data: any) => api.put(`/cms/documents/${id}`, data).then((r) => r.data);
export const deleteCMSDocument = (id: string) => api.delete(`/cms/documents/${id}`).then((r) => r.data);
export const getCMSDocumentVersions = (id: string) => api.get(`/cms/documents/${id}/versions`).then((r) => r.data);
export const createCMSDocumentVersion = (id: string, data?: any) => api.post(`/cms/documents/${id}/versions`, data || {}).then((r) => r.data);

// CMS Folders
export const getCMSFolders = () => api.get('/cms/folders').then((r) => r.data);
export const getCMSFolder = (id: string) => api.get(`/cms/folders/${id}`).then((r) => r.data);
export const createCMSFolder = (data: any) => api.post('/cms/folders', data).then((r) => r.data);
export const updateCMSFolder = (id: string, data: any) => api.put(`/cms/folders/${id}`, data).then((r) => r.data);
export const deleteCMSFolder = (id: string) => api.delete(`/cms/folders/${id}`).then((r) => r.data);

// CMS Workflows
export const getCMSWorkflows = () => api.get('/cms/workflows').then((r) => r.data);
export const getCMSWorkflow = (id: string) => api.get(`/cms/workflows/${id}`).then((r) => r.data);
export const createCMSWorkflow = (data: any) => api.post('/cms/workflows', data).then((r) => r.data);
export const updateCMSWorkflow = (id: string, data: any) => api.put(`/cms/workflows/${id}`, data).then((r) => r.data);
export const deleteCMSWorkflow = (id: string) => api.delete(`/cms/workflows/${id}`).then((r) => r.data);
export const getCMSWorkflowInstances = (id: string) => api.get(`/cms/workflows/${id}/instances`).then((r) => r.data);

// CMS Taxonomies
export const getCMSTaxonomies = () => api.get('/cms/taxonomies').then((r) => r.data);
export const getCMSTaxonomy = (id: string) => api.get(`/cms/taxonomies/${id}`).then((r) => r.data);
export const createCMSTaxonomy = (data: any) => api.post('/cms/taxonomies', data).then((r) => r.data);
export const updateCMSTaxonomy = (id: string, data: any) => api.put(`/cms/taxonomies/${id}`, data).then((r) => r.data);
export const deleteCMSTaxonomy = (id: string) => api.delete(`/cms/taxonomies/${id}`).then((r) => r.data);

// CMS Retention
export const getCMSRetentionPolicies = () => api.get('/cms/retention').then((r) => r.data);
export const createCMSRetentionPolicy = (data: any) => api.post('/cms/retention', data).then((r) => r.data);
export const updateCMSRetentionPolicy = (id: string, data: any) => api.put(`/cms/retention/${id}`, data).then((r) => r.data);
export const deleteCMSRetentionPolicy = (id: string) => api.delete(`/cms/retention/${id}`).then((r) => r.data);

// CMS Legal Holds
export const getCMSLegalHolds = () => api.get('/cms/legal-holds').then((r) => r.data);
export const createCMSLegalHold = (data: any) => api.post('/cms/legal-holds', data).then((r) => r.data);
export const updateCMSLegalHold = (id: string, data: any) => api.put(`/cms/legal-holds/${id}`, data).then((r) => r.data);

// CMS Comments
export const getCMSComments = (documentId: string) => api.get(`/cms/documents/${documentId}/comments`).then((r) => r.data);
export const createCMSComment = (documentId: string, data: any) => api.post(`/cms/documents/${documentId}/comments`, data).then((r) => r.data);
export const updateCMSComment = (id: string, data: any) => api.put(`/cms/comments/${id}`, data).then((r) => r.data);
export const deleteCMSComment = (id: string) => api.delete(`/cms/comments/${id}`).then((r) => r.data);

// CMS Metadata Schemas
export const getCMSMetadataSchemas = () => api.get('/cms/metadata-schemas').then((r) => r.data);
export const createCMSMetadataSchema = (data: any) => api.post('/cms/metadata-schemas', data).then((r) => r.data);
export const updateCMSMetadataSchema = (id: string, data: any) => api.put(`/cms/metadata-schemas/${id}`, data).then((r) => r.data);
export const deleteCMSMetadataSchema = (id: string) => api.delete(`/cms/metadata-schemas/${id}`).then((r) => r.data);

// CMS Renditions
export const getCMSRenditions = (documentId: string) => api.get(`/cms/documents/${documentId}/renditions`).then((r) => r.data);
export const createCMSRendition = (documentId: string, data: any) => api.post(`/cms/documents/${documentId}/renditions`, data).then((r) => r.data);

// CMS Audit
export const getCMSAudit = (params?: any) => api.get('/cms/audit', { params }).then((r) => r.data);

// CMS Search
export const searchCMSDocuments = (params: any) => api.get('/cms/search', { params }).then((r) => r.data);

// CMS Metrics
export const getCMSMetrics = () => api.get('/cms/metrics').then((r) => r.data);

// ============================================================
// V12: Data Integration (DI)
// ============================================================

// DI Connectors
export const getDIConnectors = () => api.get('/di/connectors').then((r) => r.data);
export const createDIConnector = (data: any) => api.post('/di/connectors', data).then((r) => r.data);
export const updateDIConnector = (id: string, data: any) => api.put(`/di/connectors/${id}`, data).then((r) => r.data);
export const deleteDIConnector = (id: string) => api.delete(`/di/connectors/${id}`).then((r) => r.data);

// DI Pipelines
export const getDIPipelines = () => api.get('/di/pipelines').then((r) => r.data);
export const getDIPipeline = (id: string) => api.get(`/di/pipelines/${id}`).then((r) => r.data);
export const createDIPipeline = (data: any) => api.post('/di/pipelines', data).then((r) => r.data);
export const updateDIPipeline = (id: string, data: any) => api.put(`/di/pipelines/${id}`, data).then((r) => r.data);
export const deleteDIPipeline = (id: string) => api.delete(`/di/pipelines/${id}`).then((r) => r.data);
export const getDIPipelineInstances = (id: string) => api.get(`/di/pipelines/${id}/instances`).then((r) => r.data);

// DI CDC
export const getDICDCStreams = () => api.get('/di/cdc').then((r) => r.data);
export const createDICDCStream = (data: any) => api.post('/di/cdc', data).then((r) => r.data);
export const updateDICDCStream = (id: string, data: any) => api.put(`/di/cdc/${id}`, data).then((r) => r.data);
export const deleteDICDCStream = (id: string) => api.delete(`/di/cdc/${id}`).then((r) => r.data);

// DI Replication
export const getDIReplicationStreams = () => api.get('/di/replication').then((r) => r.data);
export const createDIReplicationStream = (data: any) => api.post('/di/replication', data).then((r) => r.data);
export const updateDIReplicationStream = (id: string, data: any) => api.put(`/di/replication/${id}`, data).then((r) => r.data);
export const deleteDIReplicationStream = (id: string) => api.delete(`/di/replication/${id}`).then((r) => r.data);

// DI Quality
export const getDIQualityRules = () => api.get('/di/quality/rules').then((r) => r.data);
export const getDIQualityScore = () => api.get('/di/quality/score').then((r) => r.data);
export const createDIQualityRule = (data: any) => api.post('/di/quality/rules', data).then((r) => r.data);
export const updateDIQualityRule = (id: string, data: any) => api.put(`/di/quality/rules/${id}`, data).then((r) => r.data);
export const deleteDIQualityRule = (id: string) => api.delete(`/di/quality/rules/${id}`).then((r) => r.data);

// DI Lineage
export const getDILineage = () => api.get('/di/lineage/nodes').then((r) => r.data);
export const createDILineageNode = (data: any) => api.post('/di/lineage/nodes', data).then((r) => r.data);
export const updateDILineageNode = (id: string, data: any) => api.put(`/di/lineage/nodes/${id}`, data).then((r) => r.data);
export const deleteDILineageNode = (id: string) => api.delete(`/di/lineage/nodes/${id}`).then((r) => r.data);
export const getDILineageImpact = (nodeId: string, direction?: string) => api.get(`/di/lineage/impact/${nodeId}`, { params: { direction } }).then((r) => r.data);

// DI Catalog
export const getDICatalog = (params?: any) => api.get('/di/catalog', { params }).then((r) => r.data);
export const getDICatalogEntry = (id: string) => api.get(`/di/catalog/${id}`).then((r) => r.data);
export const createDICatalogEntry = (data: any) => api.post('/di/catalog', data).then((r) => r.data);
export const updateDICatalogEntry = (id: string, data: any) => api.put(`/di/catalog/${id}`, data).then((r) => r.data);
export const deleteDICatalogEntry = (id: string) => api.delete(`/di/catalog/${id}`).then((r) => r.data);
export const getDIGlossaryTerms = () => api.get('/di/catalog/glossary/terms').then((r) => r.data);

// DI Scheduling
export const getDISchedules = () => api.get('/di/schedules').then((r) => r.data);
export const createDISchedule = (data: any) => api.post('/di/schedules', data).then((r) => r.data);
export const updateDISchedule = (id: string, data: any) => api.put(`/di/schedules/${id}`, data).then((r) => r.data);
export const deleteDISchedule = (id: string) => api.delete(`/di/schedules/${id}`).then((r) => r.data);
export const getDIScheduleJobs = (id: string) => api.get(`/di/schedules/${id}/jobs`).then((r) => r.data);

// DI Monitoring
export const getDIAlerts = () => api.get('/di/monitoring/alerts').then((r) => r.data);
export const getDIPipelineHealth = () => api.get('/di/monitoring/health').then((r) => r.data);

// DI Security
export const getDIAudit = (params?: any) => api.get('/di/security/audit', { params }).then((r) => r.data);
export const getDIAccessPolicies = () => api.get('/di/security/policies').then((r) => r.data);
export const getDIMaskingRules = () => api.get('/di/security/masking-rules').then((r) => r.data);

// DI Metrics (Dashboard)
export const getDIMetrics = () => api.get('/di/metrics').then((r) => r.data);

// ============================================================
// V13: Data Quality & Messaging (DQM)
// ============================================================

// DQM Topics
export const getDQMTopics = () => api.get('/dqm/topics').then((r) => r.data);
export const createDQMTopic = (data: any) => api.post('/dqm/topics', data).then((r) => r.data);
export const updateDQMTopic = (name: string, data: any) => api.put(`/dqm/topics/${name}`, data).then((r) => r.data);
export const deleteDQMTopic = (name: string) => api.delete(`/dqm/topics/${name}`).then((r) => r.data);

// DQM Queues
export const getDQMQueues = () => api.get('/dqm/queues').then((r) => r.data);
export const createDQMQueue = (data: any) => api.post('/dqm/queues', data).then((r) => r.data);
export const updateDQMQueue = (name: string, data: any) => api.put(`/dqm/queues/${name}`, data).then((r) => r.data);
export const deleteDQMQueue = (name: string) => api.delete(`/dqm/queues/${name}`).then((r) => r.data);

// DQM Quality Rules
export const getDQMQualityRules = () => api.get('/dqm/quality/rules').then((r) => r.data);
export const getDQMQualityRule = (id: string) => api.get(`/dqm/quality/rules/${id}`).then((r) => r.data);
export const createDQMQualityRule = (data: any) => api.post('/dqm/quality/rules', data).then((r) => r.data);
export const updateDQMQualityRule = (id: string, data: any) => api.put(`/dqm/quality/rules/${id}`, data).then((r) => r.data);
export const deleteDQMQualityRule = (id: string) => api.delete(`/dqm/quality/rules/${id}`).then((r) => r.data);

// DQM Scoring
export const getDQMCurrentScore = () => api.get('/dqm/scoring/current').then((r) => r.data);
export const getDQMScoreHistory = () => api.get('/dqm/scoring/history').then((r) => r.data);
export const getDQMScoreTrend = () => api.get('/dqm/scoring/trend').then((r) => r.data);
export const getDQMScoreWeights = () => api.get('/dqm/scoring/weights').then((r) => r.data);

// DQM Cleansing
export const getDQMCleansingRules = () => api.get('/dqm/cleansing/rules').then((r) => r.data);
export const getDQMCleansingRule = (id: string) => api.get(`/dqm/cleansing/rules/${id}`).then((r) => r.data);
export const createDQMCleansingRule = (data: any) => api.post('/dqm/cleansing/rules', data).then((r) => r.data);
export const updateDQMCleansingRule = (id: string, data: any) => api.put(`/dqm/cleansing/rules/${id}`, data).then((r) => r.data);
export const deleteDQMCleansingRule = (id: string) => api.delete(`/dqm/cleansing/rules/${id}`).then((r) => r.data);

// DQM Matching
export const getDQMMatchingRules = () => api.get('/dqm/matching/rules').then((r) => r.data);
export const getDQMMatchingRule = (id: string) => api.get(`/dqm/matching/rules/${id}`).then((r) => r.data);
export const createDQMMatchingRule = (data: any) => api.post('/dqm/matching/rules', data).then((r) => r.data);
export const updateDQMMatchingRule = (id: string, data: any) => api.put(`/dqm/matching/rules/${id}`, data).then((r) => r.data);
export const deleteDQMMatchingRule = (id: string) => api.delete(`/dqm/matching/rules/${id}`).then((r) => r.data);

// DQM Profiling
export const profileDQMDataset = (data: any) => api.post('/dqm/profiling/dataset', data).then((r) => r.data);
export const profileDQMColumn = (data: any) => api.post('/dqm/profiling/column', data).then((r) => r.data);

// DQM Monitoring
export const getDQMAlerts = () => api.get('/dqm/monitoring/alerts').then((r) => r.data);
export const acknowledgeDQMAlert = (id: string) => api.post(`/dqm/monitoring/alerts/${id}/acknowledge`).then((r) => r.data);
export const resolveDQMAlert = (id: string) => api.post(`/dqm/monitoring/alerts/${id}/resolve`).then((r) => r.data);

export const getDQMAlertRules = () => api.get('/dqm/monitoring/alert-rules').then((r) => r.data);

// DQM Security
export const getDQMAudit = (params?: any) => api.get('/dqm/security/audit', { params }).then((r) => r.data);
export const getDQMAccessPolicies = () => api.get('/dqm/security/policies').then((r) => r.data);
export const getDQMMaskingRules = () => api.get('/dqm/security/masking-rules').then((r) => r.data);

// DQM Metrics (Dashboard)
export const getDQMMetrics = () => api.get('/dqm/metrics').then((r) => r.data);

// ============================================================
// V14: SOA Suite
// ============================================================

// SOA Services (Registry)
export const getSOAServices = () => api.get('/soa/services').then((r) => r.data);
export const getSOAService = (id: string) => api.get(`/soa/services/${id}`).then((r) => r.data);
export const createSOAService = (data: any) => api.post('/soa/services', data).then((r) => r.data);
export const updateSOAService = (id: string, data: any) => api.put(`/soa/services/${id}`, data).then((r) => r.data);
export const deleteSOAService = (id: string) => api.delete(`/soa/services/${id}`).then((r) => r.data);

// SOA BPEL Processes
export const getSOAProcesses = () => api.get('/soa/processes').then((r) => r.data);
export const getSOAProcess = (id: string) => api.get(`/soa/processes/${id}`).then((r) => r.data);
export const createSOAProcess = (data: any) => api.post('/soa/processes', data).then((r) => r.data);
export const updateSOAProcess = (id: string, data: any) => api.put(`/soa/processes/${id}`, data).then((r) => r.data);
export const deleteSOAProcess = (id: string) => api.delete(`/soa/processes/${id}`).then((r) => r.data);
export const getSOAProcessInstances = (id: string) => api.get(`/soa/processes/${id}/instances`).then((r) => r.data);
export const startSOAProcess = (id: string, data?: any) => api.post(`/soa/processes/${id}/start`, data || {}).then((r) => r.data);

// SOA Human Tasks
export const getSOATasks = () => api.get('/soa/tasks').then((r) => r.data);
export const getSOATask = (id: string) => api.get(`/soa/tasks/${id}`).then((r) => r.data);
export const createSOATask = (data: any) => api.post('/soa/tasks', data).then((r) => r.data);
export const updateSOATask = (id: string, data: any) => api.put(`/soa/tasks/${id}`, data).then((r) => r.data);
export const deleteSOATask = (id: string) => api.delete(`/soa/tasks/${id}`).then((r) => r.data);
export const claimSOATask = (id: string, assignee: string) => api.post(`/soa/tasks/${id}/claim`, { assignee }).then((r) => r.data);
export const completeSOATask = (id: string, output?: any) => api.post(`/soa/tasks/${id}/complete`, { output }).then((r) => r.data);
export const getSOATaskDefinitions = () => api.get('/soa/task-definitions').then((r) => r.data);

// SOA CEP
export const getSOACEPRules = () => api.get('/soa/cep/rules').then((r) => r.data);
export const getSOACEPRule = (id: string) => api.get(`/soa/cep/rules/${id}`).then((r) => r.data);
export const createSOACEPRule = (data: any) => api.post('/soa/cep/rules', data).then((r) => r.data);
export const updateSOACEPRule = (id: string, data: any) => api.put(`/soa/cep/rules/${id}`, data).then((r) => r.data);
export const deleteSOACEPRule = (id: string) => api.delete(`/soa/cep/rules/${id}`).then((r) => r.data);
export const processSOACEPEvent = (event: any) => api.post('/soa/cep/events', event).then((r) => r.data);

// SOA B2B Gateway
export const getSOAPartners = () => api.get('/soa/b2b/partners').then((r) => r.data);
export const getSOAPartner = (id: string) => api.get(`/soa/b2b/partners/${id}`).then((r) => r.data);
export const createSOAPartner = (data: any) => api.post('/soa/b2b/partners', data).then((r) => r.data);
export const updateSOAPartner = (id: string, data: any) => api.put(`/soa/b2b/partners/${id}`, data).then((r) => r.data);
export const deleteSOAPartner = (id: string) => api.delete(`/soa/b2b/partners/${id}`).then((r) => r.data);
export const getSOAAgreements = () => api.get('/soa/b2b/agreements').then((r) => r.data);
export const createSOAAgreement = (data: any) => api.post('/soa/b2b/agreements', data).then((r) => r.data);
export const updateSOAAgreement = (id: string, data: any) => api.put(`/soa/b2b/agreements/${id}`, data).then((r) => r.data);
export const deleteSOAAgreement = (id: string) => api.delete(`/soa/b2b/agreements/${id}`).then((r) => r.data);
export const getSOAExchanges = () => api.get('/soa/b2b/exchanges').then((r) => r.data);

// SOA API Gateway
export const getSOAAPIs = () => api.get('/soa/apis').then((r) => r.data);
export const getSOAAPI = (id: string) => api.get(`/soa/apis/${id}`).then((r) => r.data);
export const createSOAAPI = (data: any) => api.post('/soa/apis', data).then((r) => r.data);
export const updateSOAAPI = (id: string, data: any) => api.put(`/soa/apis/${id}`, data).then((r) => r.data);
export const deleteSOAAPI = (id: string) => api.delete(`/soa/apis/${id}`).then((r) => r.data);
export const publishSOAAPI = (id: string) => api.post(`/soa/apis/${id}/publish`).then((r) => r.data);
export const deprecateSOAAPI = (id: string) => api.post(`/soa/apis/${id}/deprecate`).then((r) => r.data);

// SOA Policies & SLAs
export const getSOAPolicies = () => api.get('/soa/policies').then((r) => r.data);
export const getSOAPolicy = (id: string) => api.get(`/soa/policies/${id}`).then((r) => r.data);
export const createSOAPolicy = (data: any) => api.post('/soa/policies', data).then((r) => r.data);
export const updateSOAPolicy = (id: string, data: any) => api.put(`/soa/policies/${id}`, data).then((r) => r.data);
export const deleteSOAPolicy = (id: string) => api.delete(`/soa/policies/${id}`).then((r) => r.data);
export const getSOASLAs = () => api.get('/soa/slas').then((r) => r.data);
export const createSOASLA = (data: any) => api.post('/soa/slas', data).then((r) => r.data);
export const updateSOASLA = (id: string, data: any) => api.put(`/soa/slas/${id}`, data).then((r) => r.data);
export const deleteSOASLA = (id: string) => api.delete(`/soa/slas/${id}`).then((r) => r.data);

// SOA Service Mesh
export const getSOAProxies = () => api.get('/soa/mesh/proxies').then((r) => r.data);
export const getSOAProxy = (id: string) => api.get(`/soa/mesh/proxies/${id}`).then((r) => r.data);
export const createSOAProxy = (data: any) => api.post('/soa/mesh/proxies', data).then((r) => r.data);
export const updateSOAProxy = (id: string, data: any) => api.put(`/soa/mesh/proxies/${id}`, data).then((r) => r.data);
export const deleteSOAProxy = (id: string) => api.delete(`/soa/mesh/proxies/${id}`).then((r) => r.data);

// SOA BAM
export const getSOAKPIs = () => api.get('/soa/bam/kpis').then((r) => r.data);
export const createSOAKPI = (data: any) => api.post('/soa/bam/kpis', data).then((r) => r.data);
export const updateSOAKPI = (id: string, data: any) => api.put(`/soa/bam/kpis/${id}`, data).then((r) => r.data);
export const deleteSOAKPI = (id: string) => api.delete(`/soa/bam/kpis/${id}`).then((r) => r.data);
export const recordSOAKPI = (id: string, value: number) => api.post(`/soa/bam/kpis/${id}/record`, { value }).then((r) => r.data);
export const getSOABAMAlerts = () => api.get('/soa/bam/alerts').then((r) => r.data);
export const getSOABAMDashboards = () => api.get('/soa/bam/dashboards').then((r) => r.data);

// SOA Monitoring
export const getSOAMonitoringAlerts = () => api.get('/soa/monitoring/alerts').then((r) => r.data);
export const acknowledgeSOAAlert = (id: string) => api.post(`/soa/monitoring/alerts/${id}/acknowledge`).then((r) => r.data);
export const resolveSOAAlert = (id: string) => api.post(`/soa/monitoring/alerts/${id}/resolve`).then((r) => r.data);
export const getSOACounters = () => api.get('/soa/monitoring/counters').then((r) => r.data);

// SOA Security
export const getSOAAudit = (params?: any) => api.get('/soa/security/audit', { params }).then((r) => r.data);
export const getSOAAccessPolicies = () => api.get('/soa/security/policies').then((r) => r.data);
export const getSOAMaskingRules = () => api.get('/soa/security/masking-rules').then((r) => r.data);

// SOA Metrics (Dashboard)
export const getSOAMetrics = () => api.get('/soa/metrics').then((r) => r.data);

// ============================================================
// V15: Identity & Access Management (IAM)
// ============================================================

// IAM Identities
export const getIAMIdentities = () => api.get('/iam/identities').then((r) => r.data);
export const getIAMIdentity = (id: string) => api.get(`/iam/identities/${id}`).then((r) => r.data);
export const createIAMIdentity = (data: any) => api.post('/iam/identities', data).then((r) => r.data);
export const updateIAMIdentity = (id: string, data: any) => api.put(`/iam/identities/${id}`, data).then((r) => r.data);
export const deleteIAMIdentity = (id: string) => api.delete(`/iam/identities/${id}`).then((r) => r.data);
export const activateIAMIdentity = (id: string) => api.post(`/iam/identities/${id}/activate`).then((r) => r.data);
export const suspendIAMIdentity = (id: string) => api.post(`/iam/identities/${id}/suspend`).then((r) => r.data);
export const lockIAMIdentity = (id: string) => api.post(`/iam/identities/${id}/lock`).then((r) => r.data);
export const unlockIAMIdentity = (id: string) => api.post(`/iam/identities/${id}/unlock`).then((r) => r.data);

// IAM Roles
export const getIAMRoles = () => api.get('/iam/roles').then((r) => r.data);
export const getIAMRole = (id: string) => api.get(`/iam/roles/${id}`).then((r) => r.data);
export const createIAMRole = (data: any) => api.post('/iam/roles', data).then((r) => r.data);
export const updateIAMRole = (id: string, data: any) => api.put(`/iam/roles/${id}`, data).then((r) => r.data);
export const deleteIAMRole = (id: string) => api.delete(`/iam/roles/${id}`).then((r) => r.data);

// IAM Authorization
export const checkIAMAuthorization = (data: { subjectId: string; resource: string; action: string }) =>
  api.post('/iam/authorize', data).then((r) => r.data);

// IAM Sessions
export const getIAMSessions = () => api.get('/iam/sessions').then((r) => r.data);
export const getIAMSession = (id: string) => api.get(`/iam/sessions/${id}`).then((r) => r.data);
export const revokeIAMSession = (id: string) => api.post(`/iam/sessions/${id}/revoke`).then((r) => r.data);
export const revokeIAMIdentitySessions = (identityId: string) =>
  api.delete(`/iam/sessions/identity/${identityId}`).then((r) => r.data);

// IAM Tokens
export const issueIAMToken = (data: any) => api.post('/iam/tokens/issue', data).then((r) => r.data);
export const validateIAMToken = (id: string) => api.get(`/iam/tokens/${id}/validate`).then((r) => r.data);
export const revokeIAMToken = (id: string) => api.post(`/iam/tokens/${id}/revoke`).then((r) => r.data);

// IAM Federation
export const getIAMProviders = () => api.get('/iam/federation/idps').then((r) => r.data);
export const getIAMProvider = (id: string) => api.get(`/iam/federation/idps/${id}`).then((r) => r.data);
export const createIAMProvider = (data: any) => api.post('/iam/federation/idps', data).then((r) => r.data);
export const updateIAMProvider = (id: string, data: any) => api.put(`/iam/federation/idps/${id}`, data).then((r) => r.data);
export const deleteIAMProvider = (id: string) => api.delete(`/iam/federation/idps/${id}`).then((r) => r.data);

// IAM Governance
export const getIAMCampaigns = () => api.get('/iam/governance/campaigns').then((r) => r.data);
export const createIAMCampaign = (data: any) => api.post('/iam/governance/campaigns', data).then((r) => r.data);
export const updateIAMCampaign = (id: string, data: any) => api.put(`/iam/governance/campaigns/${id}`, data).then((r) => r.data);
export const deleteIAMCampaign = (id: string) => api.delete(`/iam/governance/campaigns/${id}`).then((r) => r.data);
export const getIAMSoDPolicies = () => api.get('/iam/governance/sod-policies').then((r) => r.data);
export const createIAMSoDPolicy = (data: any) => api.post('/iam/governance/sod-policies', data).then((r) => r.data);
export const updateIAMSoDPolicy = (id: string, data: any) => api.put(`/iam/governance/sod-policies/${id}`, data).then((r) => r.data);
export const deleteIAMSoDPolicy = (id: string) => api.delete(`/iam/governance/sod-policies/${id}`).then((r) => r.data);
export const getIAMAccessRequests = () => api.get('/iam/governance/access-requests').then((r) => r.data);
export const createIAMAccessRequest = (data: any) => api.post('/iam/governance/access-requests', data).then((r) => r.data);
export const updateIAMAccessRequest = (id: string, data: any) => api.put(`/iam/governance/access-requests/${id}`, data).then((r) => r.data);
export const deleteIAMAccessRequest = (id: string) => api.delete(`/iam/governance/access-requests/${id}`).then((r) => r.data);

// IAM PAM (Privileged Access Management)
export const getIAMPAMAccounts = () => api.get('/iam/pam/accounts').then((r) => r.data);
export const createIAMPAMAccount = (data: any) => api.post('/iam/pam/accounts', data).then((r) => r.data);
export const updateIAMPAMAccount = (id: string, data: any) => api.put(`/iam/pam/accounts/${id}`, data).then((r) => r.data);
export const deleteIAMPAMAccount = (id: string) => api.delete(`/iam/pam/accounts/${id}`).then((r) => r.data);
export const checkoutIAMPAMAccount = (id: string, data?: any) => api.post(`/iam/pam/accounts/${id}/checkout`, data || {}).then((r) => r.data);
export const checkinIAMPAMCheckout = (id: string) => api.post(`/iam/pam/checkouts/${id}/checkin`).then((r) => r.data);

// IAM Risk
export const assessIAMRisk = (data: { identityId: string; context?: any }) => api.post('/iam/risk/assess', data).then((r) => r.data);
export const getIAMRiskAssessment = (identityId: string) => api.get(`/iam/risk/assessments/${identityId}`).then((r) => r.data);
export const getIAMAnomalies = () => api.get('/iam/risk/anomalies').then((r) => r.data);

// IAM Metrics (Dashboard)
export const getIAMMetrics = () => api.get('/iam/metrics').then((r) => r.data);

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
