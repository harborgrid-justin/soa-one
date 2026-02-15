import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ============================================================
// Validation Middleware Factory
// ============================================================

/**
 * Express middleware that validates request body against a Zod schema.
 * Returns 400 with structured validation errors on failure.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware that validates request query params against a Zod schema.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: errors,
      });
    }
    req.query = result.data as any;
    next();
  };
}

/**
 * Express middleware that validates request params against a Zod schema.
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      return res.status(400).json({
        error: 'Invalid path parameters',
        details: errors,
      });
    }
    next();
  };
}

// ============================================================
// Common Schemas
// ============================================================

/** UUID path parameter */
export const uuidParam = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/** Pagination query parameters */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

// ============================================================
// Auth Schemas
// ============================================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(255),
  tenantName: z.string().min(1, 'Organization name is required').max(255),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatar: z.string().url().nullable().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  name: z.string().min(1, 'Name is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer'], {
    error: 'Role must be admin, editor, or viewer',
  }),
});

// ============================================================
// Project Schemas
// ============================================================

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).default(''),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

// ============================================================
// Rule Set Schemas
// ============================================================

export const createRuleSetSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).default(''),
  inputModelId: z.string().uuid().nullable().optional(),
});

export const updateRuleSetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'review', 'approved', 'published', 'archived']).optional(),
  inputModelId: z.string().uuid().nullable().optional(),
});

// ============================================================
// Rule Schemas
// ============================================================

const conditionSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    field: z.string().optional(),
    operator: z.string().optional(),
    value: z.any().optional(),
    logic: z.enum(['AND', 'OR']).optional(),
    conditions: z.array(conditionSchema).optional(),
  })
);

const actionSchema = z.object({
  type: z.enum(['SET', 'APPEND', 'INCREMENT', 'DECREMENT', 'CUSTOM']),
  field: z.string().min(1),
  value: z.any(),
});

export const createRuleSchema = z.object({
  ruleSetId: z.string().uuid('Invalid rule set ID'),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).default(''),
  priority: z.number().int().min(0).max(10000).default(0),
  conditions: conditionSchema,
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
  enabled: z.boolean().default(true),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  conditions: conditionSchema.optional(),
  actions: z.array(actionSchema).optional(),
  enabled: z.boolean().optional(),
});

// ============================================================
// Execution Schemas
// ============================================================

export const executeSchema = z.object({}).passthrough(); // allow any JSON input for rule execution

export const batchExecuteSchema = z.object({
  ruleSetId: z.string().uuid(),
  inputs: z.array(z.record(z.string(), z.any())).min(1).max(1000),
});

// ============================================================
// Data Model Schemas
// ============================================================

export const createDataModelSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name: z.string().min(1, 'Name is required').max(255),
  schema: z.any(),
});

export const updateDataModelSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  schema: z.any().optional(),
});

// ============================================================
// API Key Schemas
// ============================================================

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  permissions: z.array(z.enum(['execute', 'read', 'write'])).default(['execute']),
  rateLimit: z.number().int().min(1).max(100000).default(1000),
  expiresAt: z.string().datetime().nullable().optional(),
});
