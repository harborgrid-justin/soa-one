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

// ---------------------------------------------------------------------------
// Helper: verify ruleSetId belongs to the tenant
// ---------------------------------------------------------------------------
async function verifyRuleSetTenant(ruleSetId: string, tenantId: string) {
  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: ruleSetId },
    include: { project: true },
  });

  if (!ruleSet) return null;
  if (!ruleSet.project.tenantId || ruleSet.project.tenantId !== tenantId) return null;
  return ruleSet;
}

/**
 * Extract all field names referenced in a conditions object.
 */
function extractConditionFields(conditions: any): Set<string> {
  const fields = new Set<string>();

  if (!conditions) return fields;

  if (Array.isArray(conditions.conditions)) {
    for (const cond of conditions.conditions) {
      if (cond.field) {
        fields.add(cond.field);
      }
      // Recurse for nested groups
      if (cond.conditions) {
        const nested = extractConditionFields(cond);
        nested.forEach((f) => fields.add(f));
      }
    }
  }

  if (conditions.field) {
    fields.add(conditions.field);
  }

  return fields;
}

/**
 * Extract all field names referenced in an actions array.
 */
function extractActionFields(actions: any[]): Set<string> {
  const fields = new Set<string>();
  if (!Array.isArray(actions)) return fields;

  for (const action of actions) {
    if (action.target) fields.add(action.target);
    if (action.field) fields.add(action.field);
  }

  return fields;
}

// ---------------------------------------------------------------------------
// POST /analyze — perform impact analysis for proposed changes
// ---------------------------------------------------------------------------
router.post(
  '/analyze',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    requireUserId(req);

    const error = validateRequired(req.body, ['ruleSetId', 'changes']);
    if (error) {
      return res.status(400).json({ error });
    }

    const { ruleSetId, changes } = req.body;

    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: 'changes must be a non-empty array' });
    }

    // Verify tenant ownership
    const ruleSet = await verifyRuleSetTenant(ruleSetId, tenantId);
    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    // 1. Load all rules in the rule set
    const allRules = await prisma.rule.findMany({
      where: { ruleSetId },
      orderBy: { priority: 'desc' },
    });

    // Collect all fields referenced by the changed rules
    const changedRuleIds = new Set<string>();
    const changedFields = new Set<string>();

    for (const change of changes) {
      if (change.ruleId) {
        changedRuleIds.add(change.ruleId);
        // Find the rule and extract its fields
        const rule = allRules.find((r) => r.id === change.ruleId);
        if (rule) {
          const conditions = safeJsonParse(rule.conditions, {});
          const actions = safeJsonParse(rule.actions, []);
          extractConditionFields(conditions).forEach((f) => changedFields.add(f));
          extractActionFields(actions).forEach((f) => changedFields.add(f));
        }
      }
    }

    // 2. Find all rules that share condition fields with changed rules (affected rules)
    const affectedRules: { ruleId: string; ruleName: string; impact: string }[] = [];
    for (const rule of allRules) {
      if (changedRuleIds.has(rule.id)) continue; // Skip the changed rules themselves

      const conditions = safeJsonParse(rule.conditions, {});
      const actions = safeJsonParse(rule.actions, []);
      const ruleFields = new Set<string>();
      extractConditionFields(conditions).forEach((f) => ruleFields.add(f));
      extractActionFields(actions).forEach((f) => ruleFields.add(f));

      // Check for field overlap
      let hasOverlap = false;
      for (const field of changedFields) {
        if (ruleFields.has(field)) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        affectedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          impact: 'indirect',
        });
      }
    }

    // Add directly changed rules
    for (const change of changes) {
      if (change.ruleId) {
        const rule = allRules.find((r) => r.id === change.ruleId);
        if (rule) {
          affectedRules.unshift({
            ruleId: rule.id,
            ruleName: rule.name,
            impact: 'direct',
          });
        }
      }
    }

    // 3. Find all workflows that reference this rule set
    // Workflows reference rule sets through their nodes configuration
    const projectWorkflows = await prisma.workflow.findMany({
      where: { projectId: ruleSet.projectId },
    });

    const affectedWorkflows: { workflowId: string; workflowName: string }[] = [];
    for (const wf of projectWorkflows) {
      const nodes = safeJsonParse(wf.nodes, []);
      // Check if any workflow node references this rule set
      const referencesRuleSet = nodes.some((node: any) => {
        const data = node.data || {};
        return data.ruleSetId === ruleSetId || data.entityId === ruleSetId;
      });

      if (referencesRuleSet) {
        affectedWorkflows.push({
          workflowId: wf.id,
          workflowName: wf.name,
        });
      }
    }

    // 4. Find all scheduled jobs targeting this rule set
    const scheduledJobs = await prisma.scheduledJob.findMany({
      where: {
        OR: [
          { ruleSetId },
          { entityType: 'ruleSet', entityId: ruleSetId },
        ],
      },
    });

    // 5. Compute risk level based on percentage of rules affected
    const totalRules = allRules.length;
    const affectedCount = affectedRules.length;
    const affectedPercentage = totalRules > 0 ? (affectedCount / totalRules) * 100 : 0;

    let riskLevel: string;
    if (affectedPercentage > 50) {
      riskLevel = 'high';
    } else if (affectedPercentage >= 20) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Elevate risk if workflows or scheduled jobs are affected
    if (affectedWorkflows.length > 0 && riskLevel === 'low') {
      riskLevel = 'medium';
    }
    if (scheduledJobs.length > 0 && riskLevel === 'low') {
      riskLevel = 'medium';
    }

    // 6. Sample recent executions to estimate approval rate impact
    let sampleResults: any = {};
    const recentLogs = await prisma.executionLog.findMany({
      where: { ruleSetId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (recentLogs.length > 0) {
      let approvedBefore = 0;
      let totalSampled = recentLogs.length;
      let totalTimeBefore = 0;

      for (const log of recentLogs) {
        const output = safeJsonParse(log.output, {});
        if (
          output.status === 'approved' ||
          output.approved === true ||
          output.decision === 'approve'
        ) {
          approvedBefore++;
        }
        totalTimeBefore += log.executionTimeMs;
      }

      const approvalRateBefore = totalSampled > 0
        ? Math.round((approvedBefore / totalSampled) * 100)
        : 0;
      const avgTimeBefore = totalSampled > 0
        ? Math.round(totalTimeBefore / totalSampled)
        : 0;

      // Estimate impact: we cannot re-execute without the new rules, so we estimate
      // based on the nature of changes
      let estimatedApprovalDelta = 0;
      for (const change of changes) {
        if (change.changeType === 'delete' || change.changeType === 'disable') {
          estimatedApprovalDelta += 5; // Removing restrictions may increase approvals
        } else if (change.changeType === 'add') {
          estimatedApprovalDelta -= 3; // Adding rules may decrease approvals
        } else if (change.changeType === 'modify') {
          estimatedApprovalDelta += 0; // Unknown effect
        }
      }

      sampleResults = {
        sampleSize: totalSampled,
        before: {
          approvalRate: approvalRateBefore,
          avgTimeMs: avgTimeBefore,
        },
        estimatedAfter: {
          approvalRate: Math.max(0, Math.min(100, approvalRateBefore + estimatedApprovalDelta)),
          avgTimeMs: avgTimeBefore, // Time impact is negligible for most changes
        },
        estimatedApprovalDelta,
      };
    }

    // Build the change summary
    const changeSummary = changes
      .map((c: any) => {
        const ruleRef = c.ruleId
          ? allRules.find((r) => r.id === c.ruleId)?.name || c.ruleId
          : 'new rule';
        return `${c.changeType} ${ruleRef}${c.description ? ': ' + c.description : ''}`;
      })
      .join('; ');

    // Save the analysis
    const analysis = await prisma.impactAnalysis.create({
      data: {
        ruleSetId,
        ruleId: changes[0]?.ruleId || null,
        changeType: changes.length === 1 ? changes[0].changeType : 'multiple',
        changeSummary,
        affectedRules: JSON.stringify(affectedRules),
        affectedWorkflows: JSON.stringify(affectedWorkflows),
        riskLevel,
        sampleResults: JSON.stringify(sampleResults),
      },
    });

    res.status(201).json({
      ...analysis,
      affectedRules,
      affectedWorkflows,
      affectedScheduledJobs: scheduledJobs.map((j) => ({ id: j.id, name: j.name })),
      sampleResults,
      stats: {
        totalRulesInSet: totalRules,
        directlyAffected: changes.filter((c: any) => c.ruleId).length,
        indirectlyAffected: affectedRules.filter((r) => r.impact === 'indirect').length,
        affectedWorkflowCount: affectedWorkflows.length,
        affectedScheduledJobCount: scheduledJobs.length,
        affectedPercentage: Math.round(affectedPercentage),
        riskLevel,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /rule-sets/:ruleSetId — get all past impact analyses for a rule set
// ---------------------------------------------------------------------------
router.get(
  '/rule-sets/:ruleSetId',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const ruleSet = await verifyRuleSetTenant(req.params.ruleSetId, tenantId);
    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    const analyses = await prisma.impactAnalysis.findMany({
      where: { ruleSetId: req.params.ruleSetId },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = analyses.map((a) => ({
      ...a,
      affectedRules: safeJsonParse(a.affectedRules, []),
      affectedWorkflows: safeJsonParse(a.affectedWorkflows, []),
      sampleResults: safeJsonParse(a.sampleResults, {}),
    }));

    res.json(parsed);
  }),
);

// ---------------------------------------------------------------------------
// GET /:id — get a single impact analysis
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const analysis = await prisma.impactAnalysis.findUnique({
      where: { id: req.params.id },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Impact analysis not found' });
    }

    // Verify tenant ownership via the rule set
    const ruleSet = await verifyRuleSetTenant(analysis.ruleSetId, tenantId);
    if (!ruleSet) {
      return res.status(404).json({ error: 'Impact analysis not found' });
    }

    res.json({
      ...analysis,
      affectedRules: safeJsonParse(analysis.affectedRules, []),
      affectedWorkflows: safeJsonParse(analysis.affectedWorkflows, []),
      sampleResults: safeJsonParse(analysis.sampleResults, {}),
    });
  }),
);

export default router;
