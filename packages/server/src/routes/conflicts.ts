import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConflictResult {
  rule1: { id: string; name: string };
  rule2: { id: string; name: string };
  type: 'overlap' | 'shadow' | 'contradiction';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface ParsedCondition {
  field: string;
  operator: string;
  value: any;
}

interface ParsedRule {
  id: string;
  name: string;
  priority: number;
  conditions: ParsedCondition[];
}

// ---------------------------------------------------------------------------
// GET /rule-sets/:ruleSetId/conflicts
//   Analyse all enabled rules for overlapping, shadowing, or contradictory
//   conditions and return an array of conflict descriptors.
// ---------------------------------------------------------------------------
router.get('/rule-sets/:ruleSetId/conflicts', async (req, res) => {
  const { ruleSetId } = req.params;

  try {
    const rules = await prisma.rule.findMany({
      where: { ruleSetId, enabled: true },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      return res.json([]);
    }

    // Parse every rule's condition tree into a flat list of leaf conditions
    const parsed: ParsedRule[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      conditions: flattenConditions(JSON.parse(r.conditions)),
    }));

    const conflicts: ConflictResult[] = [];

    // Compare every unique pair
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const ruleA = parsed[i];
        const ruleB = parsed[j];

        const pairConflicts = detectConflicts(ruleA, ruleB);
        conflicts.push(...pairConflicts);
      }
    }

    res.json(conflicts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Flatten a condition tree into an array of leaf Conditions
// ---------------------------------------------------------------------------
function flattenConditions(node: any): ParsedCondition[] {
  if (!node) return [];

  // Leaf condition (has field + operator)
  if (node.field && node.operator) {
    return [{ field: node.field, operator: node.operator, value: node.value }];
  }

  // Condition group — recurse into children
  if (node.conditions && Array.isArray(node.conditions)) {
    const result: ParsedCondition[] = [];
    for (const child of node.conditions) {
      result.push(...flattenConditions(child));
    }
    return result;
  }

  return [];
}

// ---------------------------------------------------------------------------
// Detect conflicts between two parsed rules
// ---------------------------------------------------------------------------
function detectConflicts(ruleA: ParsedRule, ruleB: ParsedRule): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  const r1 = { id: ruleA.id, name: ruleA.name };
  const r2 = { id: ruleB.id, name: ruleB.name };

  // Identify the higher-priority and lower-priority rule
  const [higher, lower] = ruleA.priority >= ruleB.priority
    ? [ruleA, ruleB]
    : [ruleB, ruleA];

  // Group conditions by field for each rule
  const fieldsA = groupByField(ruleA.conditions);
  const fieldsB = groupByField(ruleB.conditions);

  // Find shared fields
  const sharedFields = [...fieldsA.keys()].filter((f) => fieldsB.has(f));

  if (sharedFields.length === 0) {
    return conflicts;
  }

  // --- Shadow detection ---
  // Lower-priority rule's conditions on shared fields are a subset of
  // the higher-priority rule's conditions (same field + compatible ops).
  const lowerFields = groupByField(lower.conditions);
  const higherFields = groupByField(higher.conditions);
  const lowerSharedFields = [...lowerFields.keys()].filter((f) => higherFields.has(f));

  if (lowerSharedFields.length > 0) {
    const allSubset = lowerSharedFields.every((field) => {
      const lConds = lowerFields.get(field)!;
      const hConds = higherFields.get(field)!;
      return lConds.every((lc) =>
        hConds.some((hc) => isSubsetCondition(lc, hc)),
      );
    });

    // Shadow requires the lower-priority rule's shared conditions to be a
    // subset AND the higher-priority rule to cover at least as many fields.
    if (allSubset && lowerSharedFields.length <= [...higherFields.keys()].length) {
      // Only report shadow if lower rule's condition fields are entirely
      // contained in the higher rule's fields (true shadowing).
      const lowerFieldSet = new Set(lowerFields.keys());
      const higherFieldSet = new Set(higherFields.keys());
      const fullyShadowed = [...lowerFieldSet].every((f) => higherFieldSet.has(f));

      if (fullyShadowed) {
        conflicts.push({
          rule1: { id: higher.id, name: higher.name },
          rule2: { id: lower.id, name: lower.name },
          type: 'shadow',
          description:
            `Rule "${lower.name}" (priority ${lower.priority}) is shadowed by ` +
            `"${higher.name}" (priority ${higher.priority}) — the higher-priority ` +
            `rule's conditions are a superset, so the lower-priority rule may never fire.`,
          severity: 'high',
        });
        return conflicts; // shadow subsumes overlap for this pair
      }
    }
  }

  // --- Contradiction detection ---
  // Same field with mutually exclusive conditions (e.g. equals X vs equals Y,
  // or greaterThan X vs lessThan X where ranges don't overlap) but both rules
  // could potentially fire on different inputs.
  for (const field of sharedFields) {
    const condsA = fieldsA.get(field)!;
    const condsB = fieldsB.get(field)!;

    for (const ca of condsA) {
      for (const cb of condsB) {
        if (areMutuallyExclusive(ca, cb)) {
          conflicts.push({
            rule1: r1,
            rule2: r2,
            type: 'contradiction',
            description:
              `Rules target field "${field}" with contradictory conditions: ` +
              `"${ruleA.name}" uses ${ca.operator}(${formatValue(ca.value)}) ` +
              `while "${ruleB.name}" uses ${cb.operator}(${formatValue(cb.value)}).`,
            severity: 'medium',
          });
        }
      }
    }
  }

  // --- Overlap detection ---
  // Conditions target the same fields with operators whose ranges could
  // match the same input value.
  const hasContradiction = conflicts.some((c) => c.type === 'contradiction');
  if (!hasContradiction) {
    for (const field of sharedFields) {
      const condsA = fieldsA.get(field)!;
      const condsB = fieldsB.get(field)!;

      for (const ca of condsA) {
        for (const cb of condsB) {
          if (rangesOverlap(ca, cb)) {
            conflicts.push({
              rule1: r1,
              rule2: r2,
              type: 'overlap',
              description:
                `Both rules have conditions on field "${field}" that could match ` +
                `the same input: "${ruleA.name}" uses ${ca.operator}(${formatValue(ca.value)}), ` +
                `"${ruleB.name}" uses ${cb.operator}(${formatValue(cb.value)}).`,
              severity: 'low',
            });
          }
        }
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Group an array of conditions by their field name
// ---------------------------------------------------------------------------
function groupByField(conditions: ParsedCondition[]): Map<string, ParsedCondition[]> {
  const map = new Map<string, ParsedCondition[]>();
  for (const c of conditions) {
    const list = map.get(c.field) || [];
    list.push(c);
    map.set(c.field, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Check if condition A is a "subset" of condition B (B covers A)
// Used for shadow detection.
// ---------------------------------------------------------------------------
function isSubsetCondition(a: ParsedCondition, b: ParsedCondition): boolean {
  if (a.field !== b.field) return false;

  // Same operator and same value — identical conditions
  if (a.operator === b.operator && valuesEqual(a.value, b.value)) {
    return true;
  }

  // A's equals value falls within B's range operators
  if (a.operator === 'equals') {
    if (b.operator === 'greaterThan' && Number(a.value) > Number(b.value)) return true;
    if (b.operator === 'greaterThanOrEqual' && Number(a.value) >= Number(b.value)) return true;
    if (b.operator === 'lessThan' && Number(a.value) < Number(b.value)) return true;
    if (b.operator === 'lessThanOrEqual' && Number(a.value) <= Number(b.value)) return true;
    if (b.operator === 'between' && Array.isArray(b.value) && b.value.length === 2) {
      const v = Number(a.value);
      return v >= Number(b.value[0]) && v <= Number(b.value[1]);
    }
    if (b.operator === 'in' && Array.isArray(b.value)) {
      return b.value.includes(a.value);
    }
  }

  // A's between is inside B's between
  if (
    a.operator === 'between' && b.operator === 'between' &&
    Array.isArray(a.value) && Array.isArray(b.value) &&
    a.value.length === 2 && b.value.length === 2
  ) {
    return (
      Number(a.value[0]) >= Number(b.value[0]) &&
      Number(a.value[1]) <= Number(b.value[1])
    );
  }

  // A's "in" values are a subset of B's "in" values
  if (
    a.operator === 'in' && b.operator === 'in' &&
    Array.isArray(a.value) && Array.isArray(b.value)
  ) {
    return a.value.every((v: any) => b.value.includes(v));
  }

  return false;
}

// ---------------------------------------------------------------------------
// Check if two conditions are mutually exclusive (contradiction)
// ---------------------------------------------------------------------------
function areMutuallyExclusive(a: ParsedCondition, b: ParsedCondition): boolean {
  // equals vs equals with different values
  if (a.operator === 'equals' && b.operator === 'equals') {
    return !valuesEqual(a.value, b.value);
  }

  // equals vs notEquals with same value
  if (
    (a.operator === 'equals' && b.operator === 'notEquals' && valuesEqual(a.value, b.value)) ||
    (a.operator === 'notEquals' && b.operator === 'equals' && valuesEqual(a.value, b.value))
  ) {
    return true;
  }

  // greaterThan vs lessThan with non-overlapping ranges
  if (a.operator === 'greaterThan' && b.operator === 'lessThan') {
    return Number(a.value) >= Number(b.value);
  }
  if (a.operator === 'lessThan' && b.operator === 'greaterThan') {
    return Number(b.value) >= Number(a.value);
  }

  // greaterThanOrEqual vs lessThan
  if (a.operator === 'greaterThanOrEqual' && b.operator === 'lessThan') {
    return Number(a.value) >= Number(b.value);
  }
  if (a.operator === 'lessThan' && b.operator === 'greaterThanOrEqual') {
    return Number(b.value) >= Number(a.value);
  }

  // greaterThan vs lessThanOrEqual
  if (a.operator === 'greaterThan' && b.operator === 'lessThanOrEqual') {
    return Number(a.value) >= Number(b.value);
  }
  if (a.operator === 'lessThanOrEqual' && b.operator === 'greaterThan') {
    return Number(b.value) >= Number(a.value);
  }

  // greaterThanOrEqual vs lessThanOrEqual
  if (a.operator === 'greaterThanOrEqual' && b.operator === 'lessThanOrEqual') {
    return Number(a.value) > Number(b.value);
  }
  if (a.operator === 'lessThanOrEqual' && b.operator === 'greaterThanOrEqual') {
    return Number(b.value) > Number(a.value);
  }

  // between ranges that don't overlap
  if (
    a.operator === 'between' && b.operator === 'between' &&
    Array.isArray(a.value) && Array.isArray(b.value) &&
    a.value.length === 2 && b.value.length === 2
  ) {
    return (
      Number(a.value[1]) < Number(b.value[0]) ||
      Number(b.value[1]) < Number(a.value[0])
    );
  }

  // in vs in with no common values
  if (
    a.operator === 'in' && b.operator === 'in' &&
    Array.isArray(a.value) && Array.isArray(b.value)
  ) {
    return !a.value.some((v: any) => b.value.includes(v));
  }

  // isNull vs isNotNull
  if (
    (a.operator === 'isNull' && b.operator === 'isNotNull') ||
    (a.operator === 'isNotNull' && b.operator === 'isNull')
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Check if two conditions have overlapping ranges (could match same input)
// ---------------------------------------------------------------------------
function rangesOverlap(a: ParsedCondition, b: ParsedCondition): boolean {
  // Same operator + same value — clearly overlap
  if (a.operator === b.operator && valuesEqual(a.value, b.value)) {
    return true;
  }

  // equals + equals with same value
  if (a.operator === 'equals' && b.operator === 'equals' && valuesEqual(a.value, b.value)) {
    return true;
  }

  // equals falls within a range operator
  if (a.operator === 'equals' && isValueInRange(a.value, b)) return true;
  if (b.operator === 'equals' && isValueInRange(b.value, a)) return true;

  // Both are range operators on numeric values — check if ranges intersect
  const aRange = toNumericRange(a);
  const bRange = toNumericRange(b);

  if (aRange && bRange) {
    return aRange.min <= bRange.max && bRange.min <= aRange.max;
  }

  // in vs in with common values
  if (
    a.operator === 'in' && b.operator === 'in' &&
    Array.isArray(a.value) && Array.isArray(b.value)
  ) {
    return a.value.some((v: any) => b.value.includes(v));
  }

  // in vs equals
  if (a.operator === 'in' && b.operator === 'equals' && Array.isArray(a.value)) {
    return a.value.includes(b.value);
  }
  if (b.operator === 'in' && a.operator === 'equals' && Array.isArray(b.value)) {
    return b.value.includes(a.value);
  }

  // contains / startsWith / endsWith — if both use the same type on the same
  // field they could plausibly match the same string, so flag as overlap.
  const stringOps = ['contains', 'startsWith', 'endsWith', 'matches'];
  if (stringOps.includes(a.operator) && stringOps.includes(b.operator)) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Check if a specific value satisfies a range condition
// ---------------------------------------------------------------------------
function isValueInRange(value: any, cond: ParsedCondition): boolean {
  const v = Number(value);
  const cv = Number(cond.value);

  switch (cond.operator) {
    case 'greaterThan': return v > cv;
    case 'greaterThanOrEqual': return v >= cv;
    case 'lessThan': return v < cv;
    case 'lessThanOrEqual': return v <= cv;
    case 'between':
      if (Array.isArray(cond.value) && cond.value.length === 2) {
        return v >= Number(cond.value[0]) && v <= Number(cond.value[1]);
      }
      return false;
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(value);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Convert a range operator condition to a {min, max} numeric range
// ---------------------------------------------------------------------------
function toNumericRange(
  cond: ParsedCondition,
): { min: number; max: number } | null {
  const v = Number(cond.value);

  switch (cond.operator) {
    case 'greaterThan':
      return { min: v + 0.0001, max: Number.MAX_SAFE_INTEGER };
    case 'greaterThanOrEqual':
      return { min: v, max: Number.MAX_SAFE_INTEGER };
    case 'lessThan':
      return { min: Number.MIN_SAFE_INTEGER, max: v - 0.0001 };
    case 'lessThanOrEqual':
      return { min: Number.MIN_SAFE_INTEGER, max: v };
    case 'between':
      if (Array.isArray(cond.value) && cond.value.length === 2) {
        return { min: Number(cond.value[0]), max: Number(cond.value[1]) };
      }
      return null;
    case 'equals':
      if (!isNaN(v)) return { min: v, max: v };
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Utility: deep equality for comparing condition values
// ---------------------------------------------------------------------------
function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => valuesEqual(val, b[i]));
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => valuesEqual(a[key], b[key]));
  }

  return false;
}

// ---------------------------------------------------------------------------
// Utility: format a value for human-readable descriptions
// ---------------------------------------------------------------------------
function formatValue(value: any): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (value === null || value === undefined) return 'null';
  return String(value);
}

export default router;
