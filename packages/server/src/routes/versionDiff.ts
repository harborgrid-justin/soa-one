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
// GET /rule-sets/:ruleSetId/diff/:v1/:v2
//   Compare two RuleSetVersion snapshots and return a structured diff.
// ---------------------------------------------------------------------------
router.get(
  '/rule-sets/:ruleSetId/diff/:v1/:v2',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    const { ruleSetId } = req.params;
    const v1Num = Number(req.params.v1);
    const v2Num = Number(req.params.v2);

    if (isNaN(v1Num) || isNaN(v2Num)) {
      return res.status(400).json({ error: 'Version numbers must be integers' });
    }

    // Verify the ruleSet belongs to the user's tenant via ruleSet -> project -> tenant
    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id: ruleSetId },
      include: {
        project: true,
      },
    });

    if (!ruleSet) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    if (!ruleSet.project.tenantId || ruleSet.project.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Rule set not found' });
    }

    // Load both version snapshots
    const [version1, version2] = await Promise.all([
      prisma.ruleSetVersion.findFirst({
        where: { ruleSetId, version: v1Num },
      }),
      prisma.ruleSetVersion.findFirst({
        where: { ruleSetId, version: v2Num },
      }),
    ]);

    if (!version1) {
      return res.status(404).json({ error: `Version ${v1Num} not found` });
    }
    if (!version2) {
      return res.status(404).json({ error: `Version ${v2Num} not found` });
    }

    const snap1 = safeJsonParse(version1.snapshot, {});
    const snap2 = safeJsonParse(version2.snapshot, {});

    // Diff rules
    const rulesDiff = diffEntities(
      snap1.rules || [],
      snap2.rules || [],
      ['name', 'priority', 'enabled', 'conditions', 'actions'],
    );

    // Diff decision tables
    const tablesDiff = diffEntities(
      snap1.decisionTables || [],
      snap2.decisionTables || [],
      ['name', 'columns', 'rows'],
    );

    res.json({
      v1: v1Num,
      v2: v2Num,
      rules: rulesDiff,
      tables: tablesDiff,
    });
  }),
);

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

interface EntityDiffResult {
  added: any[];
  removed: any[];
  modified: ModifiedEntity[];
}

interface ModifiedEntity {
  id: string;
  name: string;
  changes: FieldChange[];
}

interface FieldChange {
  field: string;
  before: any;
  after: any;
}

/**
 * Compare two arrays of entities (rules or tables) by ID.
 * Returns { added, removed, modified } where modified entries include
 * field-level change details for each of the tracked fields.
 */
function diffEntities(
  oldList: any[],
  newList: any[],
  trackedFields: string[],
): EntityDiffResult {
  const oldMap = new Map<string, any>();
  for (const item of oldList) {
    oldMap.set(item.id, item);
  }

  const newMap = new Map<string, any>();
  for (const item of newList) {
    newMap.set(item.id, item);
  }

  const added: any[] = [];
  const removed: any[] = [];
  const modified: ModifiedEntity[] = [];

  // Find removed and modified
  for (const [id, oldItem] of oldMap) {
    const newItem = newMap.get(id);
    if (!newItem) {
      removed.push({ id, name: oldItem.name });
    } else {
      // Check each tracked field for changes
      const changes: FieldChange[] = [];
      for (const field of trackedFields) {
        const before = oldItem[field];
        const after = newItem[field];
        if (!valuesEqual(before, after)) {
          changes.push({ field, before, after });
        }
      }
      if (changes.length > 0) {
        modified.push({ id, name: newItem.name, changes });
      }
    }
  }

  // Find added
  for (const [id, newItem] of newMap) {
    if (!oldMap.has(id)) {
      added.push({ id, name: newItem.name });
    }
  }

  return { added, removed, modified };
}

/**
 * Deep equality check for comparing field values (handles primitives,
 * arrays, and plain objects -- sufficient for JSON-serialisable data).
 */
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

export default router;
