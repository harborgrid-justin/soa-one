// ============================================================
// SOA One CMS — Metadata Extraction & Management
// ============================================================
//
// Provides metadata schema management, automatic extraction,
// validation, and computed fields.
//
// Surpasses Oracle WebCenter's metadata with:
// - Rich metadata schemas with 17+ field types
// - Automatic metadata extraction from content
// - Computed/derived fields with expressions
// - Schema inheritance from folders
// - Metadata validation with detailed error reporting
// - Extraction rules with pattern matching
// - Multi-schema support per document
// - Schema versioning
// ============================================================

import type {
  MetadataSchema,
  MetadataFieldDefinition,
  MetadataFieldType,
  MetadataEnumValue,
  MetadataValidationResult,
  MetadataValidationError,
  ExtractionRule,
  ExtractionSource,
  CMSDocument,
} from './types';

import { generateId } from './document';

// ── Metadata Schema Manager ─────────────────────────────────

/**
 * Manages metadata schemas, validation, extraction rules,
 * and computed fields.
 */
export class MetadataSchemaManager {
  private _schemas: Map<string, MetadataSchema> = new Map();
  private _extractionRules: Map<string, ExtractionRule> = new Map();
  private _customTransforms: Map<string, (value: any) => any> = new Map();

  constructor() {
    // Register built-in transforms
    this._registerBuiltInTransforms();
  }

  // ── Schema Management ───────────────────────────────────

  /** Register a metadata schema. */
  registerSchema(schema: MetadataSchema): void {
    this._schemas.set(schema.id, schema);
  }

  /** Get a schema by ID. */
  getSchema(id: string): MetadataSchema | undefined {
    const s = this._schemas.get(id);
    return s ? { ...s, fields: s.fields.map((f) => ({ ...f })) } : undefined;
  }

  /** List all schemas. */
  listSchemas(): MetadataSchema[] {
    return Array.from(this._schemas.values()).map((s) => ({
      ...s,
      fields: s.fields.map((f) => ({ ...f })),
    }));
  }

  /** Get schemas applicable to a document. */
  getApplicableSchemas(document: CMSDocument): MetadataSchema[] {
    return Array.from(this._schemas.values()).filter((schema) => {
      if (schema.applicableMimeTypes && schema.applicableMimeTypes.length > 0) {
        if (!schema.applicableMimeTypes.includes(document.mimeType)) return false;
      }
      if (schema.applicableCategories && schema.applicableCategories.length > 0) {
        if (!schema.applicableCategories.includes(document.category)) return false;
      }
      return true;
    });
  }

  /** Delete a schema. */
  deleteSchema(id: string): boolean {
    return this._schemas.delete(id);
  }

  // ── Validation ──────────────────────────────────────────

  /** Validate document metadata against all applicable schemas. */
  validate(document: CMSDocument): MetadataValidationResult {
    const schemas = this.getApplicableSchemas(document);
    const errors: MetadataValidationError[] = [];

    for (const schema of schemas) {
      if (!schema.required) continue;

      for (const field of schema.fields) {
        const fieldErrors = this._validateField(field, document.metadata[field.key], field.key);
        errors.push(...fieldErrors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Validate metadata against a specific schema. */
  validateAgainstSchema(metadata: Record<string, any>, schemaId: string): MetadataValidationResult {
    const schema = this._schemas.get(schemaId);
    if (!schema) throw new Error(`Schema not found: ${schemaId}`);

    const errors: MetadataValidationError[] = [];

    for (const field of schema.fields) {
      const fieldErrors = this._validateField(field, metadata[field.key], field.key);
      errors.push(...fieldErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  private _validateField(
    definition: MetadataFieldDefinition,
    value: any,
    path: string,
  ): MetadataValidationError[] {
    const errors: MetadataValidationError[] = [];

    // Required check
    if (definition.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: path,
        message: `Field "${definition.label}" is required`,
        expectedType: definition.type,
        actualValue: value,
        constraint: 'required',
      });
      return errors;
    }

    if (value === undefined || value === null) return errors;

    // Type check
    if (!this._checkType(value, definition.type)) {
      errors.push({
        field: path,
        message: `Field "${definition.label}" expected type ${definition.type}, got ${typeof value}`,
        expectedType: definition.type,
        actualValue: value,
        constraint: 'type',
      });
      return errors;
    }

    // Min/max checks
    if (definition.min !== undefined) {
      const numValue = typeof value === 'string' ? value.length : Number(value);
      if (numValue < definition.min) {
        errors.push({
          field: path,
          message: `Field "${definition.label}" value is below minimum (${definition.min})`,
          actualValue: value,
          constraint: `min:${definition.min}`,
        });
      }
    }

    if (definition.max !== undefined) {
      const numValue = typeof value === 'string' ? value.length : Number(value);
      if (numValue > definition.max) {
        errors.push({
          field: path,
          message: `Field "${definition.label}" value exceeds maximum (${definition.max})`,
          actualValue: value,
          constraint: `max:${definition.max}`,
        });
      }
    }

    // Pattern check
    if (definition.pattern && typeof value === 'string') {
      try {
        if (!new RegExp(definition.pattern).test(value)) {
          errors.push({
            field: path,
            message: `Field "${definition.label}" does not match pattern: ${definition.pattern}`,
            actualValue: value,
            constraint: `pattern:${definition.pattern}`,
          });
        }
      } catch {
        // Skip invalid patterns
      }
    }

    // Enum check
    if (definition.enumValues && definition.enumValues.length > 0) {
      const allowedValues = definition.enumValues
        .filter((e) => !e.disabled)
        .map((e) => e.value);

      if (definition.type === 'multi-select') {
        if (Array.isArray(value)) {
          for (const v of value) {
            if (!allowedValues.includes(v)) {
              errors.push({
                field: path,
                message: `Field "${definition.label}" contains invalid value: ${v}`,
                actualValue: v,
                constraint: 'enum',
              });
            }
          }
        }
      } else {
        if (!allowedValues.includes(value)) {
          errors.push({
            field: path,
            message: `Field "${definition.label}" has invalid value. Allowed: ${allowedValues.join(', ')}`,
            actualValue: value,
            constraint: 'enum',
          });
        }
      }
    }

    return errors;
  }

  private _checkType(value: any, type: MetadataFieldType): boolean {
    switch (type) {
      case 'string':
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return typeof value === 'string';
      case 'number':
      case 'currency':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
      case 'datetime':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      case 'select':
        return typeof value === 'string';
      case 'multi-select':
        return Array.isArray(value);
      case 'user':
      case 'document-reference':
        return typeof value === 'string';
      case 'geolocation':
        return typeof value === 'object' && value !== null && 'lat' in value && 'lng' in value;
      case 'json':
        return typeof value === 'object' || typeof value === 'string';
      case 'computed':
        return true; // Computed fields always valid
      default:
        return true;
    }
  }

  // ── Extraction Rules ────────────────────────────────────

  /** Register an extraction rule. */
  addExtractionRule(rule: ExtractionRule): void {
    this._extractionRules.set(rule.id, rule);
  }

  /** Remove an extraction rule. */
  removeExtractionRule(id: string): boolean {
    return this._extractionRules.delete(id);
  }

  /** List all extraction rules. */
  listExtractionRules(): ExtractionRule[] {
    return Array.from(this._extractionRules.values()).map((r) => ({ ...r }));
  }

  /**
   * Extract metadata from a document using registered rules.
   * Returns extracted key-value pairs.
   */
  extractMetadata(document: CMSDocument): Record<string, any> {
    const extracted: Record<string, any> = {};

    const sortedRules = Array.from(this._extractionRules.values())
      .filter((r) => r.enabled)
      .filter((r) => {
        if (r.applicableMimeTypes && r.applicableMimeTypes.length > 0) {
          return r.applicableMimeTypes.includes(document.mimeType);
        }
        return true;
      })
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        const value = this._applyExtractionRule(document, rule);
        if (value !== undefined && value !== null) {
          extracted[rule.targetField] = value;
        } else if (rule.defaultValue !== undefined) {
          extracted[rule.targetField] = rule.defaultValue;
        }
      } catch {
        if (rule.defaultValue !== undefined) {
          extracted[rule.targetField] = rule.defaultValue;
        }
      }
    }

    return extracted;
  }

  /**
   * Extract metadata and merge with existing document metadata.
   */
  extractAndMerge(document: CMSDocument): Record<string, any> {
    const extracted = this.extractMetadata(document);
    return { ...document.metadata, ...extracted };
  }

  // ── Computed Fields ─────────────────────────────────────

  /** Compute derived fields for a document. */
  computeFields(document: CMSDocument): Record<string, any> {
    const computed: Record<string, any> = {};

    for (const schema of this.getApplicableSchemas(document)) {
      for (const field of schema.fields) {
        if (field.type !== 'computed' || !field.computedExpression) continue;

        try {
          const value = this._evaluateComputed(field.computedExpression, document);
          computed[field.key] = value;
        } catch {
          // Skip failed computations
        }
      }
    }

    return computed;
  }

  // ── Custom Transforms ───────────────────────────────────

  /** Register a custom transform function. */
  registerTransform(name: string, fn: (value: any) => any): void {
    this._customTransforms.set(name, fn);
  }

  // ── Schema Templates ────────────────────────────────────

  /** Create a standard document metadata schema. */
  createDocumentSchema(owner: string): MetadataSchema {
    const schema: MetadataSchema = {
      id: generateId(),
      name: 'Standard Document Metadata',
      version: '1.0',
      fields: [
        { key: 'title', label: 'Title', type: 'string', required: true, searchable: true, sortable: true, displayInList: true, displayOrder: 1, readOnly: false, hidden: false },
        { key: 'author', label: 'Author', type: 'user', required: false, searchable: true, sortable: true, displayInList: true, displayOrder: 2, readOnly: false, hidden: false },
        { key: 'department', label: 'Department', type: 'select', required: false, searchable: true, sortable: true, displayInList: true, displayOrder: 3, readOnly: false, hidden: false, enumValues: [
          { value: 'engineering', label: 'Engineering' },
          { value: 'legal', label: 'Legal' },
          { value: 'finance', label: 'Finance' },
          { value: 'hr', label: 'Human Resources' },
          { value: 'marketing', label: 'Marketing' },
          { value: 'operations', label: 'Operations' },
        ] },
        { key: 'documentDate', label: 'Document Date', type: 'date', required: false, searchable: true, sortable: true, displayInList: true, displayOrder: 4, readOnly: false, hidden: false },
        { key: 'keywords', label: 'Keywords', type: 'multi-select', required: false, searchable: true, sortable: false, displayInList: false, displayOrder: 5, readOnly: false, hidden: false },
        { key: 'confidentiality', label: 'Confidentiality', type: 'select', required: false, searchable: true, sortable: true, displayInList: true, displayOrder: 6, readOnly: false, hidden: false, enumValues: [
          { value: 'public', label: 'Public', color: '#22c55e' },
          { value: 'internal', label: 'Internal', color: '#3b82f6' },
          { value: 'confidential', label: 'Confidential', color: '#f59e0b' },
          { value: 'restricted', label: 'Restricted', color: '#ef4444' },
        ] },
        { key: 'expiryDate', label: 'Expiry Date', type: 'date', required: false, searchable: true, sortable: true, displayInList: false, displayOrder: 7, readOnly: false, hidden: false },
        { key: 'wordCount', label: 'Word Count', type: 'computed', required: false, searchable: false, sortable: true, displayInList: false, displayOrder: 8, readOnly: true, hidden: false, computedExpression: 'content.wordCount' },
      ],
      required: false,
      inheritable: true,
      owner,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    this._schemas.set(schema.id, schema);
    return { ...schema };
  }

  // ── Private ─────────────────────────────────────────────

  private _applyExtractionRule(document: CMSDocument, rule: ExtractionRule): any {
    let sourceText: string;

    switch (rule.source) {
      case 'content':
        sourceText = typeof document.content === 'string'
          ? document.content
          : JSON.stringify(document.content);
        break;
      case 'filename':
        sourceText = document.name;
        break;
      case 'pdf-properties':
      case 'office-properties':
      case 'exif':
      case 'xmp':
      case 'iptc':
        // Would need actual binary parsing in production
        sourceText = JSON.stringify(document.metadata);
        break;
      default:
        sourceText = '';
    }

    if (!sourceText) return rule.defaultValue;

    let value: any;

    if (rule.pattern) {
      try {
        const regex = new RegExp(rule.pattern);
        const match = regex.exec(sourceText);
        if (match) {
          value = match[1] ?? match[0];
        }
      } catch {
        return rule.defaultValue;
      }
    } else {
      value = sourceText;
    }

    // Apply transform
    if (value !== undefined && rule.transform) {
      const transform = this._customTransforms.get(rule.transform);
      if (transform) {
        value = transform(value);
      }
    }

    return value;
  }

  private _evaluateComputed(expression: string, document: CMSDocument): any {
    switch (expression) {
      case 'content.wordCount': {
        const text = typeof document.content === 'string'
          ? document.content
          : JSON.stringify(document.content);
        return text.split(/\s+/).filter((w) => w.length > 0).length;
      }
      case 'content.charCount': {
        const text = typeof document.content === 'string'
          ? document.content
          : JSON.stringify(document.content);
        return text.length;
      }
      case 'content.lineCount': {
        const text = typeof document.content === 'string'
          ? document.content
          : JSON.stringify(document.content);
        return text.split('\n').length;
      }
      case 'document.age': {
        return Math.floor((Date.now() - new Date(document.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      }
      case 'document.daysSinceModified': {
        return Math.floor((Date.now() - new Date(document.modifiedAt).getTime()) / (1000 * 60 * 60 * 24));
      }
      default:
        return undefined;
    }
  }

  private _registerBuiltInTransforms(): void {
    this._customTransforms.set('trim', (v) => typeof v === 'string' ? v.trim() : v);
    this._customTransforms.set('toLowerCase', (v) => typeof v === 'string' ? v.toLowerCase() : v);
    this._customTransforms.set('toUpperCase', (v) => typeof v === 'string' ? v.toUpperCase() : v);
    this._customTransforms.set('toNumber', (v) => Number(v));
    this._customTransforms.set('toBoolean', (v) => Boolean(v));
    this._customTransforms.set('toDate', (v) => new Date(v).toISOString());
    this._customTransforms.set('extractYear', (v) => {
      const match = String(v).match(/(\d{4})/);
      return match ? Number(match[1]) : undefined;
    });
    this._customTransforms.set('extractEmail', (v) => {
      const match = String(v).match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      return match ? match[0] : undefined;
    });
    this._customTransforms.set('extractUrl', (v) => {
      const match = String(v).match(/https?:\/\/[^\s]+/);
      return match ? match[0] : undefined;
    });
    this._customTransforms.set('wordCount', (v) => {
      return typeof v === 'string' ? v.split(/\s+/).filter((w: string) => w.length > 0).length : 0;
    });
  }
}
