/**
 * SOA One — OpenAPI 3.0 Specification
 *
 * Machine-readable API documentation for enterprise integration,
 * partner onboarding, and compliance audits.
 *
 * Covers all 96 endpoints across 36 route modules.
 */

const id = { $ref: '#/components/parameters/IdParam' };
const ruleSetIdParam = { name: 'ruleSetId', in: 'path' as const, required: true, schema: { type: 'string' as const, format: 'uuid' } };
const json = (schema: any) => ({ required: true as const, content: { 'application/json': { schema } } });
const ok = (desc: string) => ({ 200: { description: desc } });
const created = (desc: string) => ({ 201: { description: desc } });
const crud = (tag: string, singular: string) => ({
  get: { tags: [tag], summary: `List ${singular}s`, parameters: [{ name: 'projectId', in: 'query' as const, schema: { type: 'string' as const } }], responses: ok(`Array of ${singular}s`) },
  post: { tags: [tag], summary: `Create a new ${singular}`, requestBody: json({ type: 'object' }), responses: created(`${singular} created`) },
});
const crudId = (tag: string, singular: string) => ({
  get: { tags: [tag], summary: `Get ${singular} details`, parameters: [id], responses: { 200: { description: `${singular} details` }, 404: { $ref: '#/components/responses/NotFound' } } },
  put: { tags: [tag], summary: `Update a ${singular}`, parameters: [id], requestBody: json({ type: 'object' }), responses: ok(`${singular} updated`) },
  delete: { tags: [tag], summary: `Delete a ${singular}`, parameters: [id], responses: ok(`${singular} deleted`) },
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SOA One — Enterprise Business Rules Platform API',
    description:
      'Comprehensive REST API for the SOA One business rules engine platform. Enables visual rule design, ' +
      'testing, execution, monitoring, compliance, and multi-tenant management of enterprise decision logic. ' +
      '96 endpoints across 36 modules.',
    version: '8.0.0',
    contact: { name: 'SOA One Engineering', email: 'engineering@soaone.com' },
    license: { name: 'Proprietary' },
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT token obtained via POST /auth/login' },
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API key for programmatic access' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              requestId: { type: 'string', format: 'uuid' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' }, code: { type: 'string' } } } },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          service: { type: 'string', example: 'soa-one' },
          version: { type: 'string', example: '8.0.0' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ReadinessResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ready', 'not_ready'] },
          service: { type: 'string' },
          version: { type: 'string' },
          checks: { type: 'object', properties: { database: { type: 'object', properties: { status: { type: 'string', enum: ['up', 'down'] } } } } },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 1 } } },
      LoginResponse: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/UserSummary' }, tenant: { $ref: '#/components/schemas/TenantSummary' } } },
      RegisterRequest: { type: 'object', required: ['email', 'password', 'name', 'tenantName'], properties: { email: { type: 'string', format: 'email', maxLength: 255 }, password: { type: 'string', minLength: 8, maxLength: 128 }, name: { type: 'string', minLength: 1, maxLength: 255 }, tenantName: { type: 'string', minLength: 1, maxLength: 255 } } },
      UserSummary: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' }, name: { type: 'string' }, role: { type: 'string', enum: ['admin', 'editor', 'viewer'] }, tenantId: { type: 'string', format: 'uuid' } } },
      TenantSummary: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, slug: { type: 'string' }, plan: { type: 'string', enum: ['starter', 'professional', 'enterprise'] } } },
      Project: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, tenantId: { type: 'string', format: 'uuid', nullable: true }, name: { type: 'string' }, description: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
      CreateProjectRequest: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 255 }, description: { type: 'string', maxLength: 2000, default: '' } } },
      RuleSet: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, projectId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string', enum: ['draft', 'review', 'approved', 'published', 'archived'] }, version: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
      Rule: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, ruleSetId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, description: { type: 'string' }, priority: { type: 'integer' }, enabled: { type: 'boolean' }, conditions: { type: 'object' }, actions: { type: 'array', items: { type: 'object' } } } },
      DecisionTable: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, ruleSetId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, columns: { type: 'array', items: { type: 'object' } }, rows: { type: 'array', items: { type: 'object' } } } },
      DataModel: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, projectId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, schema: { type: 'object' } } },
      Workflow: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, projectId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, status: { type: 'string', enum: ['draft', 'active', 'archived'] }, nodes: { type: 'array', items: { type: 'object' } }, edges: { type: 'array', items: { type: 'object' } } } },
      ExecutionRequest: { type: 'object', description: 'Any JSON object representing the facts/input data for rule evaluation', additionalProperties: true },
      ExecutionResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' }, input: { type: 'object', additionalProperties: true }, output: { type: 'object', additionalProperties: true },
          ruleResults: { type: 'array', items: { type: 'object', properties: { ruleId: { type: 'string' }, ruleName: { type: 'string' }, fired: { type: 'boolean' }, actions: { type: 'array', items: { type: 'object' } } } } },
          tableResults: { type: 'array', items: { type: 'object', properties: { tableId: { type: 'string' }, tableName: { type: 'string' }, matchedRows: { type: 'array', items: { type: 'string' } }, actions: { type: 'array', items: { type: 'object' } } } } },
          rulesFired: { type: 'array', items: { type: 'string' } }, executionTimeMs: { type: 'integer' }, error: { type: 'string', nullable: true },
        },
      },
      Adapter: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, projectId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, type: { type: 'string', enum: ['rest', 'webhook', 'database', 'graphql'] }, status: { type: 'string', enum: ['active', 'inactive'] } } },
      Notification: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, userId: { type: 'string', format: 'uuid' }, type: { type: 'string' }, message: { type: 'string' }, read: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } } },
      Template: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, category: { type: 'string' }, type: { type: 'string', enum: ['project', 'ruleSet', 'workflow'] }, downloads: { type: 'integer' }, averageRating: { type: 'number' } } },
      ScheduledJob: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, entityType: { type: 'string' }, entityId: { type: 'string', format: 'uuid' }, cronExpression: { type: 'string' }, enabled: { type: 'boolean' }, lastRunAt: { type: 'string', format: 'date-time', nullable: true } } },
      Environment: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, slug: { type: 'string' }, color: { type: 'string' }, order: { type: 'integer' }, locked: { type: 'boolean' } } },
      CustomFunction: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, code: { type: 'string' }, version: { type: 'integer' }, isActive: { type: 'boolean' } } },
      ComplianceFramework: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, framework: { type: 'string' }, certified: { type: 'boolean' } } },
      Report: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, type: { type: 'string', enum: ['audit-trail', 'change-summary', 'decision-report', 'compliance-status'] }, status: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },
      ABTest: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, ruleSetId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, status: { type: 'string', enum: ['draft', 'running', 'paused', 'completed'] } } },
      Permission: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, role: { type: 'string' }, resource: { type: 'string' }, actions: { type: 'array', items: { type: 'string' } } } },
      ImpactAnalysis: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, ruleSetId: { type: 'string', format: 'uuid' }, affectedRules: { type: 'integer' }, affectedWorkflows: { type: 'integer' } } },
    },
    parameters: {
      IdParam: { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Resource UUID' },
      RuleSetIdParam: { name: 'ruleSetId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Rule set UUID' },
      LimitParam: { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Max results to return' },
      OffsetParam: { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Number of results to skip' },
    },
    responses: {
      Unauthorized: { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Forbidden: { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        headers: {
          'RateLimit-Limit': { schema: { type: 'integer' }, description: 'Max requests per window' },
          'RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Remaining requests' },
          'RateLimit-Reset': { schema: { type: 'integer' }, description: 'Window reset timestamp' },
        },
      },
    },
  },
  paths: {
    // ── System ────────────────────────────────────────────────
    '/health': {
      get: { tags: ['System'], summary: 'Liveness probe', description: 'Returns 200 if the service is running. Use for Kubernetes liveness checks.', security: [], responses: { 200: { description: 'Service is alive', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } } } },
    },
    '/health/ready': {
      get: { tags: ['System'], summary: 'Readiness probe', description: 'Verifies database connectivity. Use for Kubernetes readiness checks.', security: [], responses: { 200: { description: 'Service is ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessResponse' } } } }, 503: { description: 'Service not ready' } } },
    },

    // ── Authentication (13 endpoints) ──────────────────────────
    '/auth/register': {
      post: { tags: ['Authentication'], summary: 'Register a new tenant and admin user', security: [], requestBody: json({ $ref: '#/components/schemas/RegisterRequest' }), responses: { 201: { description: 'Registration successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } }, 400: { description: 'Validation error' }, 409: { description: 'Email or organization already exists' } } },
    },
    '/auth/login': {
      post: { tags: ['Authentication'], summary: 'Authenticate and receive a JWT token', security: [], requestBody: json({ $ref: '#/components/schemas/LoginRequest' }), responses: { 200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } }, 401: { description: 'Invalid credentials' } } },
    },
    '/auth/me': {
      get: { tags: ['Authentication'], summary: 'Get current user profile', responses: { 200: { description: 'User profile' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      put: { tags: ['Authentication'], summary: 'Update current user profile (name, avatar)', requestBody: json({ type: 'object', properties: { name: { type: 'string' }, avatar: { type: 'string' } } }), responses: ok('Profile updated') },
    },
    '/auth/me/password': {
      put: { tags: ['Authentication'], summary: 'Change password', requestBody: json({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } } }), responses: { 200: { description: 'Password changed' }, 400: { description: 'Current password incorrect' } } },
    },
    '/auth/users': {
      get: { tags: ['Authentication'], summary: 'List users in tenant', responses: ok('Array of users') },
    },
    '/auth/users/{id}/role': {
      put: { tags: ['Authentication'], summary: 'Update user role (admin only)', parameters: [id], requestBody: json({ type: 'object', properties: { role: { type: 'string', enum: ['admin', 'editor', 'viewer'] } } }), responses: ok('Role updated') },
    },
    '/auth/users/{id}/deactivate': {
      put: { tags: ['Authentication'], summary: 'Deactivate user (admin only)', parameters: [id], responses: ok('User deactivated') },
    },
    '/auth/invite': {
      post: { tags: ['Authentication'], summary: 'Invite user to tenant (admin only)', requestBody: json({ type: 'object', required: ['email', 'role'], properties: { email: { type: 'string', format: 'email' }, role: { type: 'string' } } }), responses: created('Invitation sent') },
    },
    '/auth/accept-invite': {
      post: { tags: ['Authentication'], summary: 'Accept tenant invitation', security: [], requestBody: json({ type: 'object', required: ['token', 'password', 'name'], properties: { token: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } } }), responses: ok('Invitation accepted') },
    },
    '/auth/invitations': {
      get: { tags: ['Authentication'], summary: 'List pending invitations (admin only)', responses: ok('Array of invitations') },
    },
    '/auth/sso-config': {
      get: { tags: ['Authentication'], summary: 'Get SSO/LDAP configuration (admin only)', responses: ok('SSO configuration') },
      put: { tags: ['Authentication'], summary: 'Update SSO/LDAP configuration (admin only)', requestBody: json({ type: 'object' }), responses: ok('SSO configuration updated') },
    },

    // ── Projects (5 endpoints) ─────────────────────────────────
    '/projects': {
      get: { tags: ['Projects'], summary: 'List all projects', responses: { 200: { description: 'Array of projects', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } } } } },
      post: { tags: ['Projects'], summary: 'Create a new project', requestBody: json({ $ref: '#/components/schemas/CreateProjectRequest' }), responses: { 201: { description: 'Project created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } }, 400: { description: 'Validation error' } } },
    },
    '/projects/{id}': {
      get: { tags: ['Projects'], summary: 'Get project details with rule sets and data models', parameters: [id], responses: { 200: { description: 'Project details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Projects'], summary: 'Update a project', parameters: [id], requestBody: json({ $ref: '#/components/schemas/CreateProjectRequest' }), responses: ok('Project updated') },
      delete: { tags: ['Projects'], summary: 'Delete a project and all associated resources', parameters: [id], responses: ok('Project deleted') },
    },

    // ── Rule Sets (5 endpoints) ────────────────────────────────
    '/rule-sets': {
      get: { tags: ['Rule Sets'], summary: 'List all rule sets', parameters: [{ name: 'projectId', in: 'query', schema: { type: 'string' } }], responses: ok('Array of rule sets') },
      post: { tags: ['Rule Sets'], summary: 'Create a new rule set', requestBody: json({ type: 'object', required: ['projectId', 'name'], properties: { projectId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, description: { type: 'string' } } }), responses: created('Rule set created') },
    },
    '/rule-sets/{id}': {
      get: { tags: ['Rule Sets'], summary: 'Get rule set with rules, decision tables, and versions', parameters: [id], responses: { 200: { description: 'Rule set details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Rule Sets'], summary: 'Update a rule set', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Rule set updated') },
      delete: { tags: ['Rule Sets'], summary: 'Delete a rule set', parameters: [id], responses: ok('Rule set deleted') },
    },

    // ── Rules (5 endpoints) ────────────────────────────────────
    '/rules': {
      get: { tags: ['Rules'], summary: 'List rules for a rule set', parameters: [{ name: 'ruleSetId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }], responses: ok('Array of rules') },
      post: { tags: ['Rules'], summary: 'Create a new rule', requestBody: json({ type: 'object', required: ['ruleSetId', 'name'], properties: { ruleSetId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, priority: { type: 'integer', default: 0 }, conditions: { type: 'object' }, actions: { type: 'array', items: { type: 'object' } } } }), responses: created('Rule created') },
    },
    '/rules/{id}': {
      get: { tags: ['Rules'], summary: 'Get a single rule', parameters: [id], responses: { 200: { description: 'Rule details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Rules'], summary: 'Update a rule', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Rule updated') },
      delete: { tags: ['Rules'], summary: 'Delete a rule', parameters: [id], responses: ok('Rule deleted') },
    },

    // ── Decision Tables (5 endpoints) ──────────────────────────
    '/decision-tables': {
      get: { tags: ['Decision Tables'], summary: 'List decision tables', parameters: [{ name: 'ruleSetId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }], responses: ok('Array of decision tables') },
      post: { tags: ['Decision Tables'], summary: 'Create a decision table', requestBody: json({ type: 'object', required: ['ruleSetId', 'name'] }), responses: created('Decision table created') },
    },
    '/decision-tables/{id}': {
      get: { tags: ['Decision Tables'], summary: 'Get a decision table', parameters: [id], responses: { 200: { description: 'Decision table details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Decision Tables'], summary: 'Update a decision table (columns, rows)', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Decision table updated') },
      delete: { tags: ['Decision Tables'], summary: 'Delete a decision table', parameters: [id], responses: ok('Decision table deleted') },
    },

    // ── Data Models (5 endpoints) ──────────────────────────────
    '/data-models': {
      get: { tags: ['Data Models'], summary: 'List data models', parameters: [{ name: 'projectId', in: 'query', schema: { type: 'string' } }], responses: ok('Array of data models') },
      post: { tags: ['Data Models'], summary: 'Create a data model', requestBody: json({ type: 'object', required: ['projectId', 'name'] }), responses: created('Data model created') },
    },
    '/data-models/{id}': {
      get: { tags: ['Data Models'], summary: 'Get a data model', parameters: [id], responses: { 200: { description: 'Data model details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Data Models'], summary: 'Update a data model schema', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Data model updated') },
      delete: { tags: ['Data Models'], summary: 'Delete a data model', parameters: [id], responses: ok('Data model deleted') },
    },

    // ── Execution (2 endpoints) ────────────────────────────────
    '/execute/{ruleSetId}': {
      post: { tags: ['Execution'], summary: 'Execute a published rule set synchronously', description: 'Evaluates input data against the specified published rule set and returns the decision output. Execution is logged for audit and compliance purposes.', parameters: [ruleSetIdParam], requestBody: json({ $ref: '#/components/schemas/ExecutionRequest' }), responses: { 200: { description: 'Execution result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionResult' } } } }, 400: { description: 'Rule set not published or invalid input' }, 404: { $ref: '#/components/responses/NotFound' }, 429: { $ref: '#/components/responses/RateLimited' } } },
    },
    '/execute/{ruleSetId}/test': {
      post: { tags: ['Execution'], summary: 'Test-execute a rule set (no logging, draft allowed)', parameters: [ruleSetIdParam], requestBody: json({ $ref: '#/components/schemas/ExecutionRequest' }), responses: { 200: { description: 'Test execution result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionResult' } } } } } },
    },

    // ── Batch Execution (1 endpoint) ───────────────────────────
    '/batch/rule-sets/{ruleSetId}': {
      post: { tags: ['Batch Execution'], summary: 'Batch execute rule set against multiple inputs', parameters: [ruleSetIdParam, { name: 'parallel', in: 'query', schema: { type: 'boolean' } }, { name: 'traceEnabled', in: 'query', schema: { type: 'boolean' } }], requestBody: json({ type: 'object', required: ['inputs'], properties: { inputs: { type: 'array', items: { type: 'object' } } } }), responses: ok('Batch execution results') },
    },

    // ── Queue (Async Execution) (3 endpoints) ──────────────────
    '/queue/execute': {
      post: { tags: ['Queue'], summary: 'Submit async rule execution', requestBody: json({ type: 'object', required: ['ruleSetId', 'input'] }), responses: { 202: { description: 'Job submitted', content: { 'application/json': { schema: { type: 'object', properties: { jobId: { type: 'string' }, status: { type: 'string' } } } } } } } },
    },
    '/queue/jobs': {
      get: { tags: ['Queue'], summary: 'List recent jobs', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: ok('Array of jobs') },
    },
    '/queue/jobs/{id}': {
      get: { tags: ['Queue'], summary: 'Check job status', parameters: [id], responses: { 200: { description: 'Job details' }, 404: { $ref: '#/components/responses/NotFound' } } },
    },

    // ── Workflows (8 endpoints) ────────────────────────────────
    '/workflows': {
      get: { tags: ['Workflows'], summary: 'List workflows', parameters: [{ name: 'projectId', in: 'query', schema: { type: 'string' } }], responses: ok('Array of workflows') },
      post: { tags: ['Workflows'], summary: 'Create a BPMN workflow with default start/end nodes', requestBody: json({ type: 'object', required: ['projectId', 'name'] }), responses: created('Workflow created') },
    },
    '/workflows/{id}': {
      get: { tags: ['Workflows'], summary: 'Get workflow with recent instances', parameters: [id], responses: { 200: { description: 'Workflow details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Workflows'], summary: 'Update workflow (save canvas state)', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Workflow updated') },
      delete: { tags: ['Workflows'], summary: 'Delete a workflow', parameters: [id], responses: ok('Workflow deleted') },
    },
    '/workflows/{id}/execute': {
      post: { tags: ['Workflows'], summary: 'Execute a workflow (create instance and run)', parameters: [id], requestBody: json({ $ref: '#/components/schemas/ExecutionRequest' }), responses: ok('Workflow execution result with instance ID') },
    },
    '/workflows/instances/{instanceId}': {
      get: { tags: ['Workflows'], summary: 'Get workflow instance details', parameters: [{ name: 'instanceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Instance details' }, 404: { $ref: '#/components/responses/NotFound' } } },
    },
    '/workflows/{id}/instances': {
      get: { tags: ['Workflows'], summary: 'List instances for a workflow (last 50)', parameters: [id], responses: ok('Array of workflow instances') },
    },

    // ── Versions (4 endpoints) ─────────────────────────────────
    '/versions/{ruleSetId}/publish': {
      post: { tags: ['Version Management'], summary: 'Publish rule set (create version snapshot)', parameters: [ruleSetIdParam], requestBody: json({ type: 'object', properties: { changelog: { type: 'string' } } }), responses: ok('Version published') },
    },
    '/versions/{ruleSetId}': {
      get: { tags: ['Version Management'], summary: 'List versions for a rule set', parameters: [ruleSetIdParam], responses: ok('Array of versions') },
    },
    '/versions/{ruleSetId}/{version}': {
      get: { tags: ['Version Management'], summary: 'Get specific version snapshot', parameters: [ruleSetIdParam, { name: 'version', in: 'path', required: true, schema: { type: 'integer' } }], responses: ok('Version details') },
    },
    '/versions/{ruleSetId}/rollback/{version}': {
      post: { tags: ['Version Management'], summary: 'Rollback rule set to specific version', parameters: [ruleSetIdParam, { name: 'version', in: 'path', required: true, schema: { type: 'integer' } }], responses: ok('Rollback successful') },
    },

    // ── Version Diff (1 endpoint) ──────────────────────────────
    '/version-diff/rule-sets/{ruleSetId}/diff/{v1}/{v2}': {
      get: { tags: ['Version Management'], summary: 'Compare two rule set versions', parameters: [ruleSetIdParam, { name: 'v1', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'v2', in: 'path', required: true, schema: { type: 'integer' } }], responses: ok('Diff showing added, removed, and modified rules/tables') },
    },

    // ── Conflicts (1 endpoint) ─────────────────────────────────
    '/conflicts/rule-sets/{ruleSetId}/conflicts': {
      get: { tags: ['Conflict Detection'], summary: 'Analyze rules for overlap, shadow, and contradiction issues', parameters: [ruleSetIdParam], responses: ok('Conflict analysis results') },
    },

    // ── Decision Trace (2 endpoints) ───────────────────────────
    '/decision-trace/executions/{executionLogId}/trace': {
      get: { tags: ['Decision Trace'], summary: 'Get decision trace for execution', parameters: [{ name: 'executionLogId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: ok('Decision trace details') },
    },
    '/decision-trace/execute-traced/{ruleSetId}': {
      post: { tags: ['Decision Trace'], summary: 'Execute rule set with full trace', parameters: [ruleSetIdParam], requestBody: json({ $ref: '#/components/schemas/ExecutionRequest' }), responses: ok('Traced execution result') },
    },

    // ── Debugger (4 endpoints) ─────────────────────────────────
    '/debugger/rule-sets/{ruleSetId}/debug': {
      post: { tags: ['Debugger'], summary: 'Debug rule set step by step', parameters: [ruleSetIdParam, { name: 'breakpoints', in: 'query', schema: { type: 'string' }, description: 'Comma-separated rule IDs' }], requestBody: json({ type: 'object', required: ['input'] }), responses: ok('Debug step-by-step results') },
    },
    '/debugger/rules/{ruleId}/evaluate': {
      post: { tags: ['Debugger'], summary: 'Evaluate a single rule against input', parameters: [{ name: 'ruleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: json({ type: 'object', required: ['input'] }), responses: ok('Single rule evaluation result') },
    },
    '/debugger/rule-sets/{ruleSetId}/breakpoints': {
      post: { tags: ['Debugger'], summary: 'Set breakpoints on rules', parameters: [ruleSetIdParam], requestBody: json({ type: 'object', properties: { ruleIds: { type: 'array', items: { type: 'string' } } } }), responses: ok('Breakpoints set') },
      get: { tags: ['Debugger'], summary: 'Get current breakpoints', parameters: [ruleSetIdParam], responses: ok('Current breakpoints') },
    },

    // ── Replay (3 endpoints) ───────────────────────────────────
    '/replay/executions': {
      get: { tags: ['Replay'], summary: 'List execution logs with pagination', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'ruleSetId', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: ok('Paginated execution logs') },
    },
    '/replay/executions/{id}': {
      get: { tags: ['Replay'], summary: 'Get single execution log', parameters: [id], responses: { 200: { description: 'Execution log details' }, 404: { $ref: '#/components/responses/NotFound' } } },
    },
    '/replay/replay': {
      post: { tags: ['Replay'], summary: 'Replay an execution and compare output', requestBody: json({ type: 'object', properties: { executionLogId: { type: 'string', format: 'uuid' }, ruleSetId: { type: 'string', format: 'uuid' }, input: { type: 'object' } } }), responses: ok('Replay result with diff comparison') },
    },

    // ── Impact Analysis (3 endpoints) ──────────────────────────
    '/impact-analysis/analyze': {
      post: { tags: ['Impact Analysis'], summary: 'Analyze impact of proposed changes', requestBody: json({ type: 'object' }), responses: ok('Impact analysis results showing affected rules, workflows, and jobs') },
    },
    '/impact-analysis/rule-sets/{ruleSetId}': {
      get: { tags: ['Impact Analysis'], summary: 'Get past impact analyses for rule set', parameters: [ruleSetIdParam], responses: ok('Array of impact analyses') },
    },
    '/impact-analysis/{id}': {
      get: { tags: ['Impact Analysis'], summary: 'Get a single impact analysis', parameters: [id], responses: { 200: { description: 'Impact analysis details' }, 404: { $ref: '#/components/responses/NotFound' } } },
    },

    // ── Adapters (7 endpoints) ─────────────────────────────────
    '/adapters': {
      get: { tags: ['Adapters'], summary: 'List adapters', parameters: [{ name: 'projectId', in: 'query', schema: { type: 'string' } }], responses: ok('Array of adapters') },
      post: { tags: ['Adapters'], summary: 'Create an adapter', requestBody: json({ type: 'object', required: ['projectId', 'name', 'type'] }), responses: created('Adapter created') },
    },
    '/adapters/{id}': {
      get: { tags: ['Adapters'], summary: 'Get an adapter', parameters: [id], responses: { 200: { description: 'Adapter details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Adapters'], summary: 'Update an adapter', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Adapter updated') },
      delete: { tags: ['Adapters'], summary: 'Delete an adapter', parameters: [id], responses: ok('Adapter deleted') },
    },
    '/adapters/{id}/test': {
      post: { tags: ['Adapters'], summary: 'Test adapter connectivity', parameters: [id], responses: ok('Connectivity test result') },
    },
    '/adapters/{id}/fetch': {
      post: { tags: ['Adapters'], summary: 'Execute adapter fetch (REST only)', parameters: [id], responses: ok('Fetch result from external URL') },
    },

    // ── Tenants (3 endpoints) ──────────────────────────────────
    '/tenants/current': {
      get: { tags: ['Tenants'], summary: 'Get current tenant info', responses: ok('Tenant details') },
      put: { tags: ['Tenants'], summary: 'Update tenant settings (admin only)', requestBody: json({ type: 'object' }), responses: ok('Tenant updated') },
    },
    '/tenants/current/usage': {
      get: { tags: ['Tenants'], summary: 'Get tenant usage statistics', responses: ok('Usage stats (projects, rule sets, rules, users, executions)') },
    },

    // ── Notifications (5 endpoints) ────────────────────────────
    '/notifications': {
      get: { tags: ['Notifications'], summary: 'List notifications for current user', parameters: [{ name: 'unread', in: 'query', schema: { type: 'boolean' } }], responses: ok('Array of notifications') },
    },
    '/notifications/count': {
      get: { tags: ['Notifications'], summary: 'Get unread notification count', responses: ok('Unread count') },
    },
    '/notifications/read-all': {
      put: { tags: ['Notifications'], summary: 'Mark all notifications as read', responses: ok('All marked as read') },
    },
    '/notifications/{id}/read': {
      put: { tags: ['Notifications'], summary: 'Mark a notification as read', parameters: [id], responses: ok('Notification marked as read') },
    },
    '/notifications/{id}': {
      delete: { tags: ['Notifications'], summary: 'Delete a notification', parameters: [id], responses: ok('Notification deleted') },
    },

    // ── Simulations (4 endpoints) ──────────────────────────────
    '/simulations': {
      get: { tags: ['Simulations'], summary: 'List simulation runs', parameters: [{ name: 'ruleSetId', in: 'query', schema: { type: 'string' } }], responses: ok('Array of simulation runs') },
      post: { tags: ['Simulations'], summary: 'Create and run a simulation', requestBody: json({ type: 'object', required: ['ruleSetId', 'name', 'dataset'], properties: { ruleSetId: { type: 'string', format: 'uuid' }, name: { type: 'string' }, dataset: { type: 'array', items: { type: 'object' } } } }), responses: created('Simulation run with results and coverage') },
    },
    '/simulations/{id}': {
      get: { tags: ['Simulations'], summary: 'Get simulation run with results', parameters: [id], responses: { 200: { description: 'Simulation details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      delete: { tags: ['Simulations'], summary: 'Delete a simulation run', parameters: [id], responses: ok('Simulation deleted') },
    },

    // ── Approvals (9 endpoints) ────────────────────────────────
    '/approvals/pipelines': {
      get: { tags: ['Approval Workflows'], summary: 'List approval pipelines', responses: ok('Array of pipelines') },
      post: { tags: ['Approval Workflows'], summary: 'Create an approval pipeline', requestBody: json({ type: 'object', required: ['name', 'stages'] }), responses: created('Pipeline created') },
    },
    '/approvals/pipelines/{id}': {
      put: { tags: ['Approval Workflows'], summary: 'Update an approval pipeline', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Pipeline updated') },
      delete: { tags: ['Approval Workflows'], summary: 'Delete an approval pipeline', parameters: [id], responses: ok('Pipeline deleted') },
    },
    '/approvals/requests': {
      get: { tags: ['Approval Workflows'], summary: 'List approval requests', parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'entityType', in: 'query', schema: { type: 'string' } }], responses: ok('Array of approval requests') },
      post: { tags: ['Approval Workflows'], summary: 'Create an approval request', requestBody: json({ type: 'object', required: ['pipelineId', 'entityType', 'entityId'] }), responses: created('Approval request created') },
    },
    '/approvals/requests/{id}/approve': {
      put: { tags: ['Approval Workflows'], summary: 'Approve current stage', parameters: [id], responses: ok('Stage approved (advances to next or marks approved)') },
    },
    '/approvals/requests/{id}/reject': {
      put: { tags: ['Approval Workflows'], summary: 'Reject approval request', parameters: [id], requestBody: json({ type: 'object', properties: { reason: { type: 'string' } } }), responses: ok('Request rejected') },
    },
    '/approvals/requests/{id}/comment': {
      post: { tags: ['Approval Workflows'], summary: 'Add comment to approval request', parameters: [id], requestBody: json({ type: 'object', required: ['comment'] }), responses: ok('Comment added') },
    },

    // ── API Keys (5 endpoints) ─────────────────────────────────
    '/api-keys': {
      get: { tags: ['API Keys'], summary: 'List API keys (masked)', responses: ok('Array of API keys') },
      post: { tags: ['API Keys'], summary: 'Create a new API key', requestBody: json({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, permissions: { type: 'array', items: { type: 'string' } }, rateLimit: { type: 'integer' }, expiresAt: { type: 'string', format: 'date-time' } } }), responses: created('API key created (full key returned once)') },
    },
    '/api-keys/{id}': {
      put: { tags: ['API Keys'], summary: 'Update an API key', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('API key updated') },
      delete: { tags: ['API Keys'], summary: 'Delete an API key', parameters: [id], responses: ok('API key deleted') },
    },
    '/api-keys/validate': {
      post: { tags: ['API Keys'], summary: 'Validate an API key', requestBody: json({ type: 'object', required: ['key'], properties: { key: { type: 'string' } } }), responses: ok('Validation result') },
    },

    // ── Scheduled Jobs (6 endpoints) ───────────────────────────
    '/scheduled-jobs': {
      get: { tags: ['Scheduled Jobs'], summary: 'List scheduled jobs', parameters: [{ name: 'entityType', in: 'query', schema: { type: 'string' } }], responses: ok('Array of scheduled jobs') },
      post: { tags: ['Scheduled Jobs'], summary: 'Create a scheduled job', requestBody: json({ type: 'object', required: ['name', 'entityType', 'entityId', 'cronExpression'], properties: { name: { type: 'string' }, entityType: { type: 'string' }, entityId: { type: 'string', format: 'uuid' }, cronExpression: { type: 'string' }, input: { type: 'object' }, timezone: { type: 'string' } } }), responses: created('Scheduled job created') },
    },
    '/scheduled-jobs/{id}': {
      get: { tags: ['Scheduled Jobs'], summary: 'Get a scheduled job', parameters: [id], responses: { 200: { description: 'Scheduled job details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Scheduled Jobs'], summary: 'Update a scheduled job', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Scheduled job updated') },
      delete: { tags: ['Scheduled Jobs'], summary: 'Delete a scheduled job', parameters: [id], responses: ok('Scheduled job deleted') },
    },
    '/scheduled-jobs/{id}/run-now': {
      post: { tags: ['Scheduled Jobs'], summary: 'Manually trigger a scheduled job', parameters: [id], responses: ok('Job executed immediately') },
    },

    // ── Templates (7 endpoints) ────────────────────────────────
    '/templates': {
      get: { tags: ['Templates'], summary: 'List templates', parameters: [{ name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'type', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: ok('Array of templates') },
      post: { tags: ['Templates'], summary: 'Create a template', requestBody: json({ type: 'object', required: ['name', 'category', 'content', 'type'] }), responses: created('Template created') },
    },
    '/templates/{id}': {
      get: { tags: ['Templates'], summary: 'Get a template', parameters: [id], responses: { 200: { description: 'Template details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Templates'], summary: 'Update a template', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Template updated') },
      delete: { tags: ['Templates'], summary: 'Delete a template', parameters: [id], responses: ok('Template deleted') },
    },
    '/templates/{id}/install': {
      post: { tags: ['Templates'], summary: 'Install template (creates project/ruleSet/workflow)', parameters: [id], responses: ok('Template installed, resources created') },
    },
    '/templates/{id}/rate': {
      post: { tags: ['Templates'], summary: 'Rate a template (1-5 stars)', parameters: [id], requestBody: json({ type: 'object', required: ['rating'], properties: { rating: { type: 'integer', minimum: 1, maximum: 5 } } }), responses: ok('Rating recorded') },
    },

    // ── Environments (8 endpoints) ─────────────────────────────
    '/environments': {
      get: { tags: ['Environments'], summary: 'List environments', responses: ok('Array of environments') },
      post: { tags: ['Environments'], summary: 'Create an environment', requestBody: json({ type: 'object', required: ['name', 'slug'] }), responses: created('Environment created') },
    },
    '/environments/{id}': {
      put: { tags: ['Environments'], summary: 'Update an environment', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Environment updated') },
      delete: { tags: ['Environments'], summary: 'Delete an environment', parameters: [id], responses: ok('Environment deleted') },
    },
    '/environments/promote': {
      post: { tags: ['Environments'], summary: 'Promote rule set between environments', requestBody: json({ type: 'object', required: ['ruleSetId', 'sourceEnvId', 'targetEnvId'] }), responses: ok('Promotion created') },
    },
    '/environments/promotions': {
      get: { tags: ['Environments'], summary: 'List promotions', parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'ruleSetId', in: 'query', schema: { type: 'string' } }], responses: ok('Array of promotions') },
    },
    '/environments/promotions/{id}/approve': {
      put: { tags: ['Environments'], summary: 'Approve a promotion', parameters: [id], responses: ok('Promotion approved') },
    },
    '/environments/promotions/{id}/reject': {
      put: { tags: ['Environments'], summary: 'Reject a promotion', parameters: [id], responses: ok('Promotion rejected') },
    },

    // ── Functions (6 endpoints) ────────────────────────────────
    '/functions': {
      get: { tags: ['Functions'], summary: 'List custom functions', responses: ok('Array of functions') },
      post: { tags: ['Functions'], summary: 'Create a custom function', requestBody: json({ type: 'object', required: ['name', 'code'], properties: { name: { type: 'string' }, code: { type: 'string' }, parameters: { type: 'array', items: { type: 'object' } }, returnType: { type: 'string' } } }), responses: created('Function created') },
    },
    '/functions/{id}': {
      get: { tags: ['Functions'], summary: 'Get a custom function', parameters: [id], responses: { 200: { description: 'Function details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Functions'], summary: 'Update a custom function (bumps version if code changed)', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Function updated') },
      delete: { tags: ['Functions'], summary: 'Delete a custom function', parameters: [id], responses: ok('Function deleted') },
    },
    '/functions/{id}/test': {
      post: { tags: ['Functions'], summary: 'Test a function with provided arguments', parameters: [id], requestBody: json({ type: 'object', properties: { args: { type: 'array', items: {} } } }), responses: ok('Function test result') },
    },

    // ── Permissions (6 endpoints) ──────────────────────────────
    '/permissions': {
      get: { tags: ['Permissions'], summary: 'List all permissions for tenant', responses: ok('Array of permissions') },
      post: { tags: ['Permissions'], summary: 'Create/upsert a permission', requestBody: json({ type: 'object', required: ['role', 'resource', 'actions'] }), responses: ok('Permission created or updated') },
    },
    '/permissions/role/{role}': {
      get: { tags: ['Permissions'], summary: 'Get permissions for a specific role', parameters: [{ name: 'role', in: 'path', required: true, schema: { type: 'string' } }], responses: ok('Permissions for role') },
    },
    '/permissions/{id}': {
      delete: { tags: ['Permissions'], summary: 'Delete a permission', parameters: [id], responses: ok('Permission deleted') },
    },
    '/permissions/check': {
      get: { tags: ['Permissions'], summary: 'Check if current user has permission', parameters: [{ name: 'resource', in: 'query', required: true, schema: { type: 'string' } }, { name: 'action', in: 'query', required: true, schema: { type: 'string' } }], responses: ok('Permission check result') },
    },
    '/permissions/seed-defaults': {
      post: { tags: ['Permissions'], summary: 'Seed default permissions for all roles', responses: ok('Default permissions seeded') },
    },

    // ── Reports (5 endpoints) ──────────────────────────────────
    '/reports': {
      get: { tags: ['Reports'], summary: 'List generated reports', responses: ok('Array of reports') },
    },
    '/reports/generate': {
      post: { tags: ['Reports'], summary: 'Generate a report', requestBody: json({ type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['audit-trail', 'change-summary', 'decision-report', 'compliance-status'] }, startDate: { type: 'string', format: 'date-time' }, endDate: { type: 'string', format: 'date-time' } } }), responses: created('Report generated') },
    },
    '/reports/{id}': {
      get: { tags: ['Reports'], summary: 'Get a report', parameters: [id], responses: { 200: { description: 'Report details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      delete: { tags: ['Reports'], summary: 'Delete a report', parameters: [id], responses: ok('Report deleted') },
    },
    '/reports/{id}/download': {
      get: { tags: ['Reports'], summary: 'Download report as JSON or CSV', parameters: [id, { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'] } }], responses: ok('Report file download') },
    },

    // ── Compliance (7 endpoints) ───────────────────────────────
    '/compliance': {
      get: { tags: ['Compliance'], summary: 'List compliance frameworks', responses: ok('Array of compliance frameworks') },
      post: { tags: ['Compliance'], summary: 'Create a compliance framework', requestBody: json({ type: 'object', required: ['name', 'framework'] }), responses: created('Framework created') },
    },
    '/compliance/{id}': {
      get: { tags: ['Compliance'], summary: 'Get a compliance framework with requirements', parameters: [id], responses: { 200: { description: 'Framework details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      put: { tags: ['Compliance'], summary: 'Update a compliance framework', parameters: [id], requestBody: json({ type: 'object' }), responses: ok('Framework updated') },
      delete: { tags: ['Compliance'], summary: 'Delete a compliance framework', parameters: [id], responses: ok('Framework deleted') },
    },
    '/compliance/{id}/certify': {
      post: { tags: ['Compliance'], summary: 'Mark framework as certified', parameters: [id], responses: ok('Framework certified') },
    },
    '/compliance/{id}/audit-trail': {
      get: { tags: ['Compliance'], summary: 'Get audit trail within retention period', parameters: [id], responses: ok('Audit trail entries') },
    },

    // ── Compliance Packs (3 endpoints) ─────────────────────────
    '/compliance-packs/packs': {
      get: { tags: ['Compliance Packs'], summary: 'List available compliance packs (HIPAA, SOX, GDPR, PCI-DSS)', security: [], responses: ok('Array of compliance packs') },
    },
    '/compliance-packs/packs/{framework}': {
      get: { tags: ['Compliance Packs'], summary: 'Get full pack details with rule definitions', parameters: [{ name: 'framework', in: 'path', required: true, schema: { type: 'string', enum: ['hipaa', 'sox', 'gdpr', 'pci-dss'] } }], responses: ok('Pack details') },
    },
    '/compliance-packs/packs/{framework}/install': {
      post: { tags: ['Compliance Packs'], summary: 'Install compliance pack (creates project, ruleset, rules, framework)', parameters: [{ name: 'framework', in: 'path', required: true, schema: { type: 'string' } }], responses: created('Compliance pack installed') },
    },

    // ── Audit (3 endpoints) ────────────────────────────────────
    '/audit': {
      get: { tags: ['Audit'], summary: 'List audit log entries', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }, { name: 'action', in: 'query', schema: { type: 'string' } }, { name: 'entity', in: 'query', schema: { type: 'string' } }, { name: 'userId', in: 'query', schema: { type: 'string' } }, { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } }], responses: ok('Paginated audit log entries') },
    },
    '/audit/entity/{entity}/{entityId}': {
      get: { tags: ['Audit'], summary: 'Get audit log for a specific entity', parameters: [{ name: 'entity', in: 'path', required: true, schema: { type: 'string' } }, { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } }], responses: ok('Entity audit trail') },
    },
    '/audit/export': {
      get: { tags: ['Audit'], summary: 'Export audit logs as JSON (admin only)', parameters: [{ name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } }], responses: ok('Downloadable JSON audit export') },
    },

    // ── Import/Export (4 endpoints) ────────────────────────────
    '/import-export/export/project/{id}': {
      get: { tags: ['Import/Export'], summary: 'Export full project as JSON bundle', parameters: [id], responses: ok('Project export bundle') },
    },
    '/import-export/export/rule-set/{id}': {
      get: { tags: ['Import/Export'], summary: 'Export single rule set as JSON bundle', parameters: [id], responses: ok('Rule set export bundle') },
    },
    '/import-export/import/project': {
      post: { tags: ['Import/Export'], summary: 'Import project bundle', requestBody: json({ type: 'object' }), responses: created('Project imported with all resources') },
    },
    '/import-export/import/rule-set/{projectId}': {
      post: { tags: ['Import/Export'], summary: 'Import rule set into existing project', parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: json({ type: 'object' }), responses: created('Rule set imported') },
    },

    // ── Copilot (3 endpoints) ──────────────────────────────────
    '/copilot/generate-rule': {
      post: { tags: ['Copilot'], summary: 'Generate a structured rule from natural language', requestBody: json({ type: 'object', required: ['description'], properties: { description: { type: 'string' }, context: { type: 'object' } } }), responses: ok('Generated rule structure') },
    },
    '/copilot/generate-decision-table': {
      post: { tags: ['Copilot'], summary: 'Generate a decision table from description', requestBody: json({ type: 'object', required: ['description'] }), responses: ok('Generated decision table') },
    },
    '/copilot/explain-rule': {
      post: { tags: ['Copilot'], summary: 'Convert stored rule to plain English explanation', requestBody: json({ type: 'object', required: ['ruleId'] }), responses: ok('Rule explanation in plain English') },
    },

    // ── A/B Tests (8 endpoints) ────────────────────────────────
    '/ab-tests': {
      get: { tags: ['A/B Tests'], summary: 'List A/B tests', parameters: [{ name: 'ruleSetId', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: ok('Array of A/B tests') },
      post: { tags: ['A/B Tests'], summary: 'Create an A/B test', requestBody: json({ type: 'object', required: ['ruleSetId', 'name', 'variantA', 'variantB'] }), responses: created('A/B test created') },
    },
    '/ab-tests/{id}': {
      get: { tags: ['A/B Tests'], summary: 'Get A/B test with metrics', parameters: [id], responses: { 200: { description: 'A/B test details' }, 404: { $ref: '#/components/responses/NotFound' } } },
      delete: { tags: ['A/B Tests'], summary: 'Delete an A/B test (draft only)', parameters: [id], responses: ok('A/B test deleted') },
    },
    '/ab-tests/{id}/start': {
      put: { tags: ['A/B Tests'], summary: 'Start an A/B test', parameters: [id], responses: ok('A/B test started') },
    },
    '/ab-tests/{id}/pause': {
      put: { tags: ['A/B Tests'], summary: 'Pause an A/B test', parameters: [id], responses: ok('A/B test paused') },
    },
    '/ab-tests/{id}/complete': {
      put: { tags: ['A/B Tests'], summary: 'Complete an A/B test and calculate final metrics', parameters: [id], responses: ok('A/B test completed with final metrics') },
    },
    '/ab-tests/{id}/execute': {
      post: { tags: ['A/B Tests'], summary: 'Execute with A/B routing (random variant assignment)', parameters: [id], requestBody: json({ $ref: '#/components/schemas/ExecutionRequest' }), responses: ok('Execution result with variant assignment') },
    },

    // ── Dashboard / Analytics (4 endpoints) ────────────────────
    '/dashboard/stats': {
      get: { tags: ['Analytics'], summary: 'Get dashboard overview statistics', responses: ok('Dashboard statistics (projects, rules, executions, etc.)') },
    },
    '/dashboard/executions': {
      get: { tags: ['Analytics'], summary: 'Get all execution logs', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }, { name: 'days', in: 'query', schema: { type: 'integer' } }], responses: ok('Execution logs') },
    },
    '/dashboard/executions/{ruleSetId}': {
      get: { tags: ['Analytics'], summary: 'Get execution logs for a specific rule set', parameters: [ruleSetIdParam], responses: ok('Rule set execution logs') },
    },
    '/dashboard/analytics': {
      get: { tags: ['Analytics'], summary: 'Get aggregated analytics by day with top rule sets', responses: ok('Aggregated analytics data') },
    },
  },
  tags: [
    { name: 'System', description: 'Health checks and system status' },
    { name: 'Authentication', description: 'User registration, login, SSO, and session management' },
    { name: 'Projects', description: 'Project container management' },
    { name: 'Rule Sets', description: 'Rule set lifecycle management' },
    { name: 'Rules', description: 'Individual rule CRUD within rule sets' },
    { name: 'Decision Tables', description: 'Decision table management for tabular business logic' },
    { name: 'Data Models', description: 'Data model schema definitions for input validation' },
    { name: 'Execution', description: 'Synchronous rule set execution' },
    { name: 'Batch Execution', description: 'Batch execution of rule sets against multiple inputs' },
    { name: 'Queue', description: 'Asynchronous rule execution via job queue' },
    { name: 'Workflows', description: 'BPMN workflow design, execution, and instance management' },
    { name: 'Version Management', description: 'Rule set versioning, publishing, rollback, and diff' },
    { name: 'Conflict Detection', description: 'Rule conflict analysis (overlap, shadow, contradiction)' },
    { name: 'Decision Trace', description: 'Full execution tracing for debugging and audit' },
    { name: 'Debugger', description: 'Step-through debugging with breakpoints' },
    { name: 'Replay', description: 'Execution replay and output comparison' },
    { name: 'Impact Analysis', description: 'Change impact analysis across rules, workflows, and jobs' },
    { name: 'Adapters', description: 'External integration adapters (REST, webhook, database)' },
    { name: 'Tenants', description: 'Multi-tenant management and usage statistics' },
    { name: 'Notifications', description: 'User notification management' },
    { name: 'Simulations', description: 'Rule testing simulations with datasets' },
    { name: 'Approval Workflows', description: 'Multi-stage approval pipelines and requests' },
    { name: 'API Keys', description: 'API key management for programmatic access' },
    { name: 'Scheduled Jobs', description: 'Cron-based scheduled rule and workflow execution' },
    { name: 'Templates', description: 'Reusable project, rule set, and workflow templates' },
    { name: 'Environments', description: 'Environment management and promotion workflows' },
    { name: 'Functions', description: 'Custom JavaScript function registration and testing' },
    { name: 'Permissions', description: 'Role-based access control (RBAC)' },
    { name: 'Reports', description: 'Compliance and analytics report generation' },
    { name: 'Compliance', description: 'Compliance framework management and certification' },
    { name: 'Compliance Packs', description: 'Pre-built compliance packs (HIPAA, SOX, GDPR, PCI-DSS)' },
    { name: 'Audit', description: 'Audit logging, entity trails, and export' },
    { name: 'Import/Export', description: 'Project and rule set import/export bundles' },
    { name: 'Copilot', description: 'AI-powered rule generation and explanation' },
    { name: 'A/B Tests', description: 'A/B testing for rule set variants' },
    { name: 'Analytics', description: 'Dashboard metrics, execution history, and aggregated analytics' },
  ],
};
