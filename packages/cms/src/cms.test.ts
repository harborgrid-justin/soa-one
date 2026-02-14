// ============================================================
// SOA One CMS — Comprehensive Tests
// ============================================================

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Core
  ContentManagementSystem,
  createDocument,
  generateId,
  hashContent,
  calculateSize,
  detectCategory,
  isValidTransition,

  // Document
  DocumentManager,
  DocumentNotFoundError,
  DocumentLockedError,
  LegalHoldError,
  InvalidTransitionError,

  // Repository
  ContentRepository,
  RepositoryPolicyError,
  QuotaExceededError,

  // Workflow
  WorkflowEngine,

  // Imaging
  OCREngine,
  BarcodeEngine,
  AnnotationManager,
  DocumentComparator,
  WatermarkEngine,
  ImagingPipelineExecutor,

  // Search
  SearchEngine,
  evaluateSearchOperator,

  // Taxonomy
  TaxonomyManager,

  // Retention
  RetentionManager,

  // Collaboration
  CollaborationHub,

  // Security
  AccessControlManager,
  AccessDeniedError,

  // Rendition
  RenditionEngine,

  // Metadata
  MetadataSchemaManager,

  // Plugin
  createCMSPlugin,
} from './index';

import type {
  CMSDocument,
  WorkflowDefinition,
  SearchQuery,
} from './types';

// ── Helpers ────────────────────────────────────────────────

function createTestDoc(overrides: Partial<Parameters<typeof createDocument>[0]> = {}) {
  return createDocument({
    name: 'test-doc.txt',
    content: 'Hello World test content for searching',
    mimeType: 'text/plain',
    owner: 'testuser',
    ...overrides,
  });
}

// ════════════════════════════════════════════════════════════
// DOCUMENT TESTS
// ════════════════════════════════════════════════════════════

describe('createDocument', () => {
  it('creates a document with defaults', () => {
    const doc = createDocument({
      name: 'report.pdf',
      content: 'Annual Report',
      mimeType: 'application/pdf',
    });
    assert.ok(doc.id);
    assert.equal(doc.name, 'report.pdf');
    assert.equal(doc.status, 'draft');
    assert.equal(doc.version, 1);
    assert.equal(doc.category, 'document');
    assert.equal(doc.priority, 'normal');
    assert.ok(doc.createdAt);
    assert.ok(doc.contentHash);
  });

  it('detects content categories', () => {
    assert.equal(detectCategory('image/png'), 'image');
    assert.equal(detectCategory('video/mp4'), 'video');
    assert.equal(detectCategory('audio/mp3'), 'audio');
    assert.equal(detectCategory('application/pdf'), 'document');
    assert.equal(detectCategory('text/csv'), 'spreadsheet');
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId());
    assert.equal(ids.size, 100);
  });
});

describe('hashContent', () => {
  it('produces consistent hashes', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    assert.equal(h1, h2);
  });

  it('produces different hashes for different content', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('world');
    assert.notEqual(h1, h2);
  });
});

describe('isValidTransition', () => {
  it('allows valid transitions', () => {
    assert.ok(isValidTransition('draft', 'pending-review'));
    assert.ok(isValidTransition('pending-review', 'approved'));
    assert.ok(isValidTransition('approved', 'published'));
    assert.ok(isValidTransition('published', 'archived'));
  });

  it('rejects invalid transitions', () => {
    assert.ok(!isValidTransition('deleted', 'published'));
    assert.ok(!isValidTransition('archived', 'pending-review'));
  });
});

describe('DocumentManager', () => {
  let mgr: DocumentManager;

  beforeEach(() => {
    mgr = new DocumentManager();
  });

  it('creates and retrieves documents', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    assert.ok(doc.id);
    const retrieved = mgr.get(doc.id);
    assert.equal(retrieved?.name, 'test.txt');
  });

  it('updates documents', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    const updated = mgr.update(doc.id, { content: 'updated' }, 'user1', 'Updated content');
    assert.equal(updated.version, 2);
    assert.equal(updated.modifiedBy, 'user1');
  });

  it('deletes and restores documents', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    mgr.delete(doc.id, 'user1');
    assert.equal(mgr.get(doc.id), undefined);

    const restored = mgr.restore(doc.id, 'user1');
    assert.ok(restored);
    assert.equal(restored?.status, 'draft');
  });

  it('manages versions', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'v1', mimeType: 'text/plain' });
    mgr.update(doc.id, { content: 'v2' }, 'user1');
    mgr.update(doc.id, { content: 'v3' }, 'user1');

    const versions = mgr.getVersions(doc.id);
    assert.equal(versions.length, 3);
  });

  it('reverts to previous version', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'original', mimeType: 'text/plain' });
    mgr.update(doc.id, { content: 'modified' }, 'user1');
    const reverted = mgr.revertToVersion(doc.id, 1, 'user1');
    assert.equal(reverted.content, 'original');
  });

  it('locks and unlocks documents', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    const locked = mgr.lock(doc.id, 'user1');
    assert.ok(locked.locked);
    assert.equal(locked.lockedBy, 'user1');

    assert.throws(() => mgr.update(doc.id, { content: 'fail' }, 'user2'));

    const unlocked = mgr.unlock(doc.id, 'user1');
    assert.ok(!unlocked.locked);
  });

  it('check-out and check-in', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    const checked = mgr.checkOut(doc.id, 'user1');
    assert.ok(checked.checkedOut);
    assert.equal(checked.status, 'checked-out');

    const checkedIn = mgr.checkIn(doc.id, 'user1', 'updated content', 'Edited');
    assert.ok(!checkedIn.checkedOut);
    assert.equal(checkedIn.status, 'draft');
  });

  it('manages document relationships', () => {
    const doc1 = mgr.create({ name: 'parent.txt', content: 'parent', mimeType: 'text/plain' });
    const doc2 = mgr.create({ name: 'child.txt', content: 'child', mimeType: 'text/plain' });

    const relation = mgr.addRelation(doc1.id, doc2.id, 'parent', 'user1');
    assert.equal(relation.relationType, 'parent');

    const relations = mgr.getRelations(doc1.id);
    assert.equal(relations.length, 1);
  });

  it('manages folders', () => {
    mgr.createFolder('docs', '/', 'user1');
    mgr.createFolder('reports', '/docs', 'user1');

    const folder = mgr.getFolder('/docs');
    assert.ok(folder);
    assert.equal(folder?.name, 'docs');

    const subfolders = mgr.listSubfolders('/docs');
    assert.equal(subfolders.length, 1);
    assert.equal(subfolders[0].name, 'reports');
  });

  it('copies documents', () => {
    const doc = mgr.create({ name: 'original.txt', content: 'hello', mimeType: 'text/plain' });
    const copy = mgr.copy(doc.id, '/archive', 'user1');
    assert.notEqual(copy.id, doc.id);
    assert.equal(copy.path, '/archive');
    assert.equal(copy.content, 'hello');
  });

  it('status transitions', () => {
    const doc = mgr.create({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    mgr.changeStatus(doc.id, 'pending-review', 'user1');
    mgr.changeStatus(doc.id, 'approved', 'user1');
    mgr.changeStatus(doc.id, 'published', 'user1');

    const published = mgr.get(doc.id);
    assert.equal(published?.status, 'published');

    assert.throws(() => mgr.changeStatus(doc.id, 'pending-review', 'user1'), InvalidTransitionError);
  });
});

// ════════════════════════════════════════════════════════════
// REPOSITORY TESTS
// ════════════════════════════════════════════════════════════

describe('ContentRepository', () => {
  it('stores and retrieves documents', () => {
    const repo = new ContentRepository({
      name: 'test', type: 'standard', defaultStorageTier: 'hot',
      versioningEnabled: true, autoHash: true, hashAlgorithm: 'sha256', deduplication: false,
    });

    const doc = repo.store({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    assert.ok(doc.id);

    const retrieved = repo.retrieve(doc.id);
    assert.equal(retrieved?.name, 'test.txt');
  });

  it('enforces MIME type policies', () => {
    const repo = new ContentRepository({
      name: 'test', type: 'standard', defaultStorageTier: 'hot',
      versioningEnabled: true, autoHash: true, hashAlgorithm: 'sha256', deduplication: false,
      allowedMimeTypes: ['text/plain'],
    });

    assert.throws(
      () => repo.store({ name: 'test.exe', content: 'bad', mimeType: 'application/exe' }),
      RepositoryPolicyError,
    );
  });

  it('enforces quota', () => {
    const repo = new ContentRepository({
      name: 'test', type: 'standard', defaultStorageTier: 'hot',
      versioningEnabled: true, autoHash: true, hashAlgorithm: 'sha256', deduplication: false,
      quotaBytes: 50,
    });

    repo.store({ name: 'small.txt', content: 'hi', mimeType: 'text/plain' });
    assert.throws(
      () => repo.store({ name: 'big.txt', content: 'x'.repeat(100), mimeType: 'text/plain' }),
      QuotaExceededError,
    );
  });

  it('manages storage tiers', () => {
    const repo = new ContentRepository({
      name: 'test', type: 'standard', defaultStorageTier: 'hot',
      versioningEnabled: true, autoHash: true, hashAlgorithm: 'sha256', deduplication: false,
    });

    const doc = repo.store({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    assert.equal(repo.getStorageTier(doc.id), 'hot');

    repo.setStorageTier(doc.id, 'cold');
    assert.equal(repo.getStorageTier(doc.id), 'cold');
  });

  it('produces metrics', () => {
    const repo = new ContentRepository({
      name: 'test', type: 'standard', defaultStorageTier: 'hot',
      versioningEnabled: true, autoHash: true, hashAlgorithm: 'sha256', deduplication: false,
    });

    repo.store({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    const metrics = repo.getMetrics();
    assert.equal(metrics.totalDocuments, 1);
    assert.ok(metrics.totalSizeBytes > 0);
  });
});

// ════════════════════════════════════════════════════════════
// WORKFLOW TESTS
// ════════════════════════════════════════════════════════════

describe('WorkflowEngine', () => {
  it('executes a workflow successfully', async () => {
    const engine = new WorkflowEngine();
    const log: string[] = [];

    engine.registerWorkflow(
      {
        id: 'review', name: 'Review', version: '1.0',
        steps: [
          { name: 'prepare', type: 'task', assignee: 'system' },
          { name: 'review', type: 'task', assignee: 'reviewer' },
          { name: 'publish', type: 'task', assignee: 'system' },
        ],
        autoCancelOnDelete: true,
      },
      {
        'prepare': { execute: async () => { log.push('prepare'); return {}; } },
        'review': { execute: async () => { log.push('review'); return { outcome: 'approved' }; } },
        'publish': { execute: async () => { log.push('publish'); return {}; } },
      },
    );

    const instance = await engine.execute('review', 'doc-1', 'alice');
    assert.equal(instance.status, 'completed');
    assert.deepEqual(log, ['prepare', 'review', 'publish']);
  });

  it('handles workflow failure', async () => {
    const engine = new WorkflowEngine();

    engine.registerWorkflow(
      {
        id: 'fail', name: 'Failing', version: '1.0',
        steps: [
          { name: 'step1', type: 'task' },
          { name: 'step2', type: 'task' },
        ],
        autoCancelOnDelete: false,
      },
      {
        'step1': { execute: async () => ({}) },
        'step2': { execute: async () => { throw new Error('failed!'); } },
      },
    );

    const instance = await engine.execute('fail', 'doc-1', 'alice');
    assert.equal(instance.status, 'failed');
    assert.ok(instance.error?.includes('failed'));
  });

  it('cancels a workflow', async () => {
    const engine = new WorkflowEngine();

    engine.registerWorkflow(
      {
        id: 'cancel-test', name: 'Cancel Test', version: '1.0',
        steps: [{ name: 'step1', type: 'human-task', assignee: 'user1' }],
        autoCancelOnDelete: false,
      },
      {},
    );

    const instance = await engine.execute('cancel-test', 'doc-1', 'alice');
    const cancelled = engine.cancel(instance.instanceId, 'alice', 'No longer needed');
    assert.equal(cancelled.status, 'cancelled');
  });
});

// ════════════════════════════════════════════════════════════
// IMAGING TESTS
// ════════════════════════════════════════════════════════════

describe('OCREngine', () => {
  it('performs OCR on text content', () => {
    const ocr = new OCREngine();
    const result = ocr.process('Hello World\nLine 2');
    assert.ok(result.text.includes('Hello World'));
    assert.equal(result.pages.length, 1);
    assert.ok(result.confidence > 0);
  });

  it('tracks processing statistics', () => {
    const ocr = new OCREngine();
    ocr.process('test');
    ocr.process('test2');
    assert.equal(ocr.stats.processedCount, 2);
  });
});

describe('BarcodeEngine', () => {
  it('detects barcodes in text', () => {
    const engine = new BarcodeEngine();
    const results = engine.detect('[QR:https://example.com] and [CODE128:ABC123]');
    assert.equal(results.length, 2);
    assert.equal(results[0].type, 'qr');
    assert.equal(results[1].type, 'code128');
  });

  it('generates barcode representations', () => {
    const engine = new BarcodeEngine();
    const barcode = engine.generate('qr', 'test-value');
    assert.equal(barcode.type, 'qr');
    assert.ok(barcode.representation.includes('test-value'));
  });
});

describe('AnnotationManager', () => {
  it('adds and retrieves annotations', () => {
    const mgr = new AnnotationManager();
    const ann = mgr.addAnnotation('doc-1', 'highlight', { x: 0, y: 0, width: 100, height: 20 }, 'user1', { text: 'Note' });
    assert.ok(ann.id);
    assert.equal(ann.type, 'highlight');

    const annotations = mgr.getAnnotations('doc-1');
    assert.equal(annotations.length, 1);
  });

  it('supports annotation replies', () => {
    const mgr = new AnnotationManager();
    const ann = mgr.addAnnotation('doc-1', 'text-note', { x: 0, y: 0, width: 100, height: 20 }, 'user1');
    const reply = mgr.addReply('doc-1', ann.id, 'Good point!', 'user2');
    assert.ok(reply);
    assert.equal(reply!.text, 'Good point!');
  });

  it('resolves annotations', () => {
    const mgr = new AnnotationManager();
    const ann = mgr.addAnnotation('doc-1', 'text-note', { x: 0, y: 0, width: 100, height: 20 }, 'user1');
    mgr.resolveAnnotation('doc-1', ann.id, 'user2');
    const resolved = mgr.getAnnotation('doc-1', ann.id);
    assert.equal(resolved?.status, 'resolved');
  });
});

describe('DocumentComparator', () => {
  it('compares identical documents', () => {
    const comp = new DocumentComparator();
    const result = comp.compare('hello', 'hello', 'a', 'b');
    assert.equal(result.similarityScore, 1);
    assert.equal(result.differences.length, 0);
  });

  it('detects differences', () => {
    const comp = new DocumentComparator();
    const result = comp.compare('line1\nline2', 'line1\nchanged', 'a', 'b');
    assert.ok(result.similarityScore < 1);
    assert.ok(result.differences.length > 0);
  });
});

describe('ImagingPipelineExecutor', () => {
  it('executes a multi-step pipeline', () => {
    const executor = new ImagingPipelineExecutor();
    const { content, results } = executor.executePipeline('Hello World', {
      name: 'test-pipeline',
      steps: [
        { operation: 'ocr', name: 'extract', config: {} },
        { operation: 'watermark', name: 'mark', config: { text: 'DRAFT', position: 'center', opacity: 0.5 } },
      ],
      stopOnError: true,
    });

    assert.ok(results.extract);
    assert.ok(results.mark);
    assert.ok(String(content).includes('WATERMARK'));
  });
});

// ════════════════════════════════════════════════════════════
// SEARCH TESTS
// ════════════════════════════════════════════════════════════

describe('SearchEngine', () => {
  let search: SearchEngine;

  beforeEach(() => {
    search = new SearchEngine();
    search.indexDocument(createTestDoc({ name: 'Report.pdf', content: 'Annual financial report for Q4' }));
    search.indexDocument(createTestDoc({ name: 'Manual.doc', content: 'User manual for the product' }));
    search.indexDocument(createTestDoc({ name: 'Invoice.pdf', content: 'Invoice for services rendered' }));
  });

  it('full-text search with relevance scoring', () => {
    const results = search.search({ type: 'fulltext', text: 'report' });
    assert.ok(results.totalHits >= 1);
    assert.ok(results.hits[0].score > 0);
  });

  it('metadata filtering', () => {
    const results = search.search({
      type: 'metadata',
      conditions: [{ field: 'name', operator: 'contains', value: 'Manual' }],
    });
    assert.equal(results.totalHits, 1);
    assert.ok(results.hits[0].document.name?.includes('Manual'));
  });

  it('faceted search', () => {
    const results = search.search({
      type: 'fulltext',
      text: '',
      facets: [{ field: 'category', type: 'terms' }],
    });
    assert.ok(results.facets.length > 0);
  });

  it('pagination', () => {
    const page1 = search.search({ type: 'fulltext', text: '', limit: 2, offset: 0 });
    assert.equal(page1.hits.length, 2);
    assert.ok(page1.hasMore);

    const page2 = search.search({ type: 'fulltext', text: '', limit: 2, offset: 2 });
    assert.equal(page2.hits.length, 1);
    assert.ok(!page2.hasMore);
  });

  it('saved searches', () => {
    const saved = search.saveSearch('My Search', { type: 'fulltext', text: 'report' }, 'user1');
    assert.ok(saved.id);

    const results = search.search({ type: 'fulltext', savedSearchId: saved.id });
    assert.ok(results.totalHits >= 1);
  });

  it('highlights matching terms', () => {
    const results = search.search({ type: 'fulltext', text: 'report', highlight: true });
    assert.ok(results.hits.length > 0);
    const hit = results.hits[0];
    assert.ok(hit.highlights);
  });
});

describe('evaluateSearchOperator', () => {
  it('equals', () => {
    assert.ok(evaluateSearchOperator('test', 'equals', 'test'));
    assert.ok(!evaluateSearchOperator('test', 'equals', 'other'));
  });

  it('contains', () => {
    assert.ok(evaluateSearchOperator('hello world', 'contains', 'world'));
    assert.ok(evaluateSearchOperator([1, 2, 3], 'contains', 2));
  });

  it('between', () => {
    assert.ok(evaluateSearchOperator(5, 'between', [1, 10]));
    assert.ok(!evaluateSearchOperator(15, 'between', [1, 10]));
  });

  it('matches (regex)', () => {
    assert.ok(evaluateSearchOperator('order-123', 'matches', 'order-\\d+'));
  });

  it('fuzzy', () => {
    assert.ok(evaluateSearchOperator('hello', 'fuzzy', 'helo'));
  });

  it('wildcard', () => {
    assert.ok(evaluateSearchOperator('test.pdf', 'wildcard', '*.pdf'));
  });
});

// ════════════════════════════════════════════════════════════
// TAXONOMY TESTS
// ════════════════════════════════════════════════════════════

describe('TaxonomyManager', () => {
  it('creates taxonomies and nodes', () => {
    const mgr = new TaxonomyManager();
    const taxonomy = mgr.createTaxonomy('Department', 'hierarchical', 'admin');
    const engineering = mgr.addNode(taxonomy.id, 'Engineering');
    const frontend = mgr.addNode(taxonomy.id, 'Frontend', engineering.id);

    assert.equal(frontend.depth, 1);
    assert.equal(frontend.path, 'Engineering/Frontend');

    const children = mgr.getChildren(engineering.id);
    assert.equal(children.length, 1);
    assert.equal(children[0].name, 'Frontend');
  });

  it('classifies documents', () => {
    const mgr = new TaxonomyManager();
    const taxonomy = mgr.createTaxonomy('Topics', 'hierarchical', 'admin');
    const node = mgr.addNode(taxonomy.id, 'Finance');

    mgr.classifyDocument('doc-1', node.id);

    const classifications = mgr.getDocumentClassifications('doc-1');
    assert.equal(classifications.length, 1);
    assert.equal(classifications[0].name, 'Finance');

    const docs = mgr.getDocumentsInNode(node.id);
    assert.equal(docs.length, 1);
    assert.equal(docs[0], 'doc-1');
  });

  it('auto-classifies documents', () => {
    const mgr = new TaxonomyManager();
    const taxonomy = mgr.createTaxonomy('Type', 'hierarchical', 'admin');
    const invoiceNode = mgr.addNode(taxonomy.id, 'Invoices');

    mgr.addRule({
      name: 'Invoice Classifier',
      targetNodeId: invoiceNode.id,
      conditions: [{ source: 'content', operator: 'contains', value: 'invoice' }],
      conditionLogic: 'AND',
      confidenceThreshold: 0.5,
      priority: 10,
      enabled: true,
    });

    const doc = createTestDoc({ content: 'This is an invoice for $500' });
    const results = mgr.autoClassify(doc);
    assert.ok(results.length > 0);
    assert.equal(results[0].nodeName, 'Invoices');
  });
});

// ════════════════════════════════════════════════════════════
// RETENTION TESTS
// ════════════════════════════════════════════════════════════

describe('RetentionManager', () => {
  it('creates and applies retention policies', () => {
    const mgr = new RetentionManager();
    const policy = mgr.createPolicy({
      name: 'Standard', retentionDays: 365, trigger: 'creation-date',
      dispositionAction: 'archive', notifyBeforeDisposition: true,
      extensionsAllowed: true, enabled: true,
    });

    const doc = createTestDoc();
    const entry = mgr.applyRetention(doc, policy.id);
    assert.equal(entry.policyId, policy.id);
    assert.equal(entry.status, 'active');
  });

  it('manages legal holds', () => {
    const mgr = new RetentionManager();
    const hold = mgr.createLegalHold('Case 123', 'CASE-123', 'legal-dept', ['doc-1', 'doc-2'], 'admin');
    assert.equal(hold.status, 'active');
    assert.ok(mgr.isDocumentUnderHold('doc-1'));

    mgr.releaseLegalHold(hold.id, 'admin', 'Case resolved');
    assert.ok(!mgr.isDocumentUnderHold('doc-1'));
  });

  it('extends retention', () => {
    const mgr = new RetentionManager();
    const policy = mgr.createPolicy({
      name: 'Extendable', retentionDays: 30, trigger: 'creation-date',
      dispositionAction: 'delete', notifyBeforeDisposition: false,
      extensionsAllowed: true, maxExtensionDays: 90, enabled: true,
    });

    const doc = createTestDoc();
    mgr.applyRetention(doc, policy.id);
    const extended = mgr.extendRetention(doc.id, 30);
    assert.equal(extended.extensionCount, 1);
    assert.equal(extended.status, 'extended');
  });
});

// ════════════════════════════════════════════════════════════
// COLLABORATION TESTS
// ════════════════════════════════════════════════════════════

describe('CollaborationHub', () => {
  it('manages comments with threading', () => {
    const hub = new CollaborationHub();
    const comment = hub.addComment('doc-1', 'Great document!', 'user1');
    const reply = hub.addComment('doc-1', 'Thanks!', 'user2', { parentId: comment.id });

    const comments = hub.getTopLevelComments('doc-1');
    assert.equal(comments.length, 1);

    const replies = hub.getReplies('doc-1', comment.id);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].text, 'Thanks!');
  });

  it('detects mentions', () => {
    const hub = new CollaborationHub();
    const comment = hub.addComment('doc-1', 'Hey @alice and @bob, please review', 'user1');
    assert.deepEqual(comment.mentions, ['alice', 'bob']);
  });

  it('manages comment reactions', () => {
    const hub = new CollaborationHub();
    const comment = hub.addComment('doc-1', 'Nice!', 'user1');
    hub.addReaction('doc-1', comment.id, '👍', 'user2');
    hub.addReaction('doc-1', comment.id, '👍', 'user3');

    const comments = hub.getComments('doc-1');
    assert.equal(comments[0].reactions[0].count, 2);
  });

  it('tracks user presence', () => {
    const hub = new CollaborationHub();
    hub.joinDocument('doc-1', 'user1', 'Alice');
    hub.joinDocument('doc-1', 'user2', 'Bob');

    const presence = hub.getPresence('doc-1');
    assert.equal(presence.length, 2);

    hub.leaveDocument('doc-1', 'user1');
    assert.equal(hub.getActiveUserCount('doc-1'), 1);
  });

  it('creates and manages shares', () => {
    const hub = new CollaborationHub();
    const share = hub.createShare('doc-1', 'view', 'user1', { maxAccesses: 5 });
    assert.ok(share.token);
    assert.equal(share.status, 'active');

    const found = hub.getShareByToken(share.token!);
    assert.ok(found);

    hub.revokeShare('doc-1', share.id, 'user1');
    const shares = hub.getShares('doc-1');
    assert.equal(shares.length, 0);
  });
});

// ════════════════════════════════════════════════════════════
// SECURITY TESTS
// ════════════════════════════════════════════════════════════

describe('AccessControlManager', () => {
  it('creates ACLs and checks permissions', () => {
    const mgr = new AccessControlManager();
    const acl = mgr.createACL('doc-acl', 'admin', [
      { principal: 'alice', principalType: 'user', granted: ['read', 'write'], denied: [] },
      { principal: 'bob', principalType: 'user', granted: ['read'], denied: ['write'] },
    ]);

    mgr.assignToDocument('doc-1', acl.id);

    assert.ok(mgr.hasPermission('alice', 'doc-1', 'read'));
    assert.ok(mgr.hasPermission('alice', 'doc-1', 'write'));
    assert.ok(mgr.hasPermission('bob', 'doc-1', 'read'));
    assert.ok(!mgr.hasPermission('bob', 'doc-1', 'write'));
  });

  it('supports role-based access', () => {
    const mgr = new AccessControlManager();
    mgr.setUserRoles('alice', ['admin']);

    const acl = mgr.createACL('role-acl', 'admin', [
      { principal: 'admin', principalType: 'role', granted: ['read', 'write', 'delete', 'admin'], denied: [] },
    ]);

    mgr.assignToDocument('doc-1', acl.id);
    assert.ok(mgr.hasPermission('alice', 'doc-1', 'admin'));
  });

  it('manages security classification', () => {
    const mgr = new AccessControlManager();
    mgr.setClassification('doc-1', 'confidential');
    mgr.setUserRoles('alice', ['clearance:confidential']);
    mgr.setUserRoles('bob', ['clearance:internal']);

    assert.ok(mgr.canAccessClassification('alice', 'doc-1'));
    assert.ok(!mgr.canAccessClassification('bob', 'doc-1'));
  });

  it('records and queries audit trail', () => {
    const mgr = new AccessControlManager();
    mgr.recordAudit({ action: 'document.read', documentId: 'doc-1', actor: 'alice', success: true });
    mgr.recordAudit({ action: 'document.write', documentId: 'doc-1', actor: 'bob', success: true });

    const entries = mgr.queryAudit({ documentId: 'doc-1' });
    assert.equal(entries.length, 2);

    const aliceEntries = mgr.queryAudit({ actor: 'alice' });
    assert.equal(aliceEntries.length, 1);
  });
});

// ════════════════════════════════════════════════════════════
// RENDITION TESTS
// ════════════════════════════════════════════════════════════

describe('RenditionEngine', () => {
  it('generates renditions', () => {
    const engine = new RenditionEngine();
    const doc = createTestDoc();
    const rendition = engine.generate(doc, 'thumbnail', { width: 100, height: 100 });

    assert.equal(rendition.type, 'thumbnail');
    assert.equal(rendition.status, 'completed');
    assert.equal(rendition.width, 100);
    assert.equal(rendition.height, 100);
  });

  it('generates PDF renditions', () => {
    const engine = new RenditionEngine();
    const doc = createTestDoc();
    const rendition = engine.generate(doc, 'pdf');
    assert.equal(rendition.mimeType, 'application/pdf');
    assert.ok(String(rendition.content).includes('%PDF'));
  });

  it('detects stale renditions', () => {
    const engine = new RenditionEngine();
    const doc = createTestDoc();
    const rendition = engine.generate(doc, 'thumbnail');

    assert.ok(!engine.isStale(doc.id, rendition.id, 1));
    assert.ok(engine.isStale(doc.id, rendition.id, 2));
  });

  it('uses rendition profiles', () => {
    const engine = new RenditionEngine();
    engine.registerProfile({
      id: 'thumb-profile', name: 'Thumbnails', type: 'thumbnail',
      targetMimeType: 'image/png', supportedSourceTypes: ['text/plain'],
      config: { width: 200, height: 200 }, autoGenerate: true,
      regenerateOn: 'version-change', priority: 1, enabled: true,
    });

    const doc = createTestDoc();
    const rendition = engine.generateFromProfile(doc, 'thumb-profile');
    assert.equal(rendition.type, 'thumbnail');
  });

  it('auto-generates renditions', () => {
    const engine = new RenditionEngine();
    engine.registerProfile({
      id: 'auto-thumb', name: 'Auto Thumbnails', type: 'thumbnail',
      targetMimeType: 'image/png', supportedSourceTypes: [],
      config: { width: 150, height: 150 }, autoGenerate: true,
      regenerateOn: 'version-change', priority: 1, enabled: true,
    });

    const doc = createTestDoc();
    const renditions = engine.autoGenerate(doc);
    assert.ok(renditions.length >= 1);
  });
});

// ════════════════════════════════════════════════════════════
// METADATA TESTS
// ════════════════════════════════════════════════════════════

describe('MetadataSchemaManager', () => {
  it('validates metadata against schema', () => {
    const mgr = new MetadataSchemaManager();
    mgr.registerSchema({
      id: 's1', name: 'Test', version: '1.0',
      fields: [
        { key: 'title', label: 'Title', type: 'string', required: true, searchable: true, sortable: true, displayInList: true, displayOrder: 1, readOnly: false, hidden: false },
        { key: 'count', label: 'Count', type: 'number', required: false, min: 0, max: 100, searchable: false, sortable: true, displayInList: false, displayOrder: 2, readOnly: false, hidden: false },
      ],
      required: true,
      inheritable: false,
      owner: 'admin',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });

    const valid = mgr.validateAgainstSchema({ title: 'Test', count: 50 }, 's1');
    assert.ok(valid.valid);

    const invalid = mgr.validateAgainstSchema({ count: 200 }, 's1');
    assert.ok(!invalid.valid);
    assert.ok(invalid.errors.length >= 1);
  });

  it('extracts metadata from documents', () => {
    const mgr = new MetadataSchemaManager();
    mgr.addExtractionRule({
      id: 'r1', name: 'Extract Year', source: 'content',
      targetField: 'year', pattern: '(\\d{4})',
      transform: 'extractYear', priority: 1, enabled: true,
    });

    const doc = createTestDoc({ content: 'Report for 2024 fiscal year' });
    const extracted = mgr.extractMetadata(doc);
    assert.equal(extracted.year, 2024);
  });

  it('supports custom transforms', () => {
    const mgr = new MetadataSchemaManager();
    mgr.registerTransform('reverse', (v) => typeof v === 'string' ? v.split('').reverse().join('') : v);

    mgr.addExtractionRule({
      id: 'r1', name: 'Reverse Name', source: 'filename',
      targetField: 'reverseName', transform: 'reverse',
      priority: 1, enabled: true,
    });

    const doc = createTestDoc({ name: 'hello.txt' });
    const extracted = mgr.extractMetadata(doc);
    assert.equal(extracted.reverseName, 'txt.olleh');
  });
});

// ════════════════════════════════════════════════════════════
// CMS INTEGRATION TESTS
// ════════════════════════════════════════════════════════════

describe('ContentManagementSystem', () => {
  let cms: ContentManagementSystem;

  beforeEach(async () => {
    cms = new ContentManagementSystem({
      name: 'test-cms',
      auditEnabled: true,
    });
    await cms.init();
  });

  afterEach(async () => {
    await cms.shutdown();
  });

  it('initializes and shuts down', () => {
    assert.ok(cms.isInitialized);
    assert.ok(!cms.isDestroyed);
  });

  it('stores documents via repository', () => {
    const doc = cms.repository.store({
      name: 'test.txt', content: 'hello world', mimeType: 'text/plain',
    });
    assert.ok(doc.id);
    assert.equal(doc.name, 'test.txt');
  });

  it('ingests documents with full pipeline', async () => {
    const doc = await cms.ingest({
      name: 'report.pdf',
      content: 'Annual financial report for Q4 2024',
      mimeType: 'application/pdf',
      owner: 'alice',
      tags: ['finance', 'annual'],
    });

    assert.ok(doc.id);

    // Should be searchable
    const results = cms.search.search({ type: 'fulltext', text: 'financial' });
    assert.ok(results.totalHits >= 1);
  });

  it('emits CMS events', async () => {
    const events: any[] = [];
    cms.on('document:created', (event) => events.push(event));

    await cms.ingest({
      name: 'event-test.txt',
      content: 'test content',
      mimeType: 'text/plain',
    });

    assert.ok(events.length >= 1);
    assert.equal(events[0].type, 'document:created');
  });

  it('collects metrics', async () => {
    await cms.ingest({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });

    const metrics = cms.getMetrics();
    assert.equal(metrics.totalDocuments, 1);
    assert.ok(metrics.uptimeMs >= 0);
  });

  it('prevents use after destroy', async () => {
    await cms.shutdown();
    assert.ok(cms.isDestroyed);
    await assert.rejects(() => cms.ingest({ name: 'test.txt', content: 'fail', mimeType: 'text/plain' }));
  });

  it('provides access to all subsystems', () => {
    assert.ok(cms.repository);
    assert.ok(cms.workflows);
    assert.ok(cms.imaging);
    assert.ok(cms.search);
    assert.ok(cms.taxonomies);
    assert.ok(cms.retention);
    assert.ok(cms.collaboration);
    assert.ok(cms.security);
    assert.ok(cms.renditions);
    assert.ok(cms.metadata);
    assert.ok(cms.annotations);
  });
});

// ════════════════════════════════════════════════════════════
// ENGINE PLUGIN TESTS
// ════════════════════════════════════════════════════════════

describe('createCMSPlugin', () => {
  it('creates a valid engine plugin', async () => {
    const cms = new ContentManagementSystem({ name: 'plugin-test' });
    await cms.init();

    const plugin = createCMSPlugin(cms);

    assert.equal(plugin.name, 'soa-one-cms');
    assert.equal(plugin.version, '1.0.0');
    assert.ok(plugin.operators);
    assert.ok(plugin.actionHandlers);
    assert.ok(plugin.hooks);
    assert.ok(plugin.functions);
    assert.ok(plugin.onRegister);
    assert.ok(plugin.onDestroy);

    // Test custom operators
    assert.ok(plugin.operators!.documentExists);
    assert.ok(plugin.operators!.documentHasStatus);
    assert.ok(plugin.operators!.documentUnderHold);
    assert.ok(plugin.operators!.contentMatches);
    assert.ok(plugin.operators!.documentHasTag);
    assert.ok(plugin.operators!.documentCategoryIs);
    assert.ok(plugin.operators!.documentSizeExceeds);
    assert.ok(plugin.operators!.hasActiveWorkflow);

    // Test custom actions
    assert.ok(plugin.actionHandlers!.CMS_CREATE);
    assert.ok(plugin.actionHandlers!.CMS_STATUS);
    assert.ok(plugin.actionHandlers!.CMS_RETENTION);
    assert.ok(plugin.actionHandlers!.CMS_CLASSIFY);
    assert.ok(plugin.actionHandlers!.CMS_WORKFLOW);

    // Test custom functions
    assert.ok(plugin.functions!.cms_getDocument);
    assert.ok(plugin.functions!.cms_documentCount);
    assert.ok(plugin.functions!.cms_documentExists);
    assert.ok(plugin.functions!.cms_getMetrics);
    assert.ok(plugin.functions!.cms_search);
    assert.ok(plugin.functions!.cms_generateId);

    // Test operator: documentExists
    const doc = cms.repository.store({ name: 'test.txt', content: 'hello', mimeType: 'text/plain' });
    assert.ok(plugin.operators!.documentExists(doc.id, true));
    assert.ok(!plugin.operators!.documentExists('non-existent', true));

    // Test operator: documentHasStatus
    assert.ok(plugin.operators!.documentHasStatus(doc.id, 'draft'));
    assert.ok(!plugin.operators!.documentHasStatus(doc.id, 'published'));

    // Test operator: contentMatches
    assert.ok(plugin.operators!.contentMatches('hello world', 'hello.*'));
    assert.ok(!plugin.operators!.contentMatches('hello', 'bye.*'));

    // Test function: cms_documentCount
    assert.equal(plugin.functions!.cms_documentCount(), 1);

    // Test function: cms_generateId
    const id = plugin.functions!.cms_generateId();
    assert.ok(id);
    assert.equal(typeof id, 'string');

    // Test hooks
    assert.equal(plugin.hooks!.beforeExecute!.length, 1);
    assert.equal(plugin.hooks!.afterExecute!.length, 1);

    const hookCtx: any = {
      ruleSet: { id: 'rs1', name: 'Test' },
      input: {},
      output: {},
      metadata: {},
    };
    const result = plugin.hooks!.beforeExecute![0](hookCtx);
    assert.ok(result.metadata.cms);
    assert.equal(result.metadata.cms.name, 'plugin-test');

    // Test lifecycle
    plugin.onRegister!();
    plugin.onDestroy!();

    await cms.shutdown();
  });
});

// ════════════════════════════════════════════════════════════
// END-TO-END: Full CMS pipeline
// ════════════════════════════════════════════════════════════

describe('End-to-End: CMS full pipeline', () => {
  it('processes a document through the complete CMS pipeline', async () => {
    const cms = new ContentManagementSystem({
      name: 'e2e-cms',
      auditEnabled: true,
    });
    await cms.init();

    // 1. Create taxonomy
    const taxonomy = cms.taxonomies.createTaxonomy('Department', 'hierarchical', 'admin');
    const financeNode = cms.taxonomies.addNode(taxonomy.id, 'Finance');

    // 2. Add auto-classification rule
    cms.taxonomies.addRule({
      name: 'Finance Classifier',
      targetNodeId: financeNode.id,
      conditions: [{ source: 'content', operator: 'contains', value: 'financial' }],
      conditionLogic: 'AND',
      confidenceThreshold: 0.5,
      priority: 10,
      enabled: true,
    });

    // 3. Create retention policy
    const policy = cms.retention.createPolicy({
      name: 'Standard', retentionDays: 2555, trigger: 'creation-date',
      dispositionAction: 'archive', notifyBeforeDisposition: true,
      extensionsAllowed: true, enabled: true,
    });

    // 4. Set up rendition profile
    cms.renditions.registerProfile({
      id: 'thumb', name: 'Thumbnails', type: 'thumbnail',
      targetMimeType: 'image/png', supportedSourceTypes: [],
      config: { width: 150, height: 150 }, autoGenerate: true,
      regenerateOn: 'version-change', priority: 1, enabled: true,
    });

    // 5. Set default retention
    // (Would need config update; we'll apply manually)

    // 6. Ingest a financial document
    const doc = await cms.ingest({
      name: 'Q4-Report.pdf',
      content: 'Annual financial report for the fourth quarter of 2024. Revenue: $10M. Net income: $2M.',
      mimeType: 'application/pdf',
      owner: 'alice',
      tags: ['finance', 'annual', 'q4'],
    });

    // 7. Apply retention
    cms.retention.applyRetention(doc, policy.id);

    // 8. Verify search
    const searchResults = cms.search.search({ type: 'fulltext', text: 'financial revenue' });
    assert.ok(searchResults.totalHits >= 1);

    // 9. Verify classification
    const classifications = cms.taxonomies.getDocumentClassifications(doc.id);
    assert.ok(classifications.length > 0);
    assert.equal(classifications[0].name, 'Finance');

    // 10. Verify renditions
    const renditions = cms.renditions.getRenditions(doc.id);
    assert.ok(renditions.length >= 1);

    // 11. Add collaboration
    cms.collaboration.addComment(doc.id, 'Looking great! @bob please review', 'alice');
    assert.equal(cms.collaboration.getCommentCount(doc.id), 1);

    // 12. Set security
    const acl = cms.security.createACL('finance-acl', 'admin', [
      { principal: 'finance-team', principalType: 'group', granted: ['read', 'write', 'comment'], denied: [] },
    ]);
    cms.security.assignToDocument(doc.id, acl.id);
    cms.security.setUserGroups('alice', ['finance-team']);
    assert.ok(cms.security.hasPermission('alice', doc.id, 'read'));

    // 13. Run OCR
    const ocrResult = cms.imaging.ocr.process(doc.content);
    assert.ok(ocrResult.text.length > 0);

    // 14. Verify metrics
    const metrics = cms.getMetrics();
    assert.equal(metrics.totalDocuments, 1);
    assert.ok(metrics.uptimeMs >= 0);

    // 15. Verify audit trail
    const audit = cms.security.queryAudit({ documentId: doc.id });
    assert.ok(audit.length >= 1);

    await cms.shutdown();
  });
});
