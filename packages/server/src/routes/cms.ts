import { Router } from 'express';
import { prisma } from '../prisma';
import { type AuthRequest } from '../auth/middleware';
import { createAuditLog } from './audit';

const router = Router();

// ============================================================
// CMS Documents
// ============================================================

router.get('/documents', async (req, res) => {
  const { folderId, status, category, limit } = req.query;
  const where: any = {};
  if (folderId) where.folderId = String(folderId);
  if (status) where.status = String(status);
  if (category) where.category = String(category);

  const documents = await prisma.cMSDocument.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Number(limit) || 50, 200),
  });
  res.json(documents.map((d) => ({
    ...d,
    tags: JSON.parse(d.tags),
    metadata: JSON.parse(d.metadata),
  })));
});

router.get('/documents/:id', async (req, res) => {
  const doc = await prisma.cMSDocument.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { version: 'desc' }, take: 10 }, renditions: true, comments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({
    ...doc,
    tags: JSON.parse(doc.tags),
    metadata: JSON.parse(doc.metadata),
    comments: doc.comments.map((c) => ({ ...c, reactions: JSON.parse(c.reactions) })),
  });
});

router.post('/documents', async (req: AuthRequest, res) => {
  const { name, description, mimeType, content, category, folderId, tags, metadata, securityLevel } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const contentStr = content || '';
  const doc = await prisma.cMSDocument.create({
    data: {
      name,
      description: description || '',
      mimeType: mimeType || 'text/plain',
      content: contentStr,
      contentHash: simpleHash(contentStr),
      sizeBytes: new TextEncoder().encode(contentStr).length,
      category: category || 'document',
      folderId: folderId || null,
      tags: JSON.stringify(tags || []),
      metadata: JSON.stringify(metadata || {}),
      securityLevel: securityLevel || 'internal',
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system',
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'cms-document', entityId: doc.id, entityName: doc.name,
    });
  }

  res.status(201).json({ ...doc, tags: JSON.parse(doc.tags), metadata: JSON.parse(doc.metadata) });
});

router.put('/documents/:id', async (req, res) => {
  const { name, description, mimeType, content, category, status, folderId, tags, metadata, securityLevel } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (mimeType !== undefined) data.mimeType = mimeType;
  if (content !== undefined) {
    data.content = content;
    data.contentHash = simpleHash(content);
    data.sizeBytes = new TextEncoder().encode(content).length;
  }
  if (category !== undefined) data.category = category;
  if (status !== undefined) data.status = status;
  if (folderId !== undefined) data.folderId = folderId;
  if (tags !== undefined) data.tags = JSON.stringify(tags);
  if (metadata !== undefined) data.metadata = JSON.stringify(metadata);
  if (securityLevel !== undefined) data.securityLevel = securityLevel;

  const doc = await prisma.cMSDocument.update({ where: { id: req.params.id }, data });
  res.json({ ...doc, tags: JSON.parse(doc.tags), metadata: JSON.parse(doc.metadata) });
});

router.delete('/documents/:id', async (req, res) => {
  await prisma.cMSDocument.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Document versions
router.get('/documents/:id/versions', async (req, res) => {
  const versions = await prisma.cMSDocumentVersion.findMany({
    where: { documentId: req.params.id },
    orderBy: { version: 'desc' },
  });
  res.json(versions);
});

router.post('/documents/:id/versions', async (req: AuthRequest, res) => {
  const docId = String(req.params.id);
  const doc = await prisma.cMSDocument.findUnique({ where: { id: docId } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const version = await prisma.cMSDocumentVersion.create({
    data: {
      documentId: doc.id,
      version: doc.version + 1,
      content: doc.content,
      contentHash: doc.contentHash,
      sizeBytes: doc.sizeBytes,
      changelog: req.body.changelog || '',
      createdBy: req.user?.id || 'system',
    },
  });

  await prisma.cMSDocument.update({
    where: { id: doc.id },
    data: { version: doc.version + 1 },
  });

  res.status(201).json(version);
});

// ============================================================
// CMS Folders
// ============================================================

router.get('/folders', async (_req, res) => {
  const folders = await prisma.cMSFolder.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { documents: true, children: true } } },
  });
  res.json(folders.map((f) => ({ ...f, metadata: JSON.parse(f.metadata) })));
});

router.get('/folders/:id', async (req, res) => {
  const folder = await prisma.cMSFolder.findUnique({
    where: { id: req.params.id },
    include: { documents: { orderBy: { updatedAt: 'desc' } }, children: true },
  });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  res.json({
    ...folder,
    metadata: JSON.parse(folder.metadata),
    documents: folder.documents.map((d) => ({ ...d, tags: JSON.parse(d.tags), metadata: JSON.parse(d.metadata) })),
  });
});

router.post('/folders', async (req: AuthRequest, res) => {
  const { name, parentId, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const parentPath = parentId
    ? (await prisma.cMSFolder.findUnique({ where: { id: parentId } }))?.path || '/'
    : '/';

  const folder = await prisma.cMSFolder.create({
    data: {
      name,
      parentId: parentId || null,
      path: parentPath === '/' ? `/${name}` : `${parentPath}/${name}`,
      description: description || '',
      createdBy: req.user?.id || 'system',
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'cms-folder', entityId: folder.id, entityName: folder.name,
    });
  }

  res.status(201).json({ ...folder, metadata: JSON.parse(folder.metadata) });
});

router.put('/folders/:id', async (req, res) => {
  const { name, description } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;

  const folder = await prisma.cMSFolder.update({ where: { id: req.params.id }, data });
  res.json({ ...folder, metadata: JSON.parse(folder.metadata) });
});

router.delete('/folders/:id', async (req, res) => {
  await prisma.cMSFolder.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// CMS Workflows
// ============================================================

router.get('/workflows', async (_req, res) => {
  const workflows = await prisma.cMSWorkflow.findMany({
    include: { instances: { take: 5, orderBy: { startedAt: 'desc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(workflows.map((w) => ({
    ...w,
    steps: JSON.parse(w.steps),
    triggers: JSON.parse(w.triggers),
    instances: w.instances.map((i) => ({
      ...i,
      context: JSON.parse(i.context),
      logs: JSON.parse(i.logs),
    })),
  })));
});

router.get('/workflows/:id', async (req, res) => {
  const workflow = await prisma.cMSWorkflow.findUnique({
    where: { id: req.params.id },
    include: { instances: { orderBy: { startedAt: 'desc' } } },
  });
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
  res.json({
    ...workflow,
    steps: JSON.parse(workflow.steps),
    triggers: JSON.parse(workflow.triggers),
    instances: workflow.instances.map((i) => ({
      ...i,
      context: JSON.parse(i.context),
      logs: JSON.parse(i.logs),
    })),
  });
});

router.post('/workflows', async (req: AuthRequest, res) => {
  const { name, description, steps, triggers } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const workflow = await prisma.cMSWorkflow.create({
    data: {
      name,
      description: description || '',
      steps: JSON.stringify(steps || []),
      triggers: JSON.stringify(triggers || []),
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'cms-workflow', entityId: workflow.id, entityName: workflow.name,
    });
  }

  res.status(201).json({ ...workflow, steps: JSON.parse(workflow.steps), triggers: JSON.parse(workflow.triggers) });
});

router.put('/workflows/:id', async (req, res) => {
  const { name, description, steps, triggers, enabled } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (steps !== undefined) data.steps = JSON.stringify(steps);
  if (triggers !== undefined) data.triggers = JSON.stringify(triggers);
  if (enabled !== undefined) data.enabled = enabled;

  const workflow = await prisma.cMSWorkflow.update({ where: { id: req.params.id }, data });
  res.json({ ...workflow, steps: JSON.parse(workflow.steps), triggers: JSON.parse(workflow.triggers) });
});

router.delete('/workflows/:id', async (req, res) => {
  await prisma.cMSWorkflow.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Workflow instances
router.get('/workflows/:id/instances', async (req, res) => {
  const instances = await prisma.cMSWorkflowInstance.findMany({
    where: { workflowId: req.params.id },
    orderBy: { startedAt: 'desc' },
  });
  res.json(instances.map((i) => ({ ...i, context: JSON.parse(i.context), logs: JSON.parse(i.logs) })));
});

// ============================================================
// CMS Taxonomies
// ============================================================

router.get('/taxonomies', async (_req, res) => {
  const taxonomies = await prisma.cMSTaxonomy.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(taxonomies.map((t) => ({
    ...t,
    nodes: JSON.parse(t.nodes),
    rules: JSON.parse(t.rules),
  })));
});

router.get('/taxonomies/:id', async (req, res) => {
  const taxonomy = await prisma.cMSTaxonomy.findUnique({ where: { id: req.params.id } });
  if (!taxonomy) return res.status(404).json({ error: 'Taxonomy not found' });
  res.json({ ...taxonomy, nodes: JSON.parse(taxonomy.nodes), rules: JSON.parse(taxonomy.rules) });
});

router.post('/taxonomies', async (req: AuthRequest, res) => {
  const { name, description, type, nodes, rules } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const taxonomy = await prisma.cMSTaxonomy.create({
    data: {
      name,
      description: description || '',
      type: type || 'hierarchical',
      nodes: JSON.stringify(nodes || []),
      rules: JSON.stringify(rules || []),
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'cms-taxonomy', entityId: taxonomy.id, entityName: taxonomy.name,
    });
  }

  res.status(201).json({ ...taxonomy, nodes: JSON.parse(taxonomy.nodes), rules: JSON.parse(taxonomy.rules) });
});

router.put('/taxonomies/:id', async (req, res) => {
  const { name, description, type, nodes, rules } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (type !== undefined) data.type = type;
  if (nodes !== undefined) data.nodes = JSON.stringify(nodes);
  if (rules !== undefined) data.rules = JSON.stringify(rules);

  const taxonomy = await prisma.cMSTaxonomy.update({ where: { id: req.params.id }, data });
  res.json({ ...taxonomy, nodes: JSON.parse(taxonomy.nodes), rules: JSON.parse(taxonomy.rules) });
});

router.delete('/taxonomies/:id', async (req, res) => {
  await prisma.cMSTaxonomy.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// CMS Retention Policies
// ============================================================

router.get('/retention', async (_req, res) => {
  const policies = await prisma.cMSRetentionPolicy.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(policies.map((p) => ({ ...p, categories: JSON.parse(p.categories) })));
});

router.post('/retention', async (req: AuthRequest, res) => {
  const { name, description, trigger, retentionPeriod, disposition, categories } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const policy = await prisma.cMSRetentionPolicy.create({
    data: {
      name,
      description: description || '',
      trigger: trigger || 'creation',
      retentionPeriod: retentionPeriod || 365,
      disposition: disposition || 'archive',
      categories: JSON.stringify(categories || []),
      tenantId: req.user?.tenantId,
    },
  });

  if (req.user) {
    await createAuditLog({
      tenantId: req.user.tenantId, userId: req.user.id, userName: req.user.name,
      action: 'create', entity: 'cms-retention', entityId: policy.id, entityName: policy.name,
    });
  }

  res.status(201).json({ ...policy, categories: JSON.parse(policy.categories) });
});

router.put('/retention/:id', async (req, res) => {
  const { name, description, trigger, retentionPeriod, disposition, categories, enabled } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (trigger !== undefined) data.trigger = trigger;
  if (retentionPeriod !== undefined) data.retentionPeriod = retentionPeriod;
  if (disposition !== undefined) data.disposition = disposition;
  if (categories !== undefined) data.categories = JSON.stringify(categories);
  if (enabled !== undefined) data.enabled = enabled;

  const policy = await prisma.cMSRetentionPolicy.update({ where: { id: req.params.id }, data });
  res.json({ ...policy, categories: JSON.parse(policy.categories) });
});

router.delete('/retention/:id', async (req, res) => {
  await prisma.cMSRetentionPolicy.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Legal Holds
router.get('/legal-holds', async (_req, res) => {
  const holds = await prisma.cMSLegalHold.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(holds.map((h) => ({ ...h, documentIds: JSON.parse(h.documentIds) })));
});

router.post('/legal-holds', async (req: AuthRequest, res) => {
  const { name, description, reason, documentIds } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const hold = await prisma.cMSLegalHold.create({
    data: {
      name,
      description: description || '',
      reason: reason || '',
      documentIds: JSON.stringify(documentIds || []),
      createdBy: req.user?.id || 'system',
      tenantId: req.user?.tenantId,
    },
  });

  res.status(201).json({ ...hold, documentIds: JSON.parse(hold.documentIds) });
});

router.put('/legal-holds/:id', async (req, res) => {
  const { name, description, reason, documentIds, active } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (reason !== undefined) data.reason = reason;
  if (documentIds !== undefined) data.documentIds = JSON.stringify(documentIds);
  if (active === false) { data.active = false; data.releasedAt = new Date(); }

  const hold = await prisma.cMSLegalHold.update({ where: { id: req.params.id }, data });
  res.json({ ...hold, documentIds: JSON.parse(hold.documentIds) });
});

router.delete('/legal-holds/:id', async (req, res) => {
  await prisma.cMSLegalHold.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// CMS Document Lock / Checkout
// ============================================================

router.post('/documents/:id/lock', async (req: AuthRequest, res) => {
  const doc = await prisma.cMSDocument.findUnique({ where: { id: String(req.params.id) } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.lockedBy) return res.status(409).json({ error: 'Document is already locked', lockedBy: doc.lockedBy });
  const updated = await prisma.cMSDocument.update({
    where: { id: String(req.params.id) },
    data: { lockedBy: req.user?.id || 'system', lockedAt: new Date() },
  });
  res.json({ success: true, lockedBy: updated.lockedBy, lockedAt: updated.lockedAt });
});

router.post('/documents/:id/unlock', async (req: AuthRequest, res) => {
  const doc = await prisma.cMSDocument.findUnique({ where: { id: String(req.params.id) } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.lockedBy) return res.status(409).json({ error: 'Document is not locked' });
  await prisma.cMSDocument.update({
    where: { id: String(req.params.id) },
    data: { lockedBy: null, lockedAt: null },
  });
  res.json({ success: true });
});

router.post('/documents/:id/checkout', async (req: AuthRequest, res) => {
  const doc = await prisma.cMSDocument.findUnique({ where: { id: String(req.params.id) } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.checkedOutBy) return res.status(409).json({ error: 'Document is already checked out', checkedOutBy: doc.checkedOutBy });
  const updated = await prisma.cMSDocument.update({
    where: { id: String(req.params.id) },
    data: {
      checkedOutBy: req.user?.id || 'system',
      checkedOutAt: new Date(),
      lockedBy: req.user?.id || 'system',
      lockedAt: new Date(),
    },
  });
  res.json({ success: true, checkedOutBy: updated.checkedOutBy, checkedOutAt: updated.checkedOutAt });
});

router.post('/documents/:id/checkin', async (req: AuthRequest, res) => {
  const doc = await prisma.cMSDocument.findUnique({ where: { id: String(req.params.id) } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.checkedOutBy) return res.status(409).json({ error: 'Document is not checked out' });
  const { content, changelog } = req.body;

  // Create a new version
  const version = await prisma.cMSDocumentVersion.create({
    data: {
      documentId: doc.id,
      version: doc.version + 1,
      content: content || doc.content,
      contentHash: content ? simpleHash(content) : doc.contentHash,
      sizeBytes: content ? new TextEncoder().encode(content).length : doc.sizeBytes,
      changelog: changelog || 'Checked in',
      createdBy: req.user?.id || 'system',
    },
  });

  // Update the document
  const data: any = {
    checkedOutBy: null,
    checkedOutAt: null,
    lockedBy: null,
    lockedAt: null,
    version: doc.version + 1,
    updatedBy: req.user?.id || 'system',
  };
  if (content) {
    data.content = content;
    data.contentHash = simpleHash(content);
    data.sizeBytes = new TextEncoder().encode(content).length;
  }
  await prisma.cMSDocument.update({ where: { id: doc.id }, data });

  res.json({ success: true, version: version.version });
});

// Change document status (e.g. draft → published)
router.put('/documents/:id/status', async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const doc = await prisma.cMSDocument.findUnique({ where: { id: String(req.params.id) } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const updated = await prisma.cMSDocument.update({
    where: { id: doc.id },
    data: { status, updatedBy: req.user?.id || 'system' },
  });
  res.json(updated);
});

// ============================================================
// CMS Comments
// ============================================================

router.get('/documents/:id/comments', async (req, res) => {
  const comments = await prisma.cMSComment.findMany({
    where: { documentId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(comments.map((c) => ({ ...c, reactions: JSON.parse(c.reactions) })));
});

router.post('/documents/:id/comments', async (req: AuthRequest, res) => {
  const { content, parentId } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const comment = await prisma.cMSComment.create({
    data: {
      documentId: String(req.params.id),
      content,
      parentId: parentId || null,
      authorId: req.user?.id || 'anonymous',
      authorName: req.user?.name || 'Anonymous',
    },
  });

  res.status(201).json({ ...comment, reactions: JSON.parse(comment.reactions) });
});

router.put('/comments/:id', async (req, res) => {
  const { content, resolved } = req.body;
  const data: any = {};
  if (content !== undefined) data.content = content;
  if (resolved !== undefined) data.resolved = resolved;

  const comment = await prisma.cMSComment.update({ where: { id: req.params.id }, data });
  res.json({ ...comment, reactions: JSON.parse(comment.reactions) });
});

router.delete('/comments/:id', async (req, res) => {
  await prisma.cMSComment.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// CMS Metadata Schemas
// ============================================================

router.get('/metadata-schemas', async (_req, res) => {
  const schemas = await prisma.cMSMetadataSchema.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(schemas.map((s) => ({ ...s, fields: JSON.parse(s.fields), categories: JSON.parse(s.categories) })));
});

router.post('/metadata-schemas', async (req: AuthRequest, res) => {
  const { name, description, fields, categories } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const schema = await prisma.cMSMetadataSchema.create({
    data: {
      name,
      description: description || '',
      fields: JSON.stringify(fields || []),
      categories: JSON.stringify(categories || []),
      tenantId: req.user?.tenantId,
    },
  });

  res.status(201).json({ ...schema, fields: JSON.parse(schema.fields), categories: JSON.parse(schema.categories) });
});

router.put('/metadata-schemas/:id', async (req, res) => {
  const { name, description, fields, categories } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (fields !== undefined) data.fields = JSON.stringify(fields);
  if (categories !== undefined) data.categories = JSON.stringify(categories);

  const schema = await prisma.cMSMetadataSchema.update({ where: { id: req.params.id }, data });
  res.json({ ...schema, fields: JSON.parse(schema.fields), categories: JSON.parse(schema.categories) });
});

router.delete('/metadata-schemas/:id', async (req, res) => {
  await prisma.cMSMetadataSchema.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// CMS Renditions
// ============================================================

router.get('/documents/:id/renditions', async (req, res) => {
  const renditions = await prisma.cMSRendition.findMany({
    where: { documentId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(renditions.map((r) => ({ ...r, metadata: JSON.parse(r.metadata) })));
});

router.post('/documents/:id/renditions', async (req, res) => {
  const { type, mimeType, content } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });

  const rendition = await prisma.cMSRendition.create({
    data: {
      documentId: req.params.id,
      type,
      mimeType: mimeType || 'application/octet-stream',
      content: content || '',
      sizeBytes: new TextEncoder().encode(content || '').length,
    },
  });

  res.status(201).json({ ...rendition, metadata: JSON.parse(rendition.metadata) });
});

router.delete('/renditions/:id', async (req, res) => {
  await prisma.cMSRendition.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============================================================
// CMS Audit Trail
// ============================================================

router.get('/audit', async (req, res) => {
  const { documentId, action, entity, limit } = req.query;
  const where: any = {};
  if (documentId) where.documentId = String(documentId);
  if (action) where.action = String(action);
  if (entity) where.entity = String(entity);

  const entries = await prisma.cMSAuditEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 50, 200),
  });
  res.json(entries.map((e) => ({ ...e, details: JSON.parse(e.details) })));
});

// ============================================================
// CMS Metrics / Dashboard
// ============================================================

router.get('/metrics', async (_req, res) => {
  const [documents, folders, workflows, activeWorkflows, taxonomies, retentionPolicies, legalHolds, comments, renditions, schemas] = await Promise.all([
    prisma.cMSDocument.count(),
    prisma.cMSFolder.count(),
    prisma.cMSWorkflow.count(),
    prisma.cMSWorkflowInstance.count({ where: { status: 'running' } }),
    prisma.cMSTaxonomy.count(),
    prisma.cMSRetentionPolicy.count(),
    prisma.cMSLegalHold.count({ where: { active: true } }),
    prisma.cMSComment.count(),
    prisma.cMSRendition.count(),
    prisma.cMSMetadataSchema.count(),
  ]);

  const recentDocuments = await prisma.cMSDocument.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { id: true, name: true, category: true, status: true, mimeType: true, sizeBytes: true, updatedAt: true, createdBy: true },
  });

  const statusBreakdown = await prisma.cMSDocument.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const categoryBreakdown = await prisma.cMSDocument.groupBy({
    by: ['category'],
    _count: { id: true },
  });

  res.json({
    summary: {
      totalDocuments: documents,
      totalFolders: folders,
      totalWorkflows: workflows,
      activeWorkflows,
      totalTaxonomies: taxonomies,
      retentionPolicies,
      activeLegalHolds: legalHolds,
      totalComments: comments,
      totalRenditions: renditions,
      metadataSchemas: schemas,
    },
    recentDocuments,
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count.id })),
    categoryBreakdown: categoryBreakdown.map((c) => ({ category: c.category, count: c._count.id })),
  });
});

// ============================================================
// Search (server-side full-text filtering)
// ============================================================

router.get('/search', async (req, res) => {
  const { q, category, status, securityLevel, folderId, limit } = req.query;
  const where: any = {};

  if (q) {
    const query = String(q);
    where.OR = [
      { name: { contains: query } },
      { description: { contains: query } },
      { content: { contains: query } },
    ];
  }
  if (category) where.category = String(category);
  if (status) where.status = String(status);
  if (securityLevel) where.securityLevel = String(securityLevel);
  if (folderId) where.folderId = String(folderId);

  const results = await prisma.cMSDocument.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Number(limit) || 25, 100),
    select: {
      id: true, name: true, description: true, category: true, status: true,
      mimeType: true, sizeBytes: true, securityLevel: true, tags: true,
      createdBy: true, updatedAt: true,
    },
  });

  res.json({
    query: q || '',
    total: results.length,
    results: results.map((r) => ({ ...r, tags: JSON.parse(r.tags) })),
  });
});

// ============================================================
// Helpers
// ============================================================

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export default router;
