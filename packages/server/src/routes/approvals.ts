import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ============================================================
// Approval Pipelines
// ============================================================

// List all approval pipelines for tenant
router.get('/pipelines', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const pipelines = await prisma.approvalPipeline.findMany({
      where,
      include: { _count: { select: { requests: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = pipelines.map((p) => ({
      ...p,
      stages: JSON.parse(p.stages),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create approval pipeline
router.post('/pipelines', async (req: any, res) => {
  try {
    const { name, stages, entityType } = req.body;
    if (!name || !stages) {
      return res.status(400).json({ error: 'name and stages are required' });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
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
      stages: JSON.parse(pipeline.stages),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update approval pipeline
router.put('/pipelines/:id', async (req: any, res) => {
  try {
    const { name, stages, entityType, isDefault } = req.body;
    const data: any = {};

    if (name !== undefined) data.name = name;
    if (stages !== undefined) data.stages = JSON.stringify(stages);
    if (entityType !== undefined) data.entityType = entityType;
    if (isDefault !== undefined) data.isDefault = isDefault;

    const pipeline = await prisma.approvalPipeline.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      ...pipeline,
      stages: JSON.parse(pipeline.stages),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete approval pipeline
router.delete('/pipelines/:id', async (req: any, res) => {
  try {
    await prisma.approvalPipeline.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Approval Requests
// ============================================================

// List approval requests, filter by ?status, ?entityType
router.get('/requests', async (req: any, res) => {
  try {
    const { status, entityType } = req.query;
    const where: any = {};

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
      comments: JSON.parse(r.comments),
      pipeline: r.pipeline
        ? { ...r.pipeline, stages: JSON.parse(r.pipeline.stages) }
        : null,
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create approval request
router.post('/requests', async (req: any, res) => {
  try {
    const { pipelineId, entityType, entityId, entityName } = req.body;
    if (!pipelineId || !entityType || !entityId) {
      return res
        .status(400)
        .json({ error: 'pipelineId, entityType, and entityId are required' });
    }

    const requestedById = req.user?.id;
    if (!requestedById) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data: any = {
      pipelineId,
      entityType,
      entityId,
      entityName: entityName || '',
      requestedById,
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
      comments: JSON.parse(request.comments),
      pipeline: request.pipeline
        ? { ...request.pipeline, stages: JSON.parse(request.pipeline.stages) }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Approve current stage of an approval request
router.put('/requests/:id/approve', async (req: any, res) => {
  try {
    const { comment } = req.body;
    const request = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
      include: { pipeline: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (request.status !== 'pending') {
      return res
        .status(400)
        .json({ error: `Request is already ${request.status}` });
    }

    const stages = JSON.parse(request.pipeline.stages);
    const comments = JSON.parse(request.comments);

    // Add approval comment
    if (comment) {
      comments.push({
        userId: req.user?.id,
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
        reviewedById: req.user?.id,
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
      comments: JSON.parse(updated.comments),
      pipeline: updated.pipeline
        ? { ...updated.pipeline, stages: JSON.parse(updated.pipeline.stages) }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reject an approval request
router.put('/requests/:id/reject', async (req: any, res) => {
  try {
    const { comment } = req.body;
    const request = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (request.status !== 'pending') {
      return res
        .status(400)
        .json({ error: `Request is already ${request.status}` });
    }

    const comments = JSON.parse(request.comments);

    if (comment) {
      comments.push({
        userId: req.user?.id,
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
        reviewedById: req.user?.id,
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
      comments: JSON.parse(updated.comments),
      pipeline: updated.pipeline
        ? { ...updated.pipeline, stages: JSON.parse(updated.pipeline.stages) }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment to an approval request
router.post('/requests/:id/comment', async (req: any, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    const comments = JSON.parse(request.comments);
    comments.push({
      userId: req.user?.id,
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
      comments: JSON.parse(updated.comments),
      pipeline: updated.pipeline
        ? { ...updated.pipeline, stages: JSON.parse(updated.pipeline.stages) }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
