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

// ============================================================
// Approval Pipelines
// ============================================================

// List all approval pipelines for tenant
router.get('/pipelines', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const pipelines = await prisma.approvalPipeline.findMany({
    where: { tenantId },
    include: { _count: { select: { requests: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const parsed = pipelines.map((p) => ({
    ...p,
    stages: safeJsonParse(p.stages, []),
  }));

  res.json(parsed);
}));

// Create approval pipeline
router.post('/pipelines', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const error = validateRequired(req.body, ['name', 'stages']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, stages, entityType } = req.body;

  if (!Array.isArray(stages)) {
    return res.status(400).json({ error: 'stages must be an array' });
  }

  const pipeline = await prisma.approvalPipeline.create({
    data: {
      tenantId,
      name,
      stages: JSON.stringify(stages),
      entityType: entityType || 'ruleSet',
    },
  });

  res.status(201).json({
    ...pipeline,
    stages: safeJsonParse(pipeline.stages, []),
  });
}));

// Update approval pipeline
router.put('/pipelines/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify pipeline belongs to tenant
  const existing = await prisma.approvalPipeline.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Approval pipeline not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, stages, entityType, isDefault } = req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (stages !== undefined) {
    if (!Array.isArray(stages)) {
      return res.status(400).json({ error: 'stages must be an array' });
    }
    data.stages = JSON.stringify(stages);
  }
  if (entityType !== undefined) data.entityType = entityType;
  if (isDefault !== undefined) data.isDefault = isDefault;

  const pipeline = await prisma.approvalPipeline.update({
    where: { id: req.params.id },
    data,
  });

  res.json({
    ...pipeline,
    stages: safeJsonParse(pipeline.stages, []),
  });
}));

// Delete approval pipeline
router.delete('/pipelines/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  // Verify pipeline belongs to tenant
  const existing = await prisma.approvalPipeline.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Approval pipeline not found' });
  }

  if (existing.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.approvalPipeline.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ============================================================
// Approval Requests
// ============================================================

// List approval requests, filter by ?status, ?entityType
router.get('/requests', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const { status, entityType } = req.query;
  const where: any = {
    pipeline: { tenantId },
  };

  if (status) where.status = String(status);
  if (entityType) where.entityType = String(entityType);

  const requests = await prisma.approvalRequest.findMany({
    where,
    include: {
      pipeline: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const parsed = requests.map((r) => ({
    ...r,
    comments: safeJsonParse(r.comments, []),
    pipeline: r.pipeline
      ? { ...r.pipeline, stages: safeJsonParse(r.pipeline.stages, []) }
      : null,
  }));

  res.json(parsed);
}));

// Create approval request
router.post('/requests', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const error = validateRequired(req.body, ['pipelineId', 'entityType', 'entityId']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { pipelineId, entityType, entityId, entityName } = req.body;

  // Verify the pipeline belongs to the user's tenant
  const pipeline = await prisma.approvalPipeline.findUnique({
    where: { id: pipelineId },
  });

  if (!pipeline) {
    return res.status(404).json({ error: 'Approval pipeline not found' });
  }

  if (pipeline.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = {
    pipelineId,
    entityType,
    entityId,
    entityName: entityName || '',
    requestedById: userId,
    currentStage: 0,
    status: 'pending',
  };

  // Link to ruleSet if entityType is ruleSet
  if (entityType === 'ruleSet') {
    data.ruleSetId = entityId;
  }

  const request = await prisma.approvalRequest.create({
    data,
    include: {
      pipeline: true,
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.status(201).json({
    ...request,
    comments: safeJsonParse(request.comments, []),
    pipeline: request.pipeline
      ? { ...request.pipeline, stages: safeJsonParse(request.pipeline.stages, []) }
      : null,
  });
}));

// Approve current stage of an approval request
router.put('/requests/:id/approve', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const { comment } = req.body;
  const request = await prisma.approvalRequest.findUnique({
    where: { id: req.params.id },
    include: { pipeline: true },
  });

  if (!request) {
    return res.status(404).json({ error: 'Approval request not found' });
  }

  // Verify the pipeline belongs to the user's tenant
  if (request.pipeline.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (request.status !== 'pending') {
    return res
      .status(400)
      .json({ error: `Request is already ${request.status}` });
  }

  const stages = safeJsonParse(request.pipeline.stages, []);
  const comments = safeJsonParse(request.comments, []);

  // Verify the user has the required role for the current stage
  const currentStageConfig = stages[request.currentStage];
  if (currentStageConfig && currentStageConfig.requiredRole) {
    const userRole = req.user?.role;
    if (userRole !== currentStageConfig.requiredRole && userRole !== 'admin') {
      return res.status(403).json({
        error: `Role '${currentStageConfig.requiredRole}' is required to approve this stage`,
      });
    }
  }

  // Add approval comment
  if (comment) {
    comments.push({
      userId,
      userName: req.user?.name || 'Unknown',
      text: comment,
      type: 'approval',
      stage: request.currentStage,
      timestamp: new Date().toISOString(),
    });
  }

  const nextStage = request.currentStage + 1;
  const allStagesPassed = nextStage >= stages.length;

  const updated = await prisma.approvalRequest.update({
    where: { id: req.params.id },
    data: {
      currentStage: allStagesPassed ? request.currentStage : nextStage,
      status: allStagesPassed ? 'approved' : 'pending',
      reviewedById: userId,
      comments: JSON.stringify(comments),
    },
    include: {
      pipeline: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({
    ...updated,
    comments: safeJsonParse(updated.comments, []),
    pipeline: updated.pipeline
      ? { ...updated.pipeline, stages: safeJsonParse(updated.pipeline.stages, []) }
      : null,
  });
}));

// Reject an approval request
router.put('/requests/:id/reject', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const { comment } = req.body;
  const request = await prisma.approvalRequest.findUnique({
    where: { id: req.params.id },
    include: { pipeline: true },
  });

  if (!request) {
    return res.status(404).json({ error: 'Approval request not found' });
  }

  // Verify the pipeline belongs to the user's tenant
  if (request.pipeline.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (request.status !== 'pending') {
    return res
      .status(400)
      .json({ error: `Request is already ${request.status}` });
  }

  const stages = safeJsonParse(request.pipeline.stages, []);
  const comments = safeJsonParse(request.comments, []);

  // Verify the user has the required role for the current stage
  const currentStageConfig = stages[request.currentStage];
  if (currentStageConfig && currentStageConfig.requiredRole) {
    const userRole = req.user?.role;
    if (userRole !== currentStageConfig.requiredRole && userRole !== 'admin') {
      return res.status(403).json({
        error: `Role '${currentStageConfig.requiredRole}' is required to reject this stage`,
      });
    }
  }

  if (comment) {
    comments.push({
      userId,
      userName: req.user?.name || 'Unknown',
      text: comment,
      type: 'rejection',
      stage: request.currentStage,
      timestamp: new Date().toISOString(),
    });
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'rejected',
      reviewedById: userId,
      comments: JSON.stringify(comments),
    },
    include: {
      pipeline: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({
    ...updated,
    comments: safeJsonParse(updated.comments, []),
    pipeline: updated.pipeline
      ? { ...updated.pipeline, stages: safeJsonParse(updated.pipeline.stages, []) }
      : null,
  });
}));

// Add comment to an approval request
router.post('/requests/:id/comment', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const request = await prisma.approvalRequest.findUnique({
    where: { id: req.params.id },
    include: { pipeline: true },
  });

  if (!request) {
    return res.status(404).json({ error: 'Approval request not found' });
  }

  // Verify the pipeline belongs to the user's tenant
  if (request.pipeline.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const comments = safeJsonParse(request.comments, []);
  comments.push({
    userId,
    userName: req.user?.name || 'Unknown',
    text,
    type: 'comment',
    timestamp: new Date().toISOString(),
  });

  const updated = await prisma.approvalRequest.update({
    where: { id: req.params.id },
    data: { comments: JSON.stringify(comments) },
    include: {
      pipeline: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({
    ...updated,
    comments: safeJsonParse(updated.comments, []),
    pipeline: updated.pipeline
      ? { ...updated.pipeline, stages: safeJsonParse(updated.pipeline.stages, []) }
      : null,
  });
}));

export default router;
