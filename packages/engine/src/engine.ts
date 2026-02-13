// ============================================================
// SOA One Rule Engine — Pluggable Engine Class
// ============================================================
//
// Wraps the functional evaluation API with a configurable,
// lifecycle-aware class that supports plugins and adapters.
// ============================================================

import type {
  Action,
  Rule,
  RuleSet,
  DecisionTable,
  Condition,
  ConditionGroup,
  ComparisonOperator,
  RuleResult,
  DecisionTableResult,
  ExecutionResult,
} from './types';

import { resolvePath, setPath, evaluateOperator } from './operators';

import {
  PluginRegistry,
  type EnginePlugin,
  type ExecutionHookContext,
  type RuleHookContext,
} from './plugin';

import type {
  EngineAdapters,
  DataSourceAdapter,
  AuditAdapter,
  CacheAdapter,
  NotificationAdapter,
  AuditEntry,
} from './adapter';

// ── Configuration ──────────────────────────────────────────

/** Options that control engine behaviour. */
export interface EngineOptions {
  /**
   * When true, cache rule set definitions via the CacheAdapter.
   * Default: false
   */
  cacheRuleSets?: boolean;

  /**
   * Default TTL (in ms) for cached rule sets.
   * Only used when `cacheRuleSets` is true. Default: 300_000 (5 min).
   */
  cacheRuleSetTtlMs?: number;

  /**
   * When true, cache execution results via the CacheAdapter.
   * Default: false
   */
  cacheResults?: boolean;

  /**
   * Default TTL (in ms) for cached execution results.
   * Only used when `cacheResults` is true. Default: 60_000 (1 min).
   */
  cacheResultTtlMs?: number;

  /**
   * When true, every execution is recorded via the AuditAdapter.
   * Default: true (if an audit adapter is present).
   */
  auditEnabled?: boolean;

  /**
   * Metadata attached to every execution (e.g. tenant ID, environment).
   */
  metadata?: Record<string, any>;
}

/** Full configuration for the RuleEngine constructor. */
export interface EngineConfig {
  plugins?: EnginePlugin[];
  adapters?: EngineAdapters;
  options?: EngineOptions;
}

// ── Rule Engine ────────────────────────────────────────────

/**
 * A configurable, pluggable rule engine that wraps the lower-level
 * functional API (evaluateRule, evaluateDecisionTable, executeRuleSet)
 * and extends it with plugins, adapters, and lifecycle management.
 *
 * Usage:
 * ```ts
 * const engine = new RuleEngine({
 *   plugins: [myPlugin],
 *   adapters: { audit: myAuditAdapter, cache: myCache },
 *   options: { cacheRuleSets: true },
 * });
 * await engine.init();
 * const result = await engine.execute(ruleSet, input);
 * await engine.shutdown();
 * ```
 */
export class RuleEngine {
  private readonly _registry: PluginRegistry;
  private readonly _adapters: EngineAdapters;
  private readonly _options: Required<EngineOptions>;
  private _initialized = false;
  private _destroyed = false;

  constructor(config: EngineConfig = {}) {
    this._registry = new PluginRegistry();
    this._adapters = config.adapters ?? {};

    // Resolve options with defaults
    const opts = config.options ?? {};
    this._options = {
      cacheRuleSets: opts.cacheRuleSets ?? false,
      cacheRuleSetTtlMs: opts.cacheRuleSetTtlMs ?? 300_000,
      cacheResults: opts.cacheResults ?? false,
      cacheResultTtlMs: opts.cacheResultTtlMs ?? 60_000,
      auditEnabled: opts.auditEnabled ?? true,
      metadata: opts.metadata ?? {},
    };

    // Register initial plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        this._registry.register(plugin);
      }
    }
  }

  // ── Lifecycle ──────────────────────────────────────────

  /**
   * Initialize the engine: init all adapters.
   * Must be called before `execute` when adapters are used.
   */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed RuleEngine. Create a new instance.');
    }

    // Init data sources
    if (this._adapters.dataSources) {
      for (const ds of this._adapters.dataSources) {
        if (ds.init) await ds.init();
      }
    }
    if (this._adapters.audit?.init) await this._adapters.audit.init();
    if (this._adapters.cache?.init) await this._adapters.cache.init();
    if (this._adapters.notification?.init) await this._adapters.notification.init();

    this._initialized = true;
  }

  /**
   * Shut down the engine: destroy all adapters and plugins.
   */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    // Destroy adapters
    if (this._adapters.dataSources) {
      for (const ds of this._adapters.dataSources) {
        if (ds.destroy) await ds.destroy();
      }
    }
    if (this._adapters.audit?.destroy) await this._adapters.audit.destroy();
    if (this._adapters.cache?.destroy) await this._adapters.cache.destroy();
    if (this._adapters.notification?.destroy) await this._adapters.notification.destroy();

    // Destroy all plugins
    this._registry.destroyAll();

    this._initialized = false;
    this._destroyed = true;
  }

  // ── Plugin / Adapter Registration ──────────────────────

  /** Register a plugin at runtime. */
  registerPlugin(plugin: EnginePlugin): void {
    this._registry.register(plugin);
  }

  /** Unregister a plugin by name. */
  unregisterPlugin(pluginName: string): void {
    this._registry.unregister(pluginName);
  }

  /** Register a data source adapter at runtime. */
  registerDataSource(adapter: DataSourceAdapter): void {
    if (!this._adapters.dataSources) {
      this._adapters.dataSources = [];
    }
    this._adapters.dataSources.push(adapter);
  }

  /** Set the audit adapter. */
  registerAudit(adapter: AuditAdapter): void {
    this._adapters.audit = adapter;
  }

  /** Set the cache adapter. */
  registerCache(adapter: CacheAdapter): void {
    this._adapters.cache = adapter;
  }

  /** Set the notification adapter. */
  registerNotification(adapter: NotificationAdapter): void {
    this._adapters.notification = adapter;
  }

  /**
   * Generic adapter registration by kind.
   */
  registerAdapter(
    kind: 'dataSource',
    adapter: DataSourceAdapter,
  ): void;
  registerAdapter(kind: 'audit', adapter: AuditAdapter): void;
  registerAdapter(kind: 'cache', adapter: CacheAdapter): void;
  registerAdapter(
    kind: 'notification',
    adapter: NotificationAdapter,
  ): void;
  registerAdapter(kind: string, adapter: any): void {
    switch (kind) {
      case 'dataSource':
        this.registerDataSource(adapter as DataSourceAdapter);
        break;
      case 'audit':
        this.registerAudit(adapter as AuditAdapter);
        break;
      case 'cache':
        this.registerCache(adapter as CacheAdapter);
        break;
      case 'notification':
        this.registerNotification(adapter as NotificationAdapter);
        break;
      default:
        throw new Error(`Unknown adapter kind: "${kind}"`);
    }
  }

  // ── Accessors ──────────────────────────────────────────

  /** Access the underlying plugin registry for advanced use. */
  get registry(): PluginRegistry {
    return this._registry;
  }

  /** Whether `init()` has been called. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Whether `shutdown()` has been called. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Rule Set Loading ───────────────────────────────────

  /**
   * Load a rule set, optionally from cache.
   * If caching is enabled and a CacheAdapter is present, the rule set
   * is stored/retrieved under the key `ruleset:<id>`.
   */
  async loadRuleSet(
    ruleSetOrId: RuleSet | string,
    fetcher?: () => Promise<RuleSet>,
  ): Promise<RuleSet> {
    // If a full object was passed, optionally cache it and return.
    if (typeof ruleSetOrId !== 'string') {
      await this._cacheRuleSet(ruleSetOrId);
      return ruleSetOrId;
    }

    // String ID path: try cache first
    const cacheKey = `ruleset:${ruleSetOrId}`;
    if (this._options.cacheRuleSets && this._adapters.cache) {
      const cached = await this._adapters.cache.get<RuleSet>(cacheKey);
      if (cached) return cached;
    }

    if (!fetcher) {
      throw new Error(
        `Rule set "${ruleSetOrId}" not found in cache and no fetcher provided.`,
      );
    }

    const ruleSet = await fetcher();
    await this._cacheRuleSet(ruleSet);
    return ruleSet;
  }

  // ── Evaluation (single rule) ───────────────────────────

  /**
   * Evaluate a single rule against input data, respecting plugin operators.
   */
  evaluateRule(
    rule: Rule,
    data: Record<string, any>,
  ): RuleResult {
    if (!rule.enabled) {
      return { ruleId: rule.id, ruleName: rule.name, fired: false, actions: [] };
    }

    const fired = this._evaluateConditionGroup(rule.conditions, data);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      fired,
      actions: fired ? rule.actions : [],
    };
  }

  // ── Full Execution ─────────────────────────────────────

  /**
   * Execute a rule set against input data with full plugin/adapter lifecycle.
   *
   * Flow:
   * 1. Run beforeExecute hooks
   * 2. Evaluate rules (with beforeRule/afterRule hooks)
   * 3. Evaluate decision tables
   * 4. Apply actions (using plugin action handlers for non-built-in types)
   * 5. Run afterExecute hooks
   * 6. Audit, notify, cache result
   */
  async execute(
    ruleSet: RuleSet,
    input: Record<string, any>,
  ): Promise<ExecutionResult> {
    const startTime = performance.now();

    // ── Check result cache ──
    const resultCacheKey = this._options.cacheResults
      ? `result:${ruleSet.id}:${this._hashInput(input)}`
      : undefined;

    if (resultCacheKey && this._adapters.cache) {
      const cached = await this._adapters.cache.get<ExecutionResult>(resultCacheKey);
      if (cached) return cached;
    }

    try {
      const output: Record<string, any> = {};
      const ruleResults: RuleResult[] = [];
      const tableResults: DecisionTableResult[] = [];
      const rulesFired: string[] = [];

      // ── Before-execute hooks ──
      let execCtx: ExecutionHookContext = {
        ruleSet,
        input: { ...input },
        output,
        metadata: { ...this._options.metadata },
      };
      execCtx = this._registry.runBeforeExecuteHooks(execCtx);
      const effectiveInput = execCtx.input;

      // ── Evaluate rules (sorted by priority) ──
      const sortedRules = [...ruleSet.rules].sort(
        (a, b) => b.priority - a.priority,
      );

      for (const rule of sortedRules) {
        // Before-rule hook
        let ruleCtx: RuleHookContext = {
          rule,
          input: effectiveInput,
          output,
          metadata: { ...this._options.metadata },
        };
        ruleCtx = this._registry.runBeforeRuleHooks(ruleCtx);

        if (ruleCtx.skip) {
          ruleResults.push({
            ruleId: rule.id,
            ruleName: rule.name,
            fired: false,
            actions: [],
          });
          continue;
        }

        const result = this.evaluateRule(rule, effectiveInput);
        ruleResults.push(result);

        if (result.fired) {
          rulesFired.push(rule.id);
          for (const action of result.actions) {
            this._applyAction(output, action, effectiveInput);
          }
        }

        // After-rule hook
        ruleCtx.result = result;
        this._registry.runAfterRuleHooks(ruleCtx);
      }

      // ── Evaluate decision tables ──
      for (const table of ruleSet.decisionTables) {
        const result = this._evaluateDecisionTable(table, effectiveInput);
        tableResults.push(result);

        for (const action of result.actions) {
          this._applyAction(output, action, effectiveInput);
        }
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      const executionResult: ExecutionResult = {
        success: true,
        input: effectiveInput,
        output,
        ruleResults,
        tableResults,
        rulesFired,
        executionTimeMs,
      };

      // ── After-execute hooks ──
      execCtx.result = executionResult;
      execCtx.output = output;
      const afterCtx = this._registry.runAfterExecuteHooks(execCtx);
      const finalResult = afterCtx.result ?? executionResult;

      // ── Post-execution side effects ──
      await this._postExecution(ruleSet, finalResult);

      return finalResult;
    } catch (err: any) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      const errorResult: ExecutionResult = {
        success: false,
        input,
        output: {},
        ruleResults: [],
        tableResults: [],
        rulesFired: [],
        executionTimeMs,
        error: err.message || 'Unknown execution error',
      };

      // Notify on error
      if (this._adapters.notification) {
        await this._adapters.notification
          .notify({
            timestamp: new Date().toISOString(),
            severity: 'error',
            message: `Rule set "${ruleSet.name}" execution failed: ${errorResult.error}`,
            ruleSetId: ruleSet.id,
            details: { error: errorResult.error },
          })
          .catch(() => {
            /* swallow notification errors */
          });
      }

      return errorResult;
    }
  }

  // ── Private: Condition Evaluation ──────────────────────

  private _evaluateCondition(
    condition: Condition,
    data: Record<string, any>,
  ): boolean {
    const fieldValue = resolvePath(data, condition.field);

    // Check for plugin-provided operator first
    const pluginOp = this._registry.getOperator(condition.operator);
    if (pluginOp) {
      return pluginOp(fieldValue, condition.value);
    }

    // Fall back to built-in operators
    return evaluateOperator(
      fieldValue,
      condition.operator as ComparisonOperator,
      condition.value,
    );
  }

  private _evaluateConditionGroup(
    group: ConditionGroup,
    data: Record<string, any>,
  ): boolean {
    if (!group.conditions || group.conditions.length === 0) {
      return true;
    }

    if (group.logic === 'AND') {
      return group.conditions.every((c) =>
        'logic' in c
          ? this._evaluateConditionGroup(c as ConditionGroup, data)
          : this._evaluateCondition(c as Condition, data),
      );
    } else {
      return group.conditions.some((c) =>
        'logic' in c
          ? this._evaluateConditionGroup(c as ConditionGroup, data)
          : this._evaluateCondition(c as Condition, data),
      );
    }
  }

  // ── Private: Decision Table ────────────────────────────

  private _evaluateDecisionTable(
    table: DecisionTable,
    data: Record<string, any>,
  ): DecisionTableResult {
    const conditionColumns = table.columns.filter(
      (c) => c.type === 'condition',
    );
    const actionColumns = table.columns.filter((c) => c.type === 'action');
    const matchedRows: string[] = [];
    const actions: Action[] = [];

    for (const row of table.rows) {
      if (!row.enabled) continue;

      const matches = conditionColumns.every((col) => {
        const cellValue = row.values[col.id];
        if (
          cellValue === '' ||
          cellValue === null ||
          cellValue === undefined ||
          cellValue === '*'
        ) {
          return true; // wildcard
        }
        const fieldValue = resolvePath(data, col.field);

        // Check for plugin operator
        const pluginOp = this._registry.getOperator(
          col.operator || 'equals',
        );
        if (pluginOp) {
          return pluginOp(fieldValue, cellValue);
        }

        return evaluateOperator(
          fieldValue,
          col.operator || 'equals',
          cellValue,
        );
      });

      if (matches) {
        matchedRows.push(row.id);

        for (const col of actionColumns) {
          const cellValue = row.values[col.id];
          if (
            cellValue !== undefined &&
            cellValue !== null &&
            cellValue !== ''
          ) {
            actions.push({
              type: col.actionType || 'SET',
              field: col.field,
              value: cellValue,
            });
          }
        }

        if (table.hitPolicy === 'FIRST') break;
      }
    }

    return {
      tableId: table.id,
      tableName: table.name,
      matchedRows,
      actions,
    };
  }

  // ── Private: Action Application ────────────────────────

  private _applyAction(
    output: Record<string, any>,
    action: Action,
    input: Record<string, any>,
  ): void {
    // Check for plugin-provided action handler first
    const pluginHandler = this._registry.getActionHandler(action.type);
    if (pluginHandler) {
      pluginHandler(output, action, input);
      return;
    }

    // Built-in action types
    switch (action.type) {
      case 'SET':
        setPath(output, action.field, action.value);
        break;
      case 'APPEND': {
        const current = resolvePath(output, action.field);
        if (Array.isArray(current)) {
          current.push(action.value);
        } else {
          setPath(output, action.field, [action.value]);
        }
        break;
      }
      case 'INCREMENT': {
        const current = resolvePath(output, action.field) || 0;
        setPath(
          output,
          action.field,
          Number(current) + Number(action.value),
        );
        break;
      }
      case 'DECREMENT': {
        const current = resolvePath(output, action.field) || 0;
        setPath(
          output,
          action.field,
          Number(current) - Number(action.value),
        );
        break;
      }
      case 'CUSTOM':
        // CUSTOM with no plugin handler falls back to SET behaviour
        setPath(output, action.field, action.value);
        break;
      default:
        // Unknown action type with no plugin handler -- silently ignore
        break;
    }
  }

  // ── Private: Post-Execution Side Effects ───────────────

  private async _postExecution(
    ruleSet: RuleSet,
    result: ExecutionResult,
  ): Promise<void> {
    // Audit
    if (this._options.auditEnabled && this._adapters.audit) {
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        ruleSetId: ruleSet.id,
        ruleSetName: ruleSet.name,
        result,
        metadata: this._options.metadata,
      };
      await this._adapters.audit.record(entry).catch(() => {
        /* swallow audit errors */
      });
    }

    // Cache result
    if (
      this._options.cacheResults &&
      this._adapters.cache &&
      result.success
    ) {
      const key = `result:${ruleSet.id}:${this._hashInput(result.input)}`;
      await this._adapters.cache
        .set(key, result, this._options.cacheResultTtlMs)
        .catch(() => {
          /* swallow cache errors */
        });
    }

    // Notification on fired rules (informational)
    if (this._adapters.notification && result.rulesFired.length > 0) {
      await this._adapters.notification
        .notify({
          timestamp: new Date().toISOString(),
          severity: 'info',
          message: `Rule set "${ruleSet.name}" executed: ${result.rulesFired.length} rule(s) fired.`,
          ruleSetId: ruleSet.id,
          details: {
            rulesFired: result.rulesFired,
            executionTimeMs: result.executionTimeMs,
          },
        })
        .catch(() => {
          /* swallow notification errors */
        });
    }
  }

  // ── Private: Caching Helpers ───────────────────────────

  private async _cacheRuleSet(ruleSet: RuleSet): Promise<void> {
    if (this._options.cacheRuleSets && this._adapters.cache) {
      const key = `ruleset:${ruleSet.id}`;
      await this._adapters.cache
        .set(key, ruleSet, this._options.cacheRuleSetTtlMs)
        .catch(() => {
          /* swallow cache errors */
        });
    }
  }

  /**
   * Produce a simple deterministic hash string for an input object.
   * This is intentionally simple (JSON-based) because we have zero
   * external deps. For production use, consumers should provide
   * their own CacheAdapter with a proper hashing strategy.
   */
  private _hashInput(input: Record<string, any>): string {
    try {
      const str = JSON.stringify(input);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash + ch) | 0; // int32
      }
      return hash.toString(36);
    } catch {
      return 'unhashable';
    }
  }
}
