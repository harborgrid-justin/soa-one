// ============================================================
// SOA One ESB — Schema Validation
// ============================================================
//
// Validates messages against JSON-Schema-like definitions.
// Supports type checking, required fields, min/max constraints,
// patterns, enums, and nested object/array validation.
//
// Beyond Oracle ESB (which uses XML Schema):
// - JSON-native schema validation
// - Nested object and array validation
// - Custom error messages per field
// - Multiple validation strategies (reject, dead-letter, log)
// - Schema versioning
// ============================================================

import type {
  ESBMessage,
  MessageSchema,
  SchemaField,
  ValidationConfig,
  ValidationResult,
  ValidationError,
} from './types';
import { resolvePath } from './channel';

// ── Schema Validator ──────────────────────────────────────────

/**
 * Validates ESB messages against registered schemas.
 * Schemas are matched by message type header.
 */
export class SchemaValidator {
  private _config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this._config = config;
  }

  // ── Schema Management ───────────────────────────────────

  /** Register a schema for a message type. */
  registerSchema(messageType: string, schema: MessageSchema): void {
    this._config.schemas[messageType] = schema;
  }

  /** Unregister a schema for a message type. */
  unregisterSchema(messageType: string): boolean {
    if (messageType in this._config.schemas) {
      delete this._config.schemas[messageType];
      return true;
    }
    return false;
  }

  /** Get a schema by message type. */
  getSchema(messageType: string): MessageSchema | undefined {
    return this._config.schemas[messageType];
  }

  /** Get all registered message types. */
  get registeredTypes(): string[] {
    return Object.keys(this._config.schemas);
  }

  // ── Validation ──────────────────────────────────────────

  /**
   * Validate a message against its registered schema.
   * The schema is selected based on the messageType header.
   */
  validate(message: ESBMessage): ValidationResult {
    const messageType = message.headers.messageType;
    if (!messageType) {
      return { valid: true, errors: [] };
    }

    const schema = this._config.schemas[String(messageType)];
    if (!schema) {
      return { valid: true, errors: [] }; // No schema = no validation
    }

    return this.validateAgainstSchema(message.body, schema);
  }

  /**
   * Validate a data object against a specific schema.
   */
  validateAgainstSchema(
    data: Record<string, any>,
    schema: MessageSchema,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    this._validateFields(data, schema.fields, '', errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if a message should be validated based on direction.
   */
  shouldValidate(direction: 'inbound' | 'outbound'): boolean {
    if (direction === 'inbound') return this._config.validateInbound;
    return this._config.validateOutbound;
  }

  /** Get the failure strategy. */
  get onFailure(): 'reject' | 'dead-letter' | 'log-and-continue' {
    return this._config.onFailure;
  }

  // ── Private: Field Validation ───────────────────────────

  private _validateFields(
    data: any,
    fields: SchemaField[],
    prefix: string,
    errors: ValidationError[],
  ): void {
    for (const field of fields) {
      const fullPath = prefix ? `${prefix}.${field.name}` : field.name;
      const value = resolvePath(data, field.name);

      // Required check
      if (field.required && (value === undefined || value === null)) {
        errors.push({
          field: fullPath,
          message: `Required field "${fullPath}" is missing.`,
          expectedType: field.type,
          actualValue: value,
        });
        continue;
      }

      // Skip validation for optional missing fields
      if (value === undefined || value === null) continue;

      // Type check
      if (!this._checkType(value, field.type)) {
        errors.push({
          field: fullPath,
          message: `Field "${fullPath}" expected type "${field.type}" but got "${typeof value}".`,
          expectedType: field.type,
          actualValue: value,
        });
        continue;
      }

      // Min/Max constraints
      if (field.min !== undefined) {
        if (typeof value === 'number' && value < field.min) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" value ${value} is less than minimum ${field.min}.`,
            actualValue: value,
          });
        }
        if (typeof value === 'string' && value.length < field.min) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" length ${value.length} is less than minimum ${field.min}.`,
            actualValue: value,
          });
        }
        if (Array.isArray(value) && value.length < field.min) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" array length ${value.length} is less than minimum ${field.min}.`,
            actualValue: value,
          });
        }
      }

      if (field.max !== undefined) {
        if (typeof value === 'number' && value > field.max) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" value ${value} exceeds maximum ${field.max}.`,
            actualValue: value,
          });
        }
        if (typeof value === 'string' && value.length > field.max) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" length ${value.length} exceeds maximum ${field.max}.`,
            actualValue: value,
          });
        }
        if (Array.isArray(value) && value.length > field.max) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" array length ${value.length} exceeds maximum ${field.max}.`,
            actualValue: value,
          });
        }
      }

      // Pattern check
      if (field.pattern && typeof value === 'string') {
        try {
          if (!new RegExp(field.pattern).test(value)) {
            errors.push({
              field: fullPath,
              message: `Field "${fullPath}" does not match pattern "${field.pattern}".`,
              actualValue: value,
            });
          }
        } catch {
          // Invalid regex pattern, skip
        }
      }

      // Enum check
      if (field.enumValues && field.enumValues.length > 0) {
        if (!field.enumValues.includes(value)) {
          errors.push({
            field: fullPath,
            message: `Field "${fullPath}" value "${value}" is not in allowed values: ${field.enumValues.join(', ')}.`,
            actualValue: value,
          });
        }
      }

      // Nested object validation
      if (field.children && field.children.length > 0) {
        if (field.type === 'object' && typeof value === 'object') {
          this._validateFields(value, field.children, fullPath, errors);
        }
        if (field.type === 'array' && Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === 'object' && value[i] !== null) {
              this._validateFields(value[i], field.children, `${fullPath}[${i}]`, errors);
            }
          }
        }
      }
    }
  }

  private _checkType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      case 'array':
        return Array.isArray(value);
      case 'date':
        if (typeof value === 'string') {
          return !isNaN(new Date(value).getTime());
        }
        return value instanceof Date;
      case 'any':
        return true;
      default:
        return true;
    }
  }
}
