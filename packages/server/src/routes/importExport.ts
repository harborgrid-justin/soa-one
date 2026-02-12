import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ============================================================
// Export Routes
// ============================================================

// Export a full project as JSON bundle
router.get('/export/project/:id', async (req: any, res) => {
  try {
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
            conditions: JSON.parse(r.conditions),
            actions: JSON.parse(r.actions),
            enabled: r.enabled,
          })),
          decisionTables: rs.decisionTables.map((dt) => ({
            name: dt.name,
            description: dt.description,
            columns: JSON.parse(dt.columns),
            rows: JSON.parse(dt.rows),
          })),
        })),
        dataModels: project.dataModels.map((dm) => ({
          name: dm.name,
          schema: JSON.parse(dm.schema),
        })),
        workflows: project.workflows.map((w) => ({
          name: w.name,
          description: w.description,
          nodes: JSON.parse(w.nodes),
          edges: JSON.parse(w.edges),
          variables: JSON.parse(w.variables),
          status: w.status,
          version: w.version,
        })),
        adapters: project.adapters.map((a) => ({
          name: a.name,
          type: a.type,
          config: JSON.parse(a.config),
          authConfig: JSON.parse(a.authConfig),
          headers: JSON.parse(a.headers),
          status: a.status,
        })),
      },
    };

    res.json(bundle);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export a single rule set as JSON bundle
router.get('/export/rule-set/:id', async (req: any, res) => {
  try {
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: req.params.id },
      include: {
        rules: { orderBy: { priority: 'desc' } },
        decisionTables: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
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
          conditions: JSON.parse(r.conditions),
          actions: JSON.parse(r.actions),
          enabled: r.enabled,
        })),
        decisionTables: ruleSet.decisionTables.map((dt) => ({
          name: dt.name,
          description: dt.description,
          columns: JSON.parse(dt.columns),
          rows: JSON.parse(dt.rows),
        })),
      },
    };

    res.json(bundle);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Import Routes
// ============================================================

// Import a project bundle JSON
router.post('/import/project', async (req: any, res) => {
  try {
    const bundle = req.body;

    if (!bundle || !bundle.project) {
      return res
        .status(400)
        .json({ error: 'Invalid bundle: missing project data' });
    }

    const projectData = bundle.project;

    // Create the project with a new ID
    const project = await prisma.project.create({
      data: {
        name: projectData.name,
        description: projectData.description || '',
        tenantId: req.user?.tenantId || null,
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import a rule set bundle into a project
router.post('/import/rule-set/:projectId', async (req: any, res) => {
  try {
    const { projectId } = req.params;
    const bundle = req.body;

    if (!bundle || !bundle.ruleSet) {
      return res
        .status(400)
        .json({ error: 'Invalid bundle: missing ruleSet data' });
    }

    // Verify the project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const rsData = bundle.ruleSet;

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
