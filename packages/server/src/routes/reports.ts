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

// List generated reports for tenant
router.get('/', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const reports = await prisma.complianceReport.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      frameworkId: true,
      name: true,
      type: true,
      parameters: true,
      format: true,
      generatedBy: true,
      createdAt: true,
    },
  });

  const parsed = reports.map((r) => ({
    ...r,
    parameters: safeJsonParse(r.parameters, {}),
  }));

  res.json(parsed);
}));

// Generate a report
router.post('/generate', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  const userId = requireUserId(req);

  const error = validateRequired(req.body, ['type', 'name']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { type, name, parameters } = req.body;
  const params = parameters || {};

  let content: any;

  switch (type) {
    case 'audit-trail': {
      // Query AuditLog by date range + entity filter
      const where: any = { tenantId };

      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) where.createdAt.gte = new Date(params.startDate);
        if (params.endDate) where.createdAt.lte = new Date(params.endDate);
      }

      if (params.entity) where.entity = params.entity;
      if (params.action) where.action = params.action;

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      content = {
        reportType: 'audit-trail',
        generatedAt: new Date().toISOString(),
        filters: params,
        totalEntries: logs.length,
        entries: logs.map((log) => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          entityName: log.entityName,
          userName: log.userName,
          user: log.user,
          before: safeJsonParse(log.before, null),
          after: safeJsonParse(log.after, null),
          metadata: safeJsonParse(log.metadata, null),
          createdAt: log.createdAt,
        })),
      };
      break;
    }

    case 'change-summary': {
      // For a ruleSetId, show all versions, who published, what changed
      if (!params.ruleSetId) {
        return res.status(400).json({ error: 'parameters.ruleSetId is required for change-summary report' });
      }

      const ruleSet = await prisma.ruleSet.findUnique({
        where: { id: params.ruleSetId },
      });

      if (!ruleSet) {
        return res.status(404).json({ error: 'Rule set not found' });
      }

      const versions = await prisma.ruleSetVersion.findMany({
        where: { ruleSetId: params.ruleSetId },
        orderBy: { version: 'desc' },
      });

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          entityId: params.ruleSetId,
          entity: 'ruleSet',
        },
        orderBy: { createdAt: 'desc' },
      });

      content = {
        reportType: 'change-summary',
        generatedAt: new Date().toISOString(),
        ruleSet: {
          id: ruleSet.id,
          name: ruleSet.name,
          currentVersion: ruleSet.version,
          status: ruleSet.status,
        },
        totalVersions: versions.length,
        versions: versions.map((v) => ({
          version: v.version,
          publishedBy: v.publishedBy,
          publishedAt: v.publishedAt,
          changelog: v.changelog,
          snapshot: safeJsonParse(v.snapshot, {}),
        })),
        changeHistory: auditLogs.map((log) => ({
          action: log.action,
          userName: log.userName,
          before: safeJsonParse(log.before, null),
          after: safeJsonParse(log.after, null),
          createdAt: log.createdAt,
        })),
      };
      break;
    }

    case 'decision-report': {
      // For a ruleSetId + date range, show execution stats and top decisions
      if (!params.ruleSetId) {
        return res.status(400).json({ error: 'parameters.ruleSetId is required for decision-report' });
      }

      const where: any = { ruleSetId: params.ruleSetId };

      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) where.createdAt.gte = new Date(params.startDate);
        if (params.endDate) where.createdAt.lte = new Date(params.endDate);
      }

      const executions = await prisma.executionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const totalExecutions = executions.length;
      const successes = executions.filter((e) => e.status === 'success').length;
      const failures = executions.filter((e) => e.status === 'error').length;
      const avgTimeMs = totalExecutions > 0
        ? Math.round(executions.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalExecutions)
        : 0;

      // Count rules fired frequency
      const ruleFrequency: Record<string, number> = {};
      for (const exec of executions) {
        const fired = safeJsonParse(exec.rulesFired, []);
        for (const ruleId of fired) {
          ruleFrequency[ruleId] = (ruleFrequency[ruleId] || 0) + 1;
        }
      }

      const topRules = Object.entries(ruleFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ruleId, count]) => ({ ruleId, count }));

      content = {
        reportType: 'decision-report',
        generatedAt: new Date().toISOString(),
        ruleSetId: params.ruleSetId,
        filters: params,
        stats: {
          totalExecutions,
          successes,
          failures,
          successRate: totalExecutions > 0 ? Math.round((successes / totalExecutions) * 100) : 0,
          avgTimeMs,
        },
        topRulesFired: topRules,
        recentExecutions: executions.slice(0, 50).map((e) => ({
          id: e.id,
          version: e.version,
          status: e.status,
          executionTimeMs: e.executionTimeMs,
          rulesFired: safeJsonParse(e.rulesFired, []),
          createdAt: e.createdAt,
        })),
      };
      break;
    }

    case 'compliance-status': {
      // For a frameworkId, show all requirements with current status
      if (!params.frameworkId) {
        return res.status(400).json({ error: 'parameters.frameworkId is required for compliance-status report' });
      }

      const framework = await prisma.complianceFramework.findUnique({
        where: { id: params.frameworkId },
      });

      if (!framework) {
        return res.status(404).json({ error: 'Compliance framework not found' });
      }

      if (framework.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const requirements = safeJsonParse(framework.requirements, []);

      // Group by status
      const statusCounts: Record<string, number> = {};
      for (const req of requirements) {
        const status = req.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }

      content = {
        reportType: 'compliance-status',
        generatedAt: new Date().toISOString(),
        framework: {
          id: framework.id,
          name: framework.name,
          framework: framework.framework,
          status: framework.status,
          certifiedAt: framework.certifiedAt,
          certifiedBy: framework.certifiedBy,
        },
        totalRequirements: requirements.length,
        statusBreakdown: statusCounts,
        requirements,
      };
      break;
    }

    default:
      return res.status(400).json({ error: `Unknown report type: ${type}` });
  }

  const report = await prisma.complianceReport.create({
    data: {
      tenantId,
      name,
      type,
      parameters: JSON.stringify(params),
      content: JSON.stringify(content),
      generatedBy: userId,
      frameworkId: params.frameworkId || null,
    },
  });

  res.status(201).json({
    ...report,
    parameters: safeJsonParse(report.parameters, {}),
    content,
  });
}));

// Get a generated report
router.get('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const report = await prisma.complianceReport.findUnique({
    where: { id: req.params.id },
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (report.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    ...report,
    parameters: safeJsonParse(report.parameters, {}),
    content: safeJsonParse(report.content, {}),
  });
}));

// Delete report
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const report = await prisma.complianceReport.findUnique({
    where: { id: req.params.id },
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (report.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.complianceReport.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Download report with Content-Disposition header
router.get('/:id/download', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);

  const report = await prisma.complianceReport.findUnique({
    where: { id: req.params.id },
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (report.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const content = safeJsonParse(report.content, {});
  const sanitizedName = report.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const extension = report.format === 'csv' ? 'csv' : 'json';
  const filename = `${sanitizedName}_${report.id}.${extension}`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (report.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.send(report.content);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.json(content);
  }
}));

export default router;
