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

// ---------------------------------------------------------------------------
// NLP Pattern Definitions
// ---------------------------------------------------------------------------

interface ParsedCondition {
  field: string;
  operator: string;
  value: any;
}

interface ParsedAction {
  type: string;
  target?: string;
  value?: any;
}

// Operator patterns: match natural language to condition operators
const OPERATOR_PATTERNS: { pattern: RegExp; operator: string }[] = [
  { pattern: /(.+?)\s+is\s+greater\s+than\s+(.+)/i, operator: 'greaterThan' },
  { pattern: /(.+?)\s+is\s+more\s+than\s+(.+)/i, operator: 'greaterThan' },
  { pattern: /(.+?)\s+exceeds?\s+(.+)/i, operator: 'greaterThan' },
  { pattern: /(.+?)\s+>\s+(.+)/i, operator: 'greaterThan' },
  { pattern: /(.+?)\s+is\s+at\s+least\s+(.+)/i, operator: 'greaterThanOrEqual' },
  { pattern: /(.+?)\s+>=\s+(.+)/i, operator: 'greaterThanOrEqual' },
  { pattern: /(.+?)\s+is\s+less\s+than\s+(.+)/i, operator: 'lessThan' },
  { pattern: /(.+?)\s+is\s+below\s+(.+)/i, operator: 'lessThan' },
  { pattern: /(.+?)\s+<\s+(.+)/i, operator: 'lessThan' },
  { pattern: /(.+?)\s+is\s+at\s+most\s+(.+)/i, operator: 'lessThanOrEqual' },
  { pattern: /(.+?)\s+<=\s+(.+)/i, operator: 'lessThanOrEqual' },
  { pattern: /(.+?)\s+equals?\s+(.+)/i, operator: 'equals' },
  { pattern: /(.+?)\s+is\s+equal\s+to\s+(.+)/i, operator: 'equals' },
  { pattern: /(.+?)\s+==\s+(.+)/i, operator: 'equals' },
  { pattern: /(.+?)\s+is\s+not\s+equal\s+to\s+(.+)/i, operator: 'notEquals' },
  { pattern: /(.+?)\s+!=\s+(.+)/i, operator: 'notEquals' },
  { pattern: /(.+?)\s+contains?\s+(.+)/i, operator: 'contains' },
  { pattern: /(.+?)\s+includes?\s+(.+)/i, operator: 'contains' },
  { pattern: /(.+?)\s+starts?\s+with\s+(.+)/i, operator: 'startsWith' },
  { pattern: /(.+?)\s+ends?\s+with\s+(.+)/i, operator: 'endsWith' },
  { pattern: /(.+?)\s+is\s+in\s+(.+)/i, operator: 'in' },
  { pattern: /(.+?)\s+is\s+between\s+(.+?)\s+and\s+(.+)/i, operator: 'between' },
  { pattern: /(.+?)\s+is\s+true/i, operator: 'equals' },
  { pattern: /(.+?)\s+is\s+false/i, operator: 'equals' },
  { pattern: /(.+?)\s+is\s+(.+)/i, operator: 'equals' },
];

// Action patterns: match natural language to action types
const ACTION_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /set\s+(.+?)\s+to\s+(.+)/i, type: 'setValue' },
  { pattern: /assign\s+(.+?)\s+=\s+(.+)/i, type: 'setValue' },
  { pattern: /approve(?:\s+the\s+(.+))?/i, type: 'setValue' },
  { pattern: /reject(?:\s+the\s+(.+))?/i, type: 'setValue' },
  { pattern: /block(?:\s+(.+))?/i, type: 'setValue' },
  { pattern: /flag\s+(?:for\s+)?(.+)/i, type: 'setValue' },
  { pattern: /send\s+(?:an?\s+)?(?:notification|alert|email)\s+(?:to\s+)?(.+)/i, type: 'notify' },
  { pattern: /log\s+(.+)/i, type: 'log' },
  { pattern: /calculate\s+(.+?)\s+as\s+(.+)/i, type: 'calculate' },
];

/**
 * Normalize a field name: strip quotes, trim, convert to camelCase-style identifier.
 */
function normalizeFieldName(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\$|,/g, '')
    .replace(/\s+(\w)/g, (_m, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Parse a raw value string into an appropriate JS type.
 */
function parseValue(raw: string): any {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  // Booleans
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  // Numbers (strip $ and commas)
  const numStr = trimmed.replace(/[$,]/g, '');
  const num = Number(numStr);
  if (!isNaN(num) && numStr !== '') return num;
  return trimmed;
}

/**
 * Parse a natural language description into structured conditions and actions.
 */
function parseNaturalLanguage(description: string, _context?: string): {
  conditions: ParsedCondition[];
  actions: ParsedAction[];
} {
  const conditions: ParsedCondition[] = [];
  const actions: ParsedAction[] = [];

  // Split on "then" / "so" to separate conditions from actions
  const thenSplit = description.split(/\bthen\b|\bso\b/i);
  const conditionPart = thenSplit[0] || '';
  const actionPart = thenSplit.slice(1).join(' ') || '';

  // --- Parse conditions ---
  // Remove leading "if" / "when" / "where"
  const condText = conditionPart.replace(/^\s*(if|when|where)\s+/i, '');
  // Split on AND / OR conjunctions; we collect individual clauses
  const clauses = condText.split(/\band\b|\bor\b/i).map((c) => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    let matched = false;
    for (const { pattern, operator } of OPERATOR_PATTERNS) {
      const m = clause.match(pattern);
      if (m) {
        const field = normalizeFieldName(m[1]);
        let value: any;

        if (operator === 'between' && m[3]) {
          value = { low: parseValue(m[2]), high: parseValue(m[3]) };
        } else if (/is\s+true$/i.test(clause)) {
          value = true;
        } else if (/is\s+false$/i.test(clause)) {
          value = false;
        } else {
          value = parseValue(m[2]);
        }

        conditions.push({ field, operator, value });
        matched = true;
        break;
      }
    }
    // If no pattern matched, add as a generic equals check
    if (!matched && clause.length > 0) {
      conditions.push({
        field: normalizeFieldName(clause),
        operator: 'exists',
        value: true,
      });
    }
  }

  // --- Parse actions ---
  const actionClauses = actionPart.split(/\band\b/i).map((a) => a.trim()).filter(Boolean);

  for (const actionClause of actionClauses) {
    let matched = false;

    // Check for approve/reject/block first (special handling)
    if (/^\s*approve/i.test(actionClause)) {
      actions.push({ type: 'setValue', target: 'status', value: 'approved' });
      matched = true;
    } else if (/^\s*reject/i.test(actionClause)) {
      actions.push({ type: 'setValue', target: 'status', value: 'rejected' });
      matched = true;
    } else if (/^\s*block/i.test(actionClause)) {
      actions.push({ type: 'setValue', target: 'access', value: 'blocked' });
      matched = true;
    }

    if (!matched) {
      for (const { pattern, type } of ACTION_PATTERNS) {
        const m = actionClause.match(pattern);
        if (m) {
          if (type === 'setValue' && m[1] && m[2]) {
            actions.push({
              type: 'setValue',
              target: normalizeFieldName(m[1]),
              value: parseValue(m[2]),
            });
          } else if (type === 'notify') {
            actions.push({ type: 'notify', target: m[1]?.trim() || 'admin', value: actionClause });
          } else if (type === 'log') {
            actions.push({ type: 'log', value: m[1]?.trim() || actionClause });
          } else if (type === 'calculate' && m[1] && m[2]) {
            actions.push({
              type: 'calculate',
              target: normalizeFieldName(m[1]),
              value: m[2].trim(),
            });
          } else {
            actions.push({ type, value: actionClause });
          }
          matched = true;
          break;
        }
      }
    }

    // Fallback: treat the whole clause as a generic action
    if (!matched && actionClause.length > 0) {
      actions.push({ type: 'setValue', target: 'result', value: actionClause });
    }
  }

  return { conditions, actions };
}

/**
 * Generate a human-readable rule name from a description string.
 */
function generateRuleName(description: string): string {
  // Take the first meaningful sentence or phrase
  const cleaned = description
    .replace(/^(if|when|where)\s+/i, '')
    .replace(/\bthen\b.*/i, '')
    .trim();
  // Capitalize first letter of each word, limit length
  const words = cleaned.split(/\s+/).slice(0, 6);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim() || 'Generated Rule';
}

/**
 * Convert structured conditions and actions back into plain English.
 */
function conditionsToEnglish(conditions: any[], logic: string): string {
  const conjunction = logic === 'OR' ? ' OR ' : ' AND ';
  const parts = conditions.map((c: any) => {
    const field = c.field || 'unknown';
    const value = c.value;
    switch (c.operator) {
      case 'greaterThan': return `${field} is greater than ${value}`;
      case 'greaterThanOrEqual': return `${field} is at least ${value}`;
      case 'lessThan': return `${field} is less than ${value}`;
      case 'lessThanOrEqual': return `${field} is at most ${value}`;
      case 'equals': return `${field} equals ${JSON.stringify(value)}`;
      case 'notEquals': return `${field} does not equal ${JSON.stringify(value)}`;
      case 'contains': return `${field} contains ${JSON.stringify(value)}`;
      case 'startsWith': return `${field} starts with ${JSON.stringify(value)}`;
      case 'endsWith': return `${field} ends with ${JSON.stringify(value)}`;
      case 'in': return `${field} is one of ${JSON.stringify(value)}`;
      case 'between':
        return `${field} is between ${value?.low ?? '?'} and ${value?.high ?? '?'}`;
      case 'exists': return `${field} exists`;
      default: return `${field} ${c.operator} ${JSON.stringify(value)}`;
    }
  });
  return parts.join(conjunction);
}

function actionsToEnglish(actions: any[]): string {
  return actions.map((a: any) => {
    switch (a.type) {
      case 'setValue':
        if (a.target === 'status' && a.value === 'approved') return 'approve the application';
        if (a.target === 'status' && a.value === 'rejected') return 'reject the application';
        return `set ${a.target} to ${JSON.stringify(a.value)}`;
      case 'notify': return `send a notification to ${a.target || 'admin'}`;
      case 'log': return `log "${a.value}"`;
      case 'calculate': return `calculate ${a.target} as ${a.value}`;
      default: return `perform ${a.type}${a.value ? ': ' + a.value : ''}`;
    }
  }).join(', and ');
}

// ---------------------------------------------------------------------------
// POST /generate-rule — generate a structured rule from natural language
// ---------------------------------------------------------------------------
router.post(
  '/generate-rule',
  asyncHandler(async (req: any, res) => {
    requireTenantId(req);

    const { description, context } = req.body;
    const error = validateRequired(req.body, ['description']);
    if (error) {
      return res.status(400).json({ error });
    }

    const { conditions, actions } = parseNaturalLanguage(description, context);

    // Detect logic: if the original description has OR between conditions, use OR
    const conditionPart = description.split(/\bthen\b/i)[0] || '';
    const logic = /\bor\b/i.test(conditionPart) ? 'OR' : 'AND';

    const ruleName = generateRuleName(description);

    const rule = {
      name: ruleName,
      description: description.trim(),
      conditions: {
        logic,
        conditions: conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
      },
      actions: actions.map((a) => ({
        type: a.type,
        target: a.target || undefined,
        value: a.value,
      })),
    };

    res.json({ rule });
  }),
);

// ---------------------------------------------------------------------------
// POST /generate-decision-table — generate a decision table from description
// ---------------------------------------------------------------------------
router.post(
  '/generate-decision-table',
  asyncHandler(async (req: any, res) => {
    requireTenantId(req);

    const { description, columns } = req.body;
    const error = validateRequired(req.body, ['description']);
    if (error) {
      return res.status(400).json({ error });
    }

    // Extract column names from description or use provided columns
    let detectedColumns: string[] = columns || [];

    if (detectedColumns.length === 0) {
      // Try to detect columns from the description
      // Look for patterns like "based on X and Y" or "using X, Y, and Z"
      const basedOnMatch = description.match(/based\s+on\s+(.+?)(?:\.|,\s*(?:determine|decide|set|calculate))/i);
      const usingMatch = description.match(/using\s+(.+?)(?:\.|,\s*(?:determine|decide|set|calculate))/i);
      const forMatch = description.match(/for\s+different\s+(.+?)(?:\.|$)/i);

      const columnSource = basedOnMatch?.[1] || usingMatch?.[1] || forMatch?.[1] || '';
      detectedColumns = columnSource
        .split(/,|\band\b/i)
        .map((c: string) => c.trim())
        .filter(Boolean)
        .map((c: string) => normalizeFieldName(c));
    }

    // Detect output column from description
    let outputColumn = 'result';
    const determineMatch = description.match(/(?:determine|decide|set|calculate|output)\s+(?:the\s+)?(.+?)(?:\.|$)/i);
    if (determineMatch) {
      outputColumn = normalizeFieldName(determineMatch[1]);
    }

    // Build column definitions
    const inputColumns = detectedColumns.map((name: string) => ({
      name,
      type: 'input' as const,
      dataType: 'string',
    }));

    const outputColumns = [{
      name: outputColumn,
      type: 'output' as const,
      dataType: 'string',
    }];

    // Generate sample rows
    const sampleRows = [
      Object.fromEntries([
        ...detectedColumns.map((c: string) => [c, `<${c}_value_1>`]),
        [outputColumn, '<result_1>'],
      ]),
      Object.fromEntries([
        ...detectedColumns.map((c: string) => [c, `<${c}_value_2>`]),
        [outputColumn, '<result_2>'],
      ]),
      Object.fromEntries([
        ...detectedColumns.map((c: string) => [c, `<${c}_value_3>`]),
        [outputColumn, '<result_3>'],
      ]),
    ];

    const table = {
      name: generateRuleName(description) + ' Table',
      description: description.trim(),
      columns: [...inputColumns, ...outputColumns],
      rows: sampleRows,
      hitPolicy: 'FIRST',
    };

    res.json({ table });
  }),
);

// ---------------------------------------------------------------------------
// POST /explain-rule — convert a stored rule to plain English
// ---------------------------------------------------------------------------
router.post(
  '/explain-rule',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);

    const { ruleId } = req.body;
    const error = validateRequired(req.body, ['ruleId']);
    if (error) {
      return res.status(400).json({ error });
    }

    // Fetch the rule, verifying tenant ownership via ruleSet -> project -> tenant
    const rule = await prisma.rule.findUnique({
      where: { id: ruleId },
      include: {
        ruleSet: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (!rule.ruleSet.project.tenantId || rule.ruleSet.project.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const conditions = safeJsonParse(rule.conditions, {});
    const actions = safeJsonParse(rule.actions, []);

    // Build the English explanation
    const conditionList = conditions.conditions || [];
    const logic = conditions.logic || 'AND';
    const actionList = Array.isArray(actions) ? actions : [];

    let explanation = '';

    if (conditionList.length > 0) {
      explanation += `If ${conditionsToEnglish(conditionList, logic)}`;
    } else {
      explanation += 'For all inputs (no conditions)';
    }

    if (actionList.length > 0) {
      explanation += `, then ${actionsToEnglish(actionList)}.`;
    } else {
      explanation += ' (no actions defined).';
    }

    res.json({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleDescription: rule.description,
      explanation,
      conditions,
      actions,
    });
  }),
);

export default router;
