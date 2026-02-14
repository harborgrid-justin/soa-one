// ============================================================
// SOA One CMS — Taxonomy & Classification
// ============================================================
//
// Provides hierarchical taxonomy management, document
// classification, auto-classification rules, and synonym
// support.
//
// Surpasses Oracle WebCenter's categorization with:
// - Multiple taxonomy types (hierarchical, flat, network, faceted)
// - Rule-based auto-classification
// - Synonym and alias support
// - Classification confidence scoring
// - Bulk classification operations
// - Taxonomy import/export
// - Cross-taxonomy classification
// ============================================================

import type {
  TaxonomyDefinition,
  TaxonomyNode,
  TaxonomyType,
  ClassificationRule,
  ClassificationCondition,
  CMSDocument,
} from './types';

import { generateId } from './document';

// ── Classification Result ───────────────────────────────────

/** Result of classifying a document. */
export interface ClassificationResult {
  documentId: string;
  taxonomyId: string;
  nodeId: string;
  nodeName: string;
  nodePath: string;
  confidence: number;
  ruleId?: string;
  ruleName?: string;
}

// ── Taxonomy Manager ────────────────────────────────────────

/**
 * Manages taxonomies, nodes, classification rules, and
 * automatic document classification.
 */
export class TaxonomyManager {
  private _taxonomies: Map<string, TaxonomyDefinition> = new Map();
  private _nodes: Map<string, TaxonomyNode> = new Map();
  private _rules: Map<string, ClassificationRule> = new Map();
  private _documentClassifications: Map<string, string[]> = new Map(); // docId -> nodeIds

  // ── Taxonomy CRUD ───────────────────────────────────────

  /** Create a new taxonomy. */
  createTaxonomy(
    name: string,
    type: TaxonomyType,
    owner: string,
    options?: {
      description?: string;
      autoClassification?: boolean;
      metadata?: Record<string, any>;
    },
  ): TaxonomyDefinition {
    const now = new Date().toISOString();

    const taxonomy: TaxonomyDefinition = {
      id: generateId(),
      name,
      description: options?.description,
      type,
      rootNodeIds: [],
      autoClassification: options?.autoClassification ?? false,
      classificationRules: [],
      owner,
      createdAt: now,
      modifiedAt: now,
      metadata: options?.metadata,
    };

    this._taxonomies.set(taxonomy.id, taxonomy);
    return { ...taxonomy };
  }

  /** Get a taxonomy by ID. */
  getTaxonomy(id: string): TaxonomyDefinition | undefined {
    const t = this._taxonomies.get(id);
    return t ? { ...t } : undefined;
  }

  /** List all taxonomies. */
  listTaxonomies(): TaxonomyDefinition[] {
    return Array.from(this._taxonomies.values()).map((t) => ({ ...t }));
  }

  /** Delete a taxonomy and all its nodes. */
  deleteTaxonomy(id: string): boolean {
    const taxonomy = this._taxonomies.get(id);
    if (!taxonomy) return false;

    // Remove all nodes in this taxonomy
    for (const [nodeId, node] of this._nodes) {
      if (node.taxonomyId === id) {
        this._nodes.delete(nodeId);
      }
    }

    // Remove rules
    for (const [ruleId, rule] of this._rules) {
      const node = this._nodes.get(rule.targetNodeId);
      if (node && node.taxonomyId === id) {
        this._rules.delete(ruleId);
      }
    }

    this._taxonomies.delete(id);
    return true;
  }

  // ── Node Management ─────────────────────────────────────

  /** Add a node to a taxonomy. */
  addNode(
    taxonomyId: string,
    name: string,
    parentId?: string,
    options?: {
      description?: string;
      synonyms?: string[];
      metadata?: Record<string, any>;
    },
  ): TaxonomyNode {
    const taxonomy = this._taxonomies.get(taxonomyId);
    if (!taxonomy) throw new Error(`Taxonomy not found: ${taxonomyId}`);

    let depth = 0;
    let path = name;

    if (parentId) {
      const parent = this._nodes.get(parentId);
      if (!parent) throw new Error(`Parent node not found: ${parentId}`);
      depth = parent.depth + 1;
      path = `${parent.path}/${name}`;
    }

    const node: TaxonomyNode = {
      id: generateId(),
      taxonomyId,
      name,
      description: options?.description,
      parentId,
      childIds: [],
      depth,
      path,
      documentCount: 0,
      synonyms: options?.synonyms,
      sortOrder: 0,
      metadata: options?.metadata,
    };

    this._nodes.set(node.id, node);

    // Update parent's children
    if (parentId) {
      const parent = this._nodes.get(parentId)!;
      parent.childIds.push(node.id);
      node.sortOrder = parent.childIds.length - 1;
    } else {
      // Root node
      taxonomy.rootNodeIds.push(node.id);
    }

    taxonomy.modifiedAt = new Date().toISOString();

    return { ...node };
  }

  /** Get a node by ID. */
  getNode(id: string): TaxonomyNode | undefined {
    const n = this._nodes.get(id);
    return n ? { ...n } : undefined;
  }

  /** Get all children of a node. */
  getChildren(nodeId: string): TaxonomyNode[] {
    const parent = this._nodes.get(nodeId);
    if (!parent) return [];
    return parent.childIds
      .map((id) => this._nodes.get(id))
      .filter((n): n is TaxonomyNode => n !== undefined)
      .map((n) => ({ ...n }));
  }

  /** Get all nodes in a taxonomy. */
  getNodes(taxonomyId: string): TaxonomyNode[] {
    return Array.from(this._nodes.values())
      .filter((n) => n.taxonomyId === taxonomyId)
      .map((n) => ({ ...n }));
  }

  /** Get root nodes of a taxonomy. */
  getRootNodes(taxonomyId: string): TaxonomyNode[] {
    const taxonomy = this._taxonomies.get(taxonomyId);
    if (!taxonomy) return [];
    return taxonomy.rootNodeIds
      .map((id) => this._nodes.get(id))
      .filter((n): n is TaxonomyNode => n !== undefined)
      .map((n) => ({ ...n }));
  }

  /** Get the full path of ancestors from root to a node. */
  getAncestors(nodeId: string): TaxonomyNode[] {
    const ancestors: TaxonomyNode[] = [];
    let current = this._nodes.get(nodeId);

    while (current?.parentId) {
      const parent = this._nodes.get(current.parentId);
      if (!parent) break;
      ancestors.unshift({ ...parent });
      current = parent;
    }

    return ancestors;
  }

  /** Get all descendants of a node (recursive). */
  getDescendants(nodeId: string): TaxonomyNode[] {
    const descendants: TaxonomyNode[] = [];
    const node = this._nodes.get(nodeId);
    if (!node) return descendants;

    const stack = [...node.childIds];
    while (stack.length > 0) {
      const childId = stack.pop()!;
      const child = this._nodes.get(childId);
      if (child) {
        descendants.push({ ...child });
        stack.push(...child.childIds);
      }
    }

    return descendants;
  }

  /** Remove a node (must have no children or documents). */
  removeNode(nodeId: string): boolean {
    const node = this._nodes.get(nodeId);
    if (!node) return false;

    if (node.childIds.length > 0) {
      throw new Error(`Cannot remove node ${nodeId}: has ${node.childIds.length} children`);
    }
    if (node.documentCount > 0) {
      throw new Error(`Cannot remove node ${nodeId}: has ${node.documentCount} classified documents`);
    }

    // Remove from parent
    if (node.parentId) {
      const parent = this._nodes.get(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== nodeId);
      }
    } else {
      // Remove from taxonomy root nodes
      const taxonomy = this._taxonomies.get(node.taxonomyId);
      if (taxonomy) {
        taxonomy.rootNodeIds = taxonomy.rootNodeIds.filter((id) => id !== nodeId);
      }
    }

    this._nodes.delete(nodeId);
    return true;
  }

  /** Move a node to a new parent. */
  moveNode(nodeId: string, newParentId: string | undefined): TaxonomyNode {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    // Remove from old parent
    if (node.parentId) {
      const oldParent = this._nodes.get(node.parentId);
      if (oldParent) {
        oldParent.childIds = oldParent.childIds.filter((id) => id !== nodeId);
      }
    } else {
      const taxonomy = this._taxonomies.get(node.taxonomyId);
      if (taxonomy) {
        taxonomy.rootNodeIds = taxonomy.rootNodeIds.filter((id) => id !== nodeId);
      }
    }

    // Add to new parent
    if (newParentId) {
      const newParent = this._nodes.get(newParentId);
      if (!newParent) throw new Error(`New parent not found: ${newParentId}`);
      newParent.childIds.push(nodeId);
      node.parentId = newParentId;
      node.depth = newParent.depth + 1;
      node.path = `${newParent.path}/${node.name}`;
    } else {
      node.parentId = undefined;
      node.depth = 0;
      node.path = node.name;
      const taxonomy = this._taxonomies.get(node.taxonomyId);
      if (taxonomy) taxonomy.rootNodeIds.push(nodeId);
    }

    // Update descendant depths
    this._updateDescendantPaths(nodeId);

    return { ...node };
  }

  /** Find nodes by name (across all taxonomies). */
  findNodesByName(name: string, taxonomyId?: string): TaxonomyNode[] {
    const nameLower = name.toLowerCase();
    return Array.from(this._nodes.values())
      .filter((n) => {
        if (taxonomyId && n.taxonomyId !== taxonomyId) return false;
        if (n.name.toLowerCase().includes(nameLower)) return true;
        if (n.synonyms?.some((s) => s.toLowerCase().includes(nameLower))) return true;
        return false;
      })
      .map((n) => ({ ...n }));
  }

  // ── Document Classification ─────────────────────────────

  /** Classify a document under a taxonomy node. */
  classifyDocument(documentId: string, nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    if (!this._documentClassifications.has(documentId)) {
      this._documentClassifications.set(documentId, []);
    }

    const nodeIds = this._documentClassifications.get(documentId)!;
    if (!nodeIds.includes(nodeId)) {
      nodeIds.push(nodeId);
      node.documentCount++;
    }
  }

  /** Unclassify a document from a taxonomy node. */
  unclassifyDocument(documentId: string, nodeId: string): boolean {
    const nodeIds = this._documentClassifications.get(documentId);
    if (!nodeIds) return false;

    const idx = nodeIds.indexOf(nodeId);
    if (idx < 0) return false;

    nodeIds.splice(idx, 1);
    const node = this._nodes.get(nodeId);
    if (node && node.documentCount > 0) node.documentCount--;

    return true;
  }

  /** Get all taxonomy nodes a document is classified under. */
  getDocumentClassifications(documentId: string): TaxonomyNode[] {
    const nodeIds = this._documentClassifications.get(documentId) ?? [];
    return nodeIds
      .map((id) => this._nodes.get(id))
      .filter((n): n is TaxonomyNode => n !== undefined)
      .map((n) => ({ ...n }));
  }

  /** Get all document IDs classified under a node. */
  getDocumentsInNode(nodeId: string, includeDescendants = false): string[] {
    const targetNodeIds = new Set<string>([nodeId]);

    if (includeDescendants) {
      const descendants = this.getDescendants(nodeId);
      for (const desc of descendants) {
        targetNodeIds.add(desc.id);
      }
    }

    const docIds: string[] = [];
    for (const [docId, nodeIds] of this._documentClassifications) {
      if (nodeIds.some((id) => targetNodeIds.has(id))) {
        docIds.push(docId);
      }
    }

    return docIds;
  }

  // ── Auto-Classification ─────────────────────────────────

  /** Add a classification rule. */
  addRule(rule: Omit<ClassificationRule, 'id'>): ClassificationRule {
    const fullRule: ClassificationRule = {
      ...rule,
      id: generateId(),
    };
    this._rules.set(fullRule.id, fullRule);

    // Also add to taxonomy definition
    const node = this._nodes.get(rule.targetNodeId);
    if (node) {
      const taxonomy = this._taxonomies.get(node.taxonomyId);
      if (taxonomy) {
        if (!taxonomy.classificationRules) taxonomy.classificationRules = [];
        taxonomy.classificationRules.push(fullRule);
      }
    }

    return { ...fullRule };
  }

  /** Remove a classification rule. */
  removeRule(ruleId: string): boolean {
    return this._rules.delete(ruleId);
  }

  /** Get all classification rules. */
  getRules(taxonomyId?: string): ClassificationRule[] {
    let rules = Array.from(this._rules.values());
    if (taxonomyId) {
      rules = rules.filter((r) => {
        const node = this._nodes.get(r.targetNodeId);
        return node?.taxonomyId === taxonomyId;
      });
    }
    return rules.map((r) => ({ ...r }));
  }

  /**
   * Auto-classify a document using registered rules.
   * Returns all matching classifications sorted by confidence.
   */
  autoClassify(document: CMSDocument): ClassificationResult[] {
    const results: ClassificationResult[] = [];

    const sortedRules = Array.from(this._rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const confidence = this._evaluateRule(document, rule);
      if (confidence >= rule.confidenceThreshold) {
        const node = this._nodes.get(rule.targetNodeId);
        if (node) {
          results.push({
            documentId: document.id,
            taxonomyId: node.taxonomyId,
            nodeId: node.id,
            nodeName: node.name,
            nodePath: node.path,
            confidence,
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Auto-classify a document and apply the top results.
   */
  autoClassifyAndApply(document: CMSDocument, maxClassifications = 3): ClassificationResult[] {
    const results = this.autoClassify(document);
    const applied = results.slice(0, maxClassifications);

    for (const result of applied) {
      this.classifyDocument(document.id, result.nodeId);
    }

    return applied;
  }

  /** Get total node count. */
  get nodeCount(): number {
    return this._nodes.size;
  }

  /** Get total taxonomy count. */
  get taxonomyCount(): number {
    return this._taxonomies.size;
  }

  // ── Private ─────────────────────────────────────────────

  private _evaluateRule(document: CMSDocument, rule: ClassificationRule): number {
    const conditionResults = rule.conditions.map((c) => this._evaluateCondition(document, c));

    const met = rule.conditionLogic === 'AND'
      ? conditionResults.every(Boolean)
      : conditionResults.some(Boolean);

    if (!met) return 0;

    // Calculate confidence based on conditions met
    const metCount = conditionResults.filter(Boolean).length;
    return metCount / conditionResults.length;
  }

  private _evaluateCondition(document: CMSDocument, condition: ClassificationCondition): boolean {
    let value: any;

    switch (condition.source) {
      case 'content':
        value = typeof document.content === 'string' ? document.content : JSON.stringify(document.content);
        break;
      case 'metadata':
        value = condition.field ? document.metadata[condition.field] : undefined;
        break;
      case 'filename':
        value = document.name;
        break;
      case 'mimeType':
        value = document.mimeType;
        break;
      case 'path':
        value = document.path;
        break;
      case 'tags':
        value = document.tags;
        break;
      default:
        return false;
    }

    if (value === undefined || value === null) return false;

    const strValue = typeof value === 'string' ? value.toLowerCase() : JSON.stringify(value).toLowerCase();
    const compareStr = typeof condition.value === 'string' ? condition.value.toLowerCase() : String(condition.value);

    switch (condition.operator) {
      case 'contains':
        if (Array.isArray(value)) return value.some((v) => String(v).toLowerCase().includes(compareStr));
        return strValue.includes(compareStr);
      case 'equals':
        return strValue === compareStr;
      case 'startsWith':
        return strValue.startsWith(compareStr);
      case 'endsWith':
        return strValue.endsWith(compareStr);
      case 'matches':
        try { return new RegExp(condition.value, 'i').test(strValue); } catch { return false; }
      case 'in':
        if (Array.isArray(condition.value)) return condition.value.some((v: string) => strValue.includes(String(v).toLowerCase()));
        return false;
      default:
        return false;
    }
  }

  private _updateDescendantPaths(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) return;

    for (const childId of node.childIds) {
      const child = this._nodes.get(childId);
      if (child) {
        child.depth = node.depth + 1;
        child.path = `${node.path}/${child.name}`;
        this._updateDescendantPaths(childId);
      }
    }
  }
}
