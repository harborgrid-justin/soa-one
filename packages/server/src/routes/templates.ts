import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// List templates, filter by ?category, ?type, ?search. Order by downloads desc.
router.get('/', async (req: any, res) => {
  try {
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
      tags: JSON.parse(t.tags),
      content: JSON.parse(t.content),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single template
router.get('/:id', async (req: any, res) => {
  try {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      ...template,
      tags: JSON.parse(template.tags),
      content: JSON.parse(template.content),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', async (req: any, res) => {
  try {
    const { name, description, category, tags, content, type, author } =
      req.body;

    if (!name || !category || !content) {
      return res
        .status(400)
        .json({ error: 'name, category, and content are required' });
    }

    const template = await prisma.template.create({
      data: {
        name,
        description: description || '',
        category,
        tags: JSON.stringify(tags || []),
        content: JSON.stringify(content),
        type: type || 'ruleSet',
        author: author || 'SOA One Team',
      },
    });

    res.status(201).json({
      ...template,
      tags: JSON.parse(template.tags),
      content: JSON.parse(template.content),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update template
router.put('/:id', async (req: any, res) => {
  try {
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
      tags: JSON.parse(template.tags),
      content: JSON.parse(template.content),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template
router.delete('/:id', async (req: any, res) => {
  try {
    await prisma.template.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Install a template: create a new entity from the template content
router.post('/:id/install', async (req: any, res) => {
  try {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const content = JSON.parse(template.content);
    let created: any = null;

    if (template.type === 'project') {
      // Create a full project from template content
      const project = await prisma.project.create({
        data: {
          name: content.name || template.name,
          description: content.description || template.description,
          tenantId: req.user?.tenantId || null,
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
        nodes: JSON.parse(workflow.nodes),
        edges: JSON.parse(workflow.edges),
        variables: JSON.parse(workflow.variables),
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rate a template (rolling average)
router.post('/:id/rate', async (req: any, res) => {
  try {
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
      tags: JSON.parse(updated.tags),
      content: JSON.parse(updated.content),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
