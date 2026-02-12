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
// Export Routes
// ============================================================

// Export a full project as JSON bundle
router.get('/export/project/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      ruleSets: {
        include: {
          rules: { orderBy: { priority: 'desc' } },
          decisionTables: { orderBy: { createdAt: 'asc' } },
        },
      },
      dataModels: true,
      workflows: true,
      adapters: true,
    },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Verify the project belongs to the user's tenant
  if (project.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const bundle = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'project',
    project: {
      name: project.name,
      description: project.description,
      ruleSets: project.ruleSets.map((rs) => ({
        name: rs.name,
        description: rs.description,
        status: rs.status,
        version: rs.version,
        rules: rs.rules.map((r) => ({
          name: r.name,
          description: r.description,
          priority: r.priority,
          conditions: safeJsonParse(r.conditions, {}),
          actions: safeJsonParse(r.actions, []),
          enabled: r.enabled,
        })),
        decisionTables: rs.decisionTables.map((dt) => ({
          name: dt.name,
          description: dt.description,
          columns: safeJsonParse(dt.columns, []),
          rows: safeJsonParse(dt.rows, []),
        })),
      })),
      dataModels: project.dataModels.map((dm) => ({
        name: dm.name,
        schema: safeJsonParse(dm.schema, {}),
      })),
      workflows: project.workflows.map((w) => ({
        name: w.name,
        description: w.description,
        nodes: safeJsonParse(w.nodes, []),
        edges: safeJsonParse(w.edges, []),
        variables: safeJsonParse(w.variables, {}),
        status: w.status,
        version: w.version,
      })),
      adapters: project.adapters.map((a) => ({
        name: a.name,
        type: a.type,
        config: safeJsonParse(a.config, {}),
        authConfig: safeJsonParse(a.authConfig, {}),
        headers: safeJsonParse(a.headers, {}),
        status: a.status,
      })),
    },
  };

  res.json(bundle);
}));

// Export a single rule set as JSON bundle
router.get('/export/rule-set/:id', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const ruleSet = await prisma.ruleSet.findUnique({
    where: { id: req.params.id },
    include: {
      project: { select: { tenantId: true } },
      rules: { orderBy: { priority: 'desc' } },
      decisionTables: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ruleSet) {
    return res.status(404).json({ error: 'Rule set not found' });
  }

  // Verify the rule set's project belongs to the user's tenant
  if (ruleSet.project.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const bundle = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'ruleSet',
    ruleSet: {
      name: ruleSet.name,
      description: ruleSet.description,
      status: ruleSet.status,
      version: ruleSet.version,
      rules: ruleSet.rules.map((r) => ({
        name: r.name,
        description: r.description,
        priority: r.priority,
        conditions: safeJsonParse(r.conditions, {}),
        actions: safeJsonParse(r.actions, []),
        enabled: r.enabled,
      })),
      decisionTables: ruleSet.decisionTables.map((dt) => ({
        name: dt.name,
        description: dt.description,
        columns: safeJsonParse(dt.columns, []),
        rows: safeJsonParse(dt.rows, []),
      })),
    },
  };

  res.json(bundle);
}));

// ============================================================
// Import Routes
// ============================================================

// Import a project bundle JSON
router.post('/import/project', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const bundle = req.body;

  if (!bundle || !bundle.project) {
    return res
      .status(400)
      .json({ error: 'Invalid bundle: missing project data' });
  }

  const projectData = bundle.project;

  const nameError = validateRequired(projectData, ['name']);
  if (nameError) {
    return res.status(400).json({ error: `Invalid project data: ${nameError}` });
  }

  // Create the project with tenantId set from the user's context
  const project = await prisma.project.create({
    data: {
      name: projectData.name,
      description: projectData.description || '',
      tenantId,
    },
  });

  const createdEntities: any = {
    ruleSets: [],
    dataModels: [],
    workflows: [],
    adapters: [],
  };

  // Import data models
  if (projectData.dataModels && Array.isArray(projectData.dataModels)) {
    for (const dm of projectData.dataModels) {
      const dataModel = await prisma.dataModel.create({
        data: {
          projectId: project.id,
          name: dm.name,
          schema: JSON.stringify(dm.schema || {}),
        },
      });
      createdEntities.dataModels.push(dataModel);
    }
  }

  // Import rule sets with rules and decision tables
  if (projectData.ruleSets && Array.isArray(projectData.ruleSets)) {
    for (const rs of projectData.ruleSets) {
      const ruleSet = await prisma.ruleSet.create({
        data: {
          projectId: project.id,
          name: rs.name,
          description: rs.description || '',
          status: 'draft', // Always import as draft
        },
      });

      if (rs.rules && Array.isArray(rs.rules)) {
        for (const rule of rs.rules) {
          await prisma.rule.create({
            data: {
              ruleSetId: ruleSet.id,
              name: rule.name,
              description: rule.description || '',
              priority: rule.priority || 0,
              conditions: JSON.stringify(rule.conditions || {}),
              actions: JSON.stringify(rule.actions || []),
              enabled: rule.enabled !== false,
            },
          });
        }
      }

      if (rs.decisionTables && Array.isArray(rs.decisionTables)) {
        for (const dt of rs.decisionTables) {
          await prisma.decisionTable.create({
            data: {
              ruleSetId: ruleSet.id,
              name: dt.name,
              description: dt.description || '',
              columns: JSON.stringify(dt.columns || []),
              rows: JSON.stringify(dt.rows || []),
            },
          });
        }
      }

      createdEntities.ruleSets.push(ruleSet);
    }
  }

  // Import workflows
  if (projectData.workflows && Array.isArray(projectData.workflows)) {
    for (const w of projectData.workflows) {
      const workflow = await prisma.workflow.create({
        data: {
          projectId: project.id,
          name: w.name,
          description: w.description || '',
          nodes: JSON.stringify(w.nodes || []),
          edges: JSON.stringify(w.edges || []),
          variables: JSON.stringify(w.variables || {}),
          status: 'draft', // Always import as draft
        },
      });
      createdEntities.workflows.push(workflow);
    }
  }

  // Import adapters
  if (projectData.adapters && Array.isArray(projectData.adapters)) {
    for (const a of projectData.adapters) {
      const adapter = await prisma.adapter.create({
        data: {
          projectId: project.id,
          name: a.name,
          type: a.type,
          config: JSON.stringify(a.config || {}),
          authConfig: JSON.stringify(a.authConfig || {}),
          headers: JSON.stringify(a.headers || {}),
          status: 'inactive', // Always import as inactive
        },
      });
      createdEntities.adapters.push(adapter);
    }
  }

  res.status(201).json({
    imported: true,
    project,
    summary: {
      ruleSets: createdEntities.ruleSets.length,
      dataModels: createdEntities.dataModels.length,
      workflows: createdEntities.workflows.length,
      adapters: createdEntities.adapters.length,
    },
  });
}));

// Import a rule set bundle into a project
router.post('/import/rule-set/:projectId', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const { projectId } = req.params;
  const bundle = req.body;

  if (!bundle || !bundle.ruleSet) {
    return res
      .status(400)
      .json({ error: 'Invalid bundle: missing ruleSet data' });
  }

  const rsData = bundle.ruleSet;

  const nameError = validateRequired(rsData, ['name']);
  if (nameError) {
    return res.status(400).json({ error: `Invalid ruleSet data: ${nameError}` });
  }

  // Verify the project exists and belongs to the user's tenant
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (project.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Create the rule set with a new ID
  const ruleSet = await prisma.ruleSet.create({
    data: {
      projectId,
      name: rsData.name,
      description: rsData.description || '',
      status: 'draft', // Always import as draft
    },
  });

  let rulesCreated = 0;
  let tablesCreated = 0;

  // Import rules
  if (rsData.rules && Array.isArray(rsData.rules)) {
    for (const rule of rsData.rules) {
      await prisma.rule.create({
        data: {
          ruleSetId: ruleSet.id,
          name: rule.name,
          description: rule.description || '',
          priority: rule.priority || 0,
          conditions: JSON.stringify(rule.conditions || {}),
          actions: JSON.stringify(rule.actions || []),
          enabled: rule.enabled !== false,
        },
      });
      rulesCreated++;
    }
  }

  // Import decision tables
  if (rsData.decisionTables && Array.isArray(rsData.decisionTables)) {
    for (const dt of rsData.decisionTables) {
      await prisma.decisionTable.create({
        data: {
          ruleSetId: ruleSet.id,
          name: dt.name,
          description: dt.description || '',
          columns: JSON.stringify(dt.columns || []),
          rows: JSON.stringify(dt.rows || []),
        },
      });
      tablesCreated++;
    }
  }

  res.status(201).json({
    imported: true,
    ruleSet,
    summary: {
      rules: rulesCreated,
      decisionTables: tablesCreated,
    },
  });
}));

export default router;
