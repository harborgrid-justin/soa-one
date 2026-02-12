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

// List templates, filter by ?category, ?type, ?search. Order by downloads desc.
// Templates are global/public for listing.
router.get('/', asyncHandler(async (req: any, res) => {
  const { category, type, search } = req.query;
  const where: any = {};

  if (category) where.category = String(category);
  if (type) where.type = String(type);
  if (search) {
    where.name = { contains: String(search) };
  }

  const templates = await prisma.template.findMany({
    where,
    orderBy: { downloads: 'desc' },
  });

  const parsed = templates.map((t) => ({
    ...t,
    tags: safeJsonParse(t.tags, []),
    content: safeJsonParse(t.content, {}),
  }));

  res.json(parsed);
}));

// Get a single template (public)
router.get('/:id', asyncHandler(async (req: any, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json({
    ...template,
    tags: safeJsonParse(template.tags, []),
    content: safeJsonParse(template.content, {}),
  });
}));

// Create template
router.post('/', asyncHandler(async (req: any, res) => {
  const userId = requireUserId(req);
  // tenantId is optional for templates
  const tenantId = req.user?.tenantId || null;

  const error = validateRequired(req.body, ['name', 'category', 'content', 'type']);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, category, tags, content, type, author } =
    req.body;

  const template = await prisma.template.create({
    data: {
      name,
      description: description || '',
      category,
      tags: JSON.stringify(tags || []),
      content: JSON.stringify(content),
      type,
      author: author || 'SOA One Team',
    },
  });

  res.status(201).json({
    ...template,
    tags: safeJsonParse(template.tags, []),
    content: safeJsonParse(template.content, {}),
  });
}));

// Update template
router.put('/:id', asyncHandler(async (req: any, res) => {
  requireUserId(req);

  const existing = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const { name, description, category, tags, content, type, author, isOfficial } =
    req.body;
  const data: any = {};

  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category;
  if (tags !== undefined) data.tags = JSON.stringify(tags);
  if (content !== undefined) data.content = JSON.stringify(content);
  if (type !== undefined) data.type = type;
  if (author !== undefined) data.author = author;
  if (isOfficial !== undefined) data.isOfficial = isOfficial;

  const template = await prisma.template.update({
    where: { id: req.params.id },
    data,
  });

  res.json({
    ...template,
    tags: safeJsonParse(template.tags, []),
    content: safeJsonParse(template.content, {}),
  });
}));

// Delete template
router.delete('/:id', asyncHandler(async (req: any, res) => {
  requireUserId(req);

  const existing = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }

  await prisma.template.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Install a template: create a new entity from the template content
// Install must validate tenant context.
router.post('/:id/install', asyncHandler(async (req: any, res) => {
  const tenantId = requireTenantId(req);
  requireUserId(req);

  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const content = safeJsonParse(template.content, {});
  let created: any = null;

  if (template.type === 'project') {
    // Create a full project from template content
    const project = await prisma.project.create({
      data: {
        name: content.name || template.name,
        description: content.description || template.description,
        tenantId,
      },
    });

    // Create nested rule sets if present
    if (content.ruleSets && Array.isArray(content.ruleSets)) {
      for (const rs of content.ruleSets) {
        const ruleSet = await prisma.ruleSet.create({
          data: {
            projectId: project.id,
            name: rs.name,
            description: rs.description || '',
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
      }
    }

    created = project;
  } else if (template.type === 'ruleSet') {
    // Need a project to attach the rule set to
    const { projectId } = req.body;
    if (!projectId) {
      return res
        .status(400)
        .json({ error: 'projectId is required to install a ruleSet template' });
    }

    // Verify the project belongs to the user's tenant
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: project does not belong to your tenant' });
    }

    const ruleSet = await prisma.ruleSet.create({
      data: {
        projectId,
        name: content.name || template.name,
        description: content.description || template.description,
      },
    });

    if (content.rules && Array.isArray(content.rules)) {
      for (const rule of content.rules) {
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

    if (content.decisionTables && Array.isArray(content.decisionTables)) {
      for (const dt of content.decisionTables) {
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

    created = ruleSet;
  } else if (template.type === 'workflow') {
    const { projectId } = req.body;
    if (!projectId) {
      return res
        .status(400)
        .json({ error: 'projectId is required to install a workflow template' });
    }

    // Verify the project belongs to the user's tenant
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: project does not belong to your tenant' });
    }

    const workflow = await prisma.workflow.create({
      data: {
        projectId,
        name: content.name || template.name,
        description: content.description || template.description,
        nodes: JSON.stringify(content.nodes || []),
        edges: JSON.stringify(content.edges || []),
        variables: JSON.stringify(content.variables || {}),
      },
    });

    created = {
      ...workflow,
      nodes: safeJsonParse(workflow.nodes, []),
      edges: safeJsonParse(workflow.edges, []),
      variables: safeJsonParse(workflow.variables, {}),
    };
  }

  // Increment downloads count
  await prisma.template.update({
    where: { id: template.id },
    data: { downloads: { increment: 1 } },
  });

  res.status(201).json({
    installed: true,
    templateId: template.id,
    type: template.type,
    entity: created,
  });
}));

// Rate a template (rolling average)
// Rating can use optional tenantId.
router.post('/:id/rate', asyncHandler(async (req: any, res) => {
  requireUserId(req);

  const { rating } = req.body;

  if (rating === undefined || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ error: 'rating is required and must be between 1 and 5' });
  }

  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  // Calculate new rolling average
  const newCount = template.ratingCount + 1;
  const newRating =
    (template.rating * template.ratingCount + rating) / newCount;

  const updated = await prisma.template.update({
    where: { id: template.id },
    data: {
      rating: Math.round(newRating * 100) / 100, // round to 2 decimal places
      ratingCount: newCount,
    },
  });

  res.json({
    ...updated,
    tags: safeJsonParse(updated.tags, []),
    content: safeJsonParse(updated.content, {}),
  });
}));

export default router;
