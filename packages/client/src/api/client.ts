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
export const deleteDIConnector = (id: string) => api.delete(`/di/connectors/${id}`).then((r) => r.data);

// DI Pipelines
export const getDIPipelines = () => api.get('/di/pipelines').then((r) => r.data);
export const getDIPipeline = (id: string) => api.get(`/di/pipelines/${id}`).then((r) => r.data);
export const createDIPipeline = (data: any) => api.post('/di/pipelines', data).then((r) => r.data);
export const deleteDIPipeline = (id: string) => api.delete(`/di/pipelines/${id}`).then((r) => r.data);
export const getDIPipelineInstances = (id: string) => api.get(`/di/pipelines/${id}/instances`).then((r) => r.data);

// DI CDC
export const getDICDCStreams = () => api.get('/di/cdc').then((r) => r.data);
export const createDICDCStream = (data: any) => api.post('/di/cdc', data).then((r) => r.data);
export const deleteDICDCStream = (id: string) => api.delete(`/di/cdc/${id}`).then((r) => r.data);

// DI Replication
export const getDIReplicationStreams = () => api.get('/di/replication').then((r) => r.data);
export const createDIReplicationStream = (data: any) => api.post('/di/replication', data).then((r) => r.data);
export const deleteDIReplicationStream = (id: string) => api.delete(`/di/replication/${id}`).then((r) => r.data);

// DI Quality
export const getDIQualityRules = () => api.get('/di/quality/rules').then((r) => r.data);
export const getDIQualityScore = () => api.get('/di/quality/score').then((r) => r.data);
export const createDIQualityRule = (data: any) => api.post('/di/quality/rules', data).then((r) => r.data);

// DI Lineage
export const getDILineage = () => api.get('/di/lineage/nodes').then((r) => r.data);
export const createDILineageNode = (data: any) => api.post('/di/lineage/nodes', data).then((r) => r.data);
export const getDILineageImpact = (nodeId: string, direction?: string) => api.get(`/di/lineage/impact/${nodeId}`, { params: { direction } }).then((r) => r.data);

// DI Catalog
export const getDICatalog = (params?: any) => api.get('/di/catalog', { params }).then((r) => r.data);
export const getDICatalogEntry = (id: string) => api.get(`/di/catalog/${id}`).then((r) => r.data);
export const createDICatalogEntry = (data: any) => api.post('/di/catalog', data).then((r) => r.data);
export const deleteDICatalogEntry = (id: string) => api.delete(`/di/catalog/${id}`).then((r) => r.data);
export const getDIGlossaryTerms = () => api.get('/di/catalog/glossary/terms').then((r) => r.data);

// DI Scheduling
export const getDISchedules = () => api.get('/di/schedules').then((r) => r.data);
export const createDISchedule = (data: any) => api.post('/di/schedules', data).then((r) => r.data);
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
