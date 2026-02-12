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

export default api;
