import { Router } from 'express';
import { prisma } from '../prisma';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

const router = Router();

// List custom functions for tenant
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const functions = await prisma.customFunction.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  const parsed = functions.map((f) => ({
    ...f,
    parameters: safeJsonParse(f.parameters, []),
  }));

  res.json(parsed);
}));

// Get single function
router.get('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const fn = await prisma.customFunction.findUnique({
    where: { id: req.params.id },
  });

  if (!fn) {
    return res.status(404).json({ error: 'Custom function not found' });
  }

  if (fn.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    ...fn,
    parameters: safeJsonParse(fn.parameters, []),
  });
}));

// Create function
router.post('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['name', 'code']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, code, parameters, returnType } = req.body;

  // Validate code syntax by wrapping in new Function()
  try {
    new Function(code);
  } catch (syntaxError: any) {
    return res.status(400).json({
      error: 'Invalid function syntax',
      details: syntaxError.message,
    });
  }

  const fn = await prisma.customFunction.create({
    data: {
      tenantId,
      name,
      description: description || '',
      code,
      parameters: JSON.stringify(parameters || []),
      returnType: returnType || 'any',
    },
  });

  res.status(201).json({
    ...fn,
    parameters: safeJsonParse(fn.parameters, []),
  });
}));

// Update function (bump version if code changed)
router.put('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const existing = await prisma.customFunction.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Custom function not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, description, code, parameters, returnType, isActive } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (parameters !== undefined) data.parameters = JSON.stringify(parameters);
  if (returnType !== undefined) data.returnType = returnType;
  if (isActive !== undefined) data.isActive = isActive;

  if (code !== undefined) {
    // Validate code syntax
    try {
      new Function(code);
    } catch (syntaxError: any) {
      return res.status(400).json({
        error: 'Invalid function syntax',
        details: syntaxError.message,
      });
    }

    data.code = code;

    // Bump version if code changed
    if (code !== existing.code) {
      data.version = existing.version + 1;
    }
  }

  const updated = await prisma.customFunction.update({
    where: { id: req.params.id },
    data,
  });

  res.json({
    ...updated,
    parameters: safeJsonParse(updated.parameters, []),
  });
}));

// Delete function
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const existing = await prisma.customFunction.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Custom function not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.customFunction.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Test a function with provided arguments
router.post('/:id/test', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const fn = await prisma.customFunction.findUnique({
    where: { id: req.params.id },
  });

  if (!fn) {
    return res.status(404).json({ error: 'Custom function not found' });
  }

  if (fn.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { args } = req.body;

  if (!Array.isArray(args)) {
    return res.status(400).json({ error: 'args must be an array' });
  }

  const params = safeJsonParse(fn.parameters, []);
  const paramNames = params.map((p: any) => p.name);

  try {
    const executableFn = new Function(...paramNames, fn.code);
    const result = executableFn(...args);

    res.json({
      success: true,
      result,
      functionName: fn.name,
      version: fn.version,
    });
  } catch (execError: any) {
    res.json({
      success: false,
      error: execError.message,
      functionName: fn.name,
      version: fn.version,
    });
  }
}));

export default router;
