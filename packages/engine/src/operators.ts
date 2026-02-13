import { ComparisonOperator } from './types';

/** Resolve a dot-notation path against an object */
export function resolvePath(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/** Set a value at a dot-notation path on an object (mutates) */
export function setPath(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split('.');
  let current: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/** Evaluate a single comparison operator */
export function evaluateOperator(
  fieldValue: any,
  operator: ComparisonOperator,
  compareValue: any,
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === compareValue;

    case 'notEquals':
      return fieldValue !== compareValue;

    case 'greaterThan':
      return Number(fieldValue) > Number(compareValue);

    case 'greaterThanOrEqual':
      return Number(fieldValue) >= Number(compareValue);

    case 'lessThan':
      return Number(fieldValue) < Number(compareValue);

    case 'lessThanOrEqual':
      return Number(fieldValue) <= Number(compareValue);

    case 'contains':
      if (typeof fieldValue === 'string') {
        return fieldValue.includes(String(compareValue));
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue);
      }
      return false;

    case 'notContains':
      if (typeof fieldValue === 'string') {
        return !fieldValue.includes(String(compareValue));
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(compareValue);
      }
      return true;

    case 'startsWith':
      return typeof fieldValue === 'string' && fieldValue.startsWith(String(compareValue));

    case 'endsWith':
      return typeof fieldValue === 'string' && fieldValue.endsWith(String(compareValue));

    case 'in':
      return Array.isArray(compareValue) && compareValue.includes(fieldValue);

    case 'notIn':
      return Array.isArray(compareValue) && !compareValue.includes(fieldValue);

    case 'between':
      if (Array.isArray(compareValue) && compareValue.length === 2) {
        const num = Number(fieldValue);
        return num >= Number(compareValue[0]) && num <= Number(compareValue[1]);
      }
      return false;

    case 'isNull':
      return fieldValue == null;

    case 'isNotNull':
      return fieldValue != null;

    case 'matches':
      try {
        const regex = new RegExp(String(compareValue));
        return regex.test(String(fieldValue));
      } catch {
        return false;
      }

    default:
      return false;
  }
}
