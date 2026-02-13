/**
 * SOA One — OpenAPI 3.0 Specification
 *
 * Machine-readable API documentation for enterprise integration,
 * partner onboarding, and compliance audits.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SOA One — Enterprise Business Rules Platform API',
    description:
      'REST API for the SOA One business rules engine platform. Enables visual rule design, ' +
      'testing, execution, and monitoring of enterprise decision logic without code.',
    version: '8.0.0',
    contact: {
      name: 'SOA One Engineering',
      email: 'engineering@soaone.com',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained via POST /auth/login',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for programmatic access',
      },
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
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
                code: { type: 'string' },
              },
            },
          },
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
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['up', 'down'] },
                },
              },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/UserSummary' },
          tenant: { $ref: '#/components/schemas/TenantSummary' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'name', 'tenantName'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255 },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          tenantName: { type: 'string', minLength: 1, maxLength: 255 },
        },
      },
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      TenantSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          plan: { type: 'string', enum: ['starter', 'professional', 'enterprise'] },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid', nullable: true },
          name: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateProjectRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 2000, default: '' },
        },
      },
      RuleSet: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'review', 'approved', 'published', 'archived'] },
          version: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ExecutionRequest: {
        type: 'object',
        description: 'Any JSON object representing the facts/input data for rule evaluation',
        additionalProperties: true,
      },
      ExecutionResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          input: { type: 'object', additionalProperties: true },
          output: { type: 'object', additionalProperties: true },
          ruleResults: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ruleId: { type: 'string' },
                ruleName: { type: 'string' },
                fired: { type: 'boolean' },
                actions: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          tableResults: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tableId: { type: 'string' },
                tableName: { type: 'string' },
                matchedRows: { type: 'array', items: { type: 'string' } },
                actions: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          rulesFired: { type: 'array', items: { type: 'string' } },
          executionTimeMs: { type: 'integer' },
          error: { type: 'string', nullable: true },
        },
      },
    },
    parameters: {
      IdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Resource UUID',
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
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
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness probe',
        description: 'Returns 200 if the service is running. Use for Kubernetes liveness checks.',
        security: [],
        responses: {
          200: {
            description: 'Service is alive',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['System'],
        summary: 'Readiness probe',
        description: 'Verifies database connectivity. Use for Kubernetes readiness checks.',
        security: [],
        responses: {
          200: {
            description: 'Service is ready to handle requests',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessResponse' } } },
          },
          503: {
            description: 'Service not ready (database unavailable)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessResponse' } } },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new tenant and admin user',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: {
            description: 'Registration successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
          },
          409: { description: 'Email or organization already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate and receive a JWT token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user profile',
        responses: {
          200: { description: 'User profile' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List all projects',
        responses: {
          200: {
            description: 'Array of projects',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Projects'],
        summary: 'Create a new project',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectRequest' } } },
        },
        responses: {
          201: {
            description: 'Project created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } },
          },
          400: { description: 'Validation error' },
        },
      },
    },
    '/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project details',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: {
            description: 'Project details with rule sets and data models',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Projects'],
        summary: 'Update a project',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectRequest' } } },
        },
        responses: {
          200: { description: 'Updated project' },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a project and all associated resources',
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          200: { description: 'Project deleted' },
        },
      },
    },
    '/rule-sets': {
      get: {
        tags: ['Rule Sets'],
        summary: 'List all rule sets',
        responses: { 200: { description: 'Array of rule sets' } },
      },
      post: {
        tags: ['Rule Sets'],
        summary: 'Create a new rule set',
        responses: { 201: { description: 'Rule set created' } },
      },
    },
    '/execute/{ruleSetId}': {
      post: {
        tags: ['Execution'],
        summary: 'Execute a published rule set synchronously',
        description:
          'Evaluates input data against the specified published rule set and returns the decision output. ' +
          'Execution is logged for audit and compliance purposes.',
        parameters: [
          {
            name: 'ruleSetId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRequest' } } },
        },
        responses: {
          200: {
            description: 'Execution result with decision output and audit trail',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionResult' } } },
          },
          400: { description: 'Rule set not published or invalid input' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/execute/{ruleSetId}/test': {
      post: {
        tags: ['Execution'],
        summary: 'Test-execute a rule set (no logging, draft allowed)',
        parameters: [
          {
            name: 'ruleSetId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRequest' } } },
        },
        responses: {
          200: {
            description: 'Test execution result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionResult' } } },
          },
        },
      },
    },
    '/workflows': {
      get: { tags: ['Workflows'], summary: 'List all workflows', responses: { 200: { description: 'Array of workflows' } } },
      post: { tags: ['Workflows'], summary: 'Create a new BPMN workflow', responses: { 201: { description: 'Workflow created' } } },
    },
    '/dashboard': {
      get: { tags: ['Analytics'], summary: 'Get dashboard statistics and metrics', responses: { 200: { description: 'Dashboard data' } } },
    },
    '/audit': {
      get: { tags: ['Compliance'], summary: 'List audit log entries', responses: { 200: { description: 'Audit log entries' } } },
    },
    '/compliance': {
      get: { tags: ['Compliance'], summary: 'List compliance frameworks', responses: { 200: { description: 'Compliance frameworks' } } },
    },
    '/api-keys': {
      get: { tags: ['API Keys'], summary: 'List API keys for the tenant', responses: { 200: { description: 'API keys' } } },
      post: { tags: ['API Keys'], summary: 'Create a new API key', responses: { 201: { description: 'API key created' } } },
    },
  },
  tags: [
    { name: 'System', description: 'Health checks and system status' },
    { name: 'Authentication', description: 'User registration, login, and session management' },
    { name: 'Projects', description: 'Project container management' },
    { name: 'Rule Sets', description: 'Rule set lifecycle management' },
    { name: 'Execution', description: 'Synchronous and asynchronous rule execution' },
    { name: 'Workflows', description: 'BPMN workflow design and execution' },
    { name: 'Analytics', description: 'Dashboard metrics and reporting' },
    { name: 'Compliance', description: 'Audit logs, compliance frameworks, and reports' },
    { name: 'API Keys', description: 'API key management for programmatic access' },
  ],
};
