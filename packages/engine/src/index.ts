// ============================================================
// SOA One Rule Engine — Public API
// ============================================================

// ── Original functional API (unchanged) ─────────────────────

export {
  evaluateRule,
  evaluateDecisionTable,
  executeRuleSet,
} from './evaluator';

export { resolvePath, setPath, evaluateOperator } from './operators';

// ── Original types (unchanged) ──────────────────────────────

export type {
  ComparisonOperator,
  LogicalOperator,
  Condition,
  ConditionGroup,
  ActionType,
  Action,
  Rule,
  DecisionTableColumn,
  DecisionTableRow,
  DecisionTable,
  RuleSet,
  RuleResult,
  DecisionTableResult,
  ExecutionResult,
  FieldDefinition,
  DataModelDefinition,
} from './types';

// ── Plugin system ───────────────────────────────────────────

export { PluginRegistry } from './plugin';

export type {
  EnginePlugin,
  OperatorHandler,
  ActionHandler,
  ExecutionHook,
  RuleHook,
  CustomFunction,
  ExecutionHookContext,
  RuleHookContext,
} from './plugin';

// ── Adapter interfaces ──────────────────────────────────────

export type {
  DataSourceAdapter,
  AuditAdapter,
  AuditEntry,
  AuditQueryFilter,
  CacheAdapter,
  NotificationAdapter,
  NotificationSeverity,
  NotificationEvent,
  EngineAdapters,
} from './adapter';

// ── Pluggable engine class ──────────────────────────────────

export { RuleEngine } from './engine';

export type {
  EngineOptions,
  EngineConfig,
} from './engine';
