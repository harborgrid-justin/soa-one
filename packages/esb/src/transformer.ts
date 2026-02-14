// ============================================================
// SOA One ESB — Message Transformer
// ============================================================
//
// Provides a pipeline-based message transformation system
// supporting field mapping, templates, scripts, rename,
// remove, merge, flatten/unflatten, and custom transforms.
//
// Goes beyond Oracle ESB with:
// - Chainable transformation pipelines
// - Field-level transformation functions
// - Bidirectional flatten/unflatten
// - Merge strategies (deep, shallow, overwrite)
// - Template-based transformation with variable substitution
// - Runtime transformer registration
// ============================================================

import type {
  ESBMessage,
  TransformerConfig,
  TransformationPipeline,
  FieldMapping,
} from './types';
import { resolvePath, generateId } from './channel';

// ── Path Setter ───────────────────────────────────────────────

/** Set a value at a dot-notation path, creating intermediate objects. */
export function setPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/** Delete a value at a dot-notation path. */
export function deletePath(obj: any, path: string): boolean {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current === null || current === undefined || !(parts[i] in current)) {
      return false;
    }
    current = current[parts[i]];
  }
  if (current && parts[parts.length - 1] in current) {
    delete current[parts[parts.length - 1]];
    return true;
  }
  return false;
}

// ── Built-in Transform Functions ──────────────────────────────

/** Registry of built-in transform functions for field-level transforms. */
export const builtInTransformFunctions: Record<string, (value: any) => any> = {
  /** Convert to uppercase. */
  toUpperCase: (v: any) => (typeof v === 'string' ? v.toUpperCase() : v),
  /** Convert to lowercase. */
  toLowerCase: (v: any) => (typeof v === 'string' ? v.toLowerCase() : v),
  /** Trim whitespace. */
  trim: (v: any) => (typeof v === 'string' ? v.trim() : v),
  /** Convert to string. */
  toString: (v: any) => String(v),
  /** Convert to number. */
  toNumber: (v) => Number(v),
  /** Convert to boolean. */
  toBoolean: (v) => Boolean(v),
  /** Parse JSON string. */
  parseJSON: (v) => {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  /** Stringify to JSON. */
  toJSON: (v) => JSON.stringify(v),
  /** Convert to ISO date string. */
  toISODate: (v) => new Date(v).toISOString(),
  /** Convert epoch ms to ISO date string. */
  epochToDate: (v) => new Date(Number(v)).toISOString(),
  /** Round number. */
  round: (v) => Math.round(Number(v)),
  /** Floor number. */
  floor: (v) => Math.floor(Number(v)),
  /** Ceil number. */
  ceil: (v) => Math.ceil(Number(v)),
  /** Get array length or string length. */
  length: (v) => {
    if (typeof v === 'string' || Array.isArray(v)) return v.length;
    return 0;
  },
  /** Flatten nested arrays. */
  flattenArray: (v) => (Array.isArray(v) ? v.flat(Infinity) : v),
  /** Get unique array values. */
  unique: (v) => (Array.isArray(v) ? [...new Set(v)] : v),
  /** Sort array. */
  sort: (v) => (Array.isArray(v) ? [...v].sort() : v),
  /** Reverse array or string. */
  reverse: (v) => {
    if (Array.isArray(v)) return [...v].reverse();
    if (typeof v === 'string') return v.split('').reverse().join('');
    return v;
  },
  /** Base64 encode. */
  base64Encode: (v) => {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(String(v)).toString('base64');
    }
    return v;
  },
  /** Base64 decode. */
  base64Decode: (v) => {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(String(v), 'base64').toString('utf-8');
    }
    return v;
  },
};

// ── Message Transformer ───────────────────────────────────────

/**
 * Transforms ESB messages through configurable pipelines.
 * Each transformer step operates on a message and returns
 * a new (or modified) message.
 */
export class MessageTransformer {
  private _customFunctions: Map<string, (value: any) => any> = new Map();
  private _customTransformers: Map<string, (message: ESBMessage, config: Record<string, any>) => ESBMessage> = new Map();

  // ── Custom Registration ─────────────────────────────────

  /** Register a custom field-level transform function. */
  registerFunction(name: string, fn: (value: any) => any): void {
    this._customFunctions.set(name, fn);
  }

  /** Register a custom transformer type. */
  registerTransformer(
    type: string,
    handler: (message: ESBMessage, config: Record<string, any>) => ESBMessage,
  ): void {
    this._customTransformers.set(type, handler);
  }

  // ── Pipeline Execution ──────────────────────────────────

  /**
   * Execute a transformation pipeline on a message.
   * Returns a new message (original is not mutated).
   */
  executePipeline(
    message: ESBMessage,
    pipeline: TransformationPipeline,
  ): ESBMessage {
    let result = this._cloneMessage(message);

    for (const step of pipeline.steps) {
      try {
        result = this.applyTransform(result, step);
      } catch (error: any) {
        if (pipeline.stopOnError) {
          throw new Error(
            `Transformation pipeline "${pipeline.name}" failed at step "${step.name}": ${error.message}`,
          );
        }
        // Continue with the message as-is
      }
    }

    return result;
  }

  /**
   * Apply a single transformation step to a message.
   */
  applyTransform(
    message: ESBMessage,
    step: TransformerConfig,
  ): ESBMessage {
    const msg = this._cloneMessage(message);

    switch (step.type) {
      case 'map':
        return this._applyMapTransform(msg, step.config);
      case 'template':
        return this._applyTemplateTransform(msg, step.config);
      case 'script':
        return this._applyScriptTransform(msg, step.config);
      case 'rename':
        return this._applyRenameTransform(msg, step.config);
      case 'remove':
        return this._applyRemoveTransform(msg, step.config);
      case 'merge':
        return this._applyMergeTransform(msg, step.config);
      case 'flatten':
        return this._applyFlattenTransform(msg, step.config);
      case 'unflatten':
        return this._applyUnflattenTransform(msg, step.config);
      case 'custom': {
        const handler = this._customTransformers.get(step.config.handlerName ?? step.name);
        if (handler) {
          return handler(msg, step.config);
        }
        return msg;
      }
      default:
        return msg;
    }
  }

  // ── Transform Implementations ───────────────────────────

  /**
   * Map transform: map fields from source paths to target paths
   * with optional field-level transform functions.
   */
  private _applyMapTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const mappings: FieldMapping[] = config.mappings ?? [];
    const newBody: Record<string, any> = config.preserveUnmapped
      ? { ...message.body }
      : {};

    for (const mapping of mappings) {
      let value = resolvePath(message.body, mapping.source);

      if (value === undefined && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue;
      }

      if (value !== undefined && mapping.transform) {
        const fn =
          this._customFunctions.get(mapping.transform) ??
          builtInTransformFunctions[mapping.transform];
        if (fn) {
          value = fn(value);
        }
      }

      if (value !== undefined) {
        setPath(newBody, mapping.target, value);
      }
    }

    message.body = newBody;
    return message;
  }

  /**
   * Template transform: construct a new body using a template
   * with `{{field.path}}` variable substitution.
   */
  private _applyTemplateTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const template: Record<string, any> = config.template ?? {};
    const result = this._resolveTemplate(template, message);
    message.body = result;
    return message;
  }

  /**
   * Script transform: run a JavaScript-like expression to
   * transform the message body. Uses a simple evaluator.
   */
  private _applyScriptTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const fieldTransforms: Record<string, string> = config.fieldTransforms ?? {};

    for (const [field, expression] of Object.entries(fieldTransforms)) {
      const value = resolvePath(message.body, field);
      const result = this._evaluateExpression(expression, {
        value,
        body: message.body,
        headers: message.headers,
      });
      setPath(message.body, field, result);
    }

    return message;
  }

  /**
   * Rename transform: rename fields in the message body.
   */
  private _applyRenameTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const renames: Record<string, string> = config.renames ?? {};

    for (const [oldPath, newPath] of Object.entries(renames)) {
      const value = resolvePath(message.body, oldPath);
      if (value !== undefined) {
        setPath(message.body, newPath, value);
        deletePath(message.body, oldPath);
      }
    }

    return message;
  }

  /**
   * Remove transform: remove specified fields from the message body.
   */
  private _applyRemoveTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const fields: string[] = config.fields ?? [];

    for (const field of fields) {
      deletePath(message.body, field);
    }

    return message;
  }

  /**
   * Merge transform: merge additional data into the message body.
   */
  private _applyMergeTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const mergeData: Record<string, any> = config.data ?? {};
    const strategy: string = config.strategy ?? 'shallow';

    switch (strategy) {
      case 'deep':
        message.body = this._deepMerge(message.body, mergeData);
        break;
      case 'overwrite':
        message.body = { ...message.body, ...mergeData };
        break;
      case 'shallow':
      default:
        // Only merge keys that don't exist in the body
        for (const [key, value] of Object.entries(mergeData)) {
          if (!(key in message.body)) {
            message.body[key] = value;
          }
        }
        break;
    }

    return message;
  }

  /**
   * Flatten transform: flatten nested objects to dot-notation keys.
   */
  private _applyFlattenTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const delimiter: string = config.delimiter ?? '.';
    const maxDepth: number = config.maxDepth ?? Infinity;

    message.body = this._flattenObject(message.body, delimiter, maxDepth);
    return message;
  }

  /**
   * Unflatten transform: convert dot-notation keys back to nested objects.
   */
  private _applyUnflattenTransform(
    message: ESBMessage,
    config: Record<string, any>,
  ): ESBMessage {
    const delimiter: string = config.delimiter ?? '.';

    message.body = this._unflattenObject(message.body, delimiter);
    return message;
  }

  // ── Utilities ───────────────────────────────────────────

  /** Clone a message (deep copy of body, shallow copy of structure). */
  private _cloneMessage(message: ESBMessage): ESBMessage {
    return {
      ...message,
      headers: { ...message.headers },
      metadata: { ...message.metadata },
      body: this._deepClone(message.body),
    };
  }

  /** Deep clone a value. */
  private _deepClone(value: any): any {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => this._deepClone(v));
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      result[key] = this._deepClone(value[key]);
    }
    return result;
  }

  /** Deep merge two objects. */
  private _deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return source;

    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (key in result && typeof result[key] === 'object' && typeof source[key] === 'object') {
        result[key] = this._deepMerge(result[key], source[key]);
      } else {
        result[key] = this._deepClone(source[key]);
      }
    }
    return result;
  }

  /** Flatten an object to dot-notation keys. */
  private _flattenObject(
    obj: any,
    delimiter: string,
    maxDepth: number,
    prefix: string = '',
    depth: number = 0,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}${delimiter}${key}` : key;

      if (
        depth < maxDepth &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const nested = this._flattenObject(value, delimiter, maxDepth, newKey, depth + 1);
        Object.assign(result, nested);
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /** Unflatten dot-notation keys back to nested objects. */
  private _unflattenObject(obj: any, delimiter: string): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const parts = key.split(delimiter);
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
    }

    return result;
  }

  /** Resolve template variables `{{path}}` against message data. */
  private _resolveTemplate(template: any, message: ESBMessage): any {
    if (typeof template === 'string') {
      return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
        const trimmed = path.trim();
        if (trimmed.startsWith('headers.')) {
          return String(resolvePath(message.headers, trimmed.substring(8)) ?? '');
        }
        if (trimmed.startsWith('metadata.')) {
          return String(resolvePath(message.metadata, trimmed.substring(9)) ?? '');
        }
        if (trimmed.startsWith('body.')) {
          return String(resolvePath(message.body, trimmed.substring(5)) ?? '');
        }
        return String(resolvePath(message.body, trimmed) ?? '');
      });
    }

    if (Array.isArray(template)) {
      return template.map((item) => this._resolveTemplate(item, message));
    }

    if (typeof template === 'object' && template !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this._resolveTemplate(value, message);
      }
      return result;
    }

    return template;
  }

  /** Evaluate a simple expression with context variables. */
  private _evaluateExpression(
    expression: string,
    context: Record<string, any>,
  ): any {
    // Simple expression evaluator for common transforms
    // Supports: value + n, value - n, value * n, value / n,
    // value.toUpperCase(), value.toLowerCase(), value.trim()
    const trimmed = expression.trim();

    if (trimmed === 'value') return context.value;

    // Arithmetic: value + N, value - N, etc.
    const arithmeticMatch = trimmed.match(/^value\s*([+\-*/])\s*(\d+(?:\.\d+)?)$/);
    if (arithmeticMatch) {
      const op = arithmeticMatch[1];
      const num = parseFloat(arithmeticMatch[2]);
      const val = Number(context.value);
      switch (op) {
        case '+': return val + num;
        case '-': return val - num;
        case '*': return val * num;
        case '/': return num !== 0 ? val / num : val;
      }
    }

    // String methods
    if (trimmed === 'value.toUpperCase()') return String(context.value).toUpperCase();
    if (trimmed === 'value.toLowerCase()') return String(context.value).toLowerCase();
    if (trimmed === 'value.trim()') return String(context.value).trim();
    if (trimmed === 'value.length') {
      const v = context.value;
      return typeof v === 'string' || Array.isArray(v) ? v.length : 0;
    }

    // String concatenation: "prefix" + value + "suffix"
    const concatMatch = trimmed.match(/^"([^"]*?)"\s*\+\s*value\s*\+\s*"([^"]*?)"$/);
    if (concatMatch) {
      return concatMatch[1] + String(context.value) + concatMatch[2];
    }

    // Default: return the value unchanged
    return context.value;
  }
}
