// ============================================================
// SOA One Rule Engine — Plugin System
// ============================================================
//
// Allows SOA consumers to extend the engine with custom
// operators, action handlers, execution hooks, and functions.
// ============================================================

import type {
  ComparisonOperator,
  Action,
  Rule,
  RuleSet,
  ExecutionResult,
  RuleResult,
} from './types';

// ── Handler / Hook Signatures ──────────────────────────────

/**
 * Custom operator handler.
 * Receives the field value, the comparison value, and returns a boolean.
 */
export type OperatorHandler = (
  fieldValue: any,
  compareValue: any,
) => boolean;

/**
 * Custom action handler.
 * Receives the output object, the action, and the original input data.
 * It should mutate `output` directly.
 */
export type ActionHandler = (
  output: Record<string, any>,
  action: Action,
  input: Record<string, any>,
) => void;

/**
 * Hook that runs before/after the entire rule set execution.
 * May return a modified input (beforeExecute) or modified result (afterExecute).
 */
export type ExecutionHook = (
  context: ExecutionHookContext,
) => ExecutionHookContext | void;

/**
 * Hook that runs before/after each individual rule evaluation.
 * May return a modified rule result (afterRule) or signal skip (beforeRule).
 */
export type RuleHook = (
  context: RuleHookContext,
) => RuleHookContext | void;

/**
 * A custom function that can be referenced in rule conditions or actions.
 * Receives arbitrary args and returns a value.
 */
export type CustomFunction = (...args: any[]) => any;

// ── Hook Contexts ──────────────────────────────────────────

/** Context passed to execution-level hooks. */
export interface ExecutionHookContext {
  ruleSet: RuleSet;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: ExecutionResult;
  metadata: Record<string, any>;
}

/** Context passed to rule-level hooks. */
export interface RuleHookContext {
  rule: Rule;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: RuleResult;
  skip?: boolean;
  metadata: Record<string, any>;
}

// ── Plugin Interface ───────────────────────────────────────

/**
 * An engine plugin bundles related extensions into a single registerable unit.
 *
 * Example:
 * ```ts
 * const myPlugin: EnginePlugin = {
 *   name: 'geo-operators',
 *   version: '1.0.0',
 *   operators: {
 *     withinRadius: (fieldValue, compareValue) => { ... },
 *   },
 * };
 * ```
 */
export interface EnginePlugin {
  /** Unique name of the plugin. */
  name: string;
  /** Semver version (informational). */
  version?: string;
  /** Custom comparison operators keyed by name. */
  operators?: Record<string, OperatorHandler>;
  /** Custom action handlers keyed by action type string. */
  actionHandlers?: Record<string, ActionHandler>;
  /** Lifecycle hooks. */
  hooks?: {
    beforeExecute?: ExecutionHook[];
    afterExecute?: ExecutionHook[];
    beforeRule?: RuleHook[];
    afterRule?: RuleHook[];
  };
  /** Custom functions callable from rule conditions/actions. */
  functions?: Record<string, CustomFunction>;
  /** Optional initialization callback (called when plugin is registered). */
  onRegister?: () => void;
  /** Optional teardown callback (called when engine shuts down). */
  onDestroy?: () => void;
}

// ── Plugin Registry ────────────────────────────────────────

/**
 * Central registry that holds all registered plugin extensions.
 *
 * This is intentionally a concrete class (not just an interface) so that
 * both the `RuleEngine` class and lower-level consumers can share or
 * instantiate their own isolated registries.
 */
export class PluginRegistry {
  private _plugins: Map<string, EnginePlugin> = new Map();
  private _operators: Map<string, OperatorHandler> = new Map();
  private _actionHandlers: Map<string, ActionHandler> = new Map();
  private _functions: Map<string, CustomFunction> = new Map();

  private _beforeExecuteHooks: ExecutionHook[] = [];
  private _afterExecuteHooks: ExecutionHook[] = [];
  private _beforeRuleHooks: RuleHook[] = [];
  private _afterRuleHooks: RuleHook[] = [];

  // ── Registration ───────────────────────────────────────

  /**
   * Register a plugin. All its operators, handlers, hooks, and functions
   * are merged into the registry. Duplicate plugin names are rejected.
   */
  register(plugin: EnginePlugin): void {
    if (this._plugins.has(plugin.name)) {
      throw new Error(
        `Plugin "${plugin.name}" is already registered. ` +
          'Unregister it first if you want to replace it.',
      );
    }

    // Operators
    if (plugin.operators) {
      for (const [name, handler] of Object.entries(plugin.operators)) {
        if (this._operators.has(name)) {
          throw new Error(
            `Operator "${name}" is already registered ` +
              `(conflict from plugin "${plugin.name}").`,
          );
        }
        this._operators.set(name, handler);
      }
    }

    // Action handlers
    if (plugin.actionHandlers) {
      for (const [type, handler] of Object.entries(plugin.actionHandlers)) {
        if (this._actionHandlers.has(type)) {
          throw new Error(
            `Action handler "${type}" is already registered ` +
              `(conflict from plugin "${plugin.name}").`,
          );
        }
        this._actionHandlers.set(type, handler);
      }
    }

    // Hooks
    if (plugin.hooks) {
      if (plugin.hooks.beforeExecute) {
        this._beforeExecuteHooks.push(...plugin.hooks.beforeExecute);
      }
      if (plugin.hooks.afterExecute) {
        this._afterExecuteHooks.push(...plugin.hooks.afterExecute);
      }
      if (plugin.hooks.beforeRule) {
        this._beforeRuleHooks.push(...plugin.hooks.beforeRule);
      }
      if (plugin.hooks.afterRule) {
        this._afterRuleHooks.push(...plugin.hooks.afterRule);
      }
    }

    // Functions
    if (plugin.functions) {
      for (const [name, fn] of Object.entries(plugin.functions)) {
        if (this._functions.has(name)) {
          throw new Error(
            `Function "${name}" is already registered ` +
              `(conflict from plugin "${plugin.name}").`,
          );
        }
        this._functions.set(name, fn);
      }
    }

    this._plugins.set(plugin.name, plugin);

    if (plugin.onRegister) {
      plugin.onRegister();
    }
  }

  /**
   * Unregister a plugin by name, removing all its contributed extensions.
   */
  unregister(pluginName: string): void {
    const plugin = this._plugins.get(pluginName);
    if (!plugin) return;

    // Remove operators
    if (plugin.operators) {
      for (const name of Object.keys(plugin.operators)) {
        this._operators.delete(name);
      }
    }

    // Remove action handlers
    if (plugin.actionHandlers) {
      for (const type of Object.keys(plugin.actionHandlers)) {
        this._actionHandlers.delete(type);
      }
    }

    // Remove hooks (compare by reference)
    if (plugin.hooks) {
      if (plugin.hooks.beforeExecute) {
        for (const hook of plugin.hooks.beforeExecute) {
          const idx = this._beforeExecuteHooks.indexOf(hook);
          if (idx >= 0) this._beforeExecuteHooks.splice(idx, 1);
        }
      }
      if (plugin.hooks.afterExecute) {
        for (const hook of plugin.hooks.afterExecute) {
          const idx = this._afterExecuteHooks.indexOf(hook);
          if (idx >= 0) this._afterExecuteHooks.splice(idx, 1);
        }
      }
      if (plugin.hooks.beforeRule) {
        for (const hook of plugin.hooks.beforeRule) {
          const idx = this._beforeRuleHooks.indexOf(hook);
          if (idx >= 0) this._beforeRuleHooks.splice(idx, 1);
        }
      }
      if (plugin.hooks.afterRule) {
        for (const hook of plugin.hooks.afterRule) {
          const idx = this._afterRuleHooks.indexOf(hook);
          if (idx >= 0) this._afterRuleHooks.splice(idx, 1);
        }
      }
    }

    // Remove functions
    if (plugin.functions) {
      for (const name of Object.keys(plugin.functions)) {
        this._functions.delete(name);
      }
    }

    if (plugin.onDestroy) {
      plugin.onDestroy();
    }

    this._plugins.delete(pluginName);
  }

  // ── Queries ────────────────────────────────────────────

  /** Get a custom operator handler by name, or undefined. */
  getOperator(name: string): OperatorHandler | undefined {
    return this._operators.get(name);
  }

  /** Get a custom action handler by type, or undefined. */
  getActionHandler(type: string): ActionHandler | undefined {
    return this._actionHandlers.get(type);
  }

  /** Get a custom function by name, or undefined. */
  getFunction(name: string): CustomFunction | undefined {
    return this._functions.get(name);
  }

  /** Whether a plugin with the given name is registered. */
  hasPlugin(name: string): boolean {
    return this._plugins.has(name);
  }

  /** Return a snapshot of all registered plugin names. */
  get pluginNames(): string[] {
    return Array.from(this._plugins.keys());
  }

  /** Return a snapshot of all registered operator names (plugin-contributed). */
  get operatorNames(): string[] {
    return Array.from(this._operators.keys());
  }

  /** Return a snapshot of all registered action handler types (plugin-contributed). */
  get actionHandlerTypes(): string[] {
    return Array.from(this._actionHandlers.keys());
  }

  /** Return a snapshot of all registered function names. */
  get functionNames(): string[] {
    return Array.from(this._functions.keys());
  }

  // ── Hook Execution ─────────────────────────────────────

  /** Run all beforeExecute hooks in registration order. */
  runBeforeExecuteHooks(context: ExecutionHookContext): ExecutionHookContext {
    let ctx = context;
    for (const hook of this._beforeExecuteHooks) {
      const result = hook(ctx);
      if (result) ctx = result;
    }
    return ctx;
  }

  /** Run all afterExecute hooks in registration order. */
  runAfterExecuteHooks(context: ExecutionHookContext): ExecutionHookContext {
    let ctx = context;
    for (const hook of this._afterExecuteHooks) {
      const result = hook(ctx);
      if (result) ctx = result;
    }
    return ctx;
  }

  /** Run all beforeRule hooks in registration order. */
  runBeforeRuleHooks(context: RuleHookContext): RuleHookContext {
    let ctx = context;
    for (const hook of this._beforeRuleHooks) {
      const result = hook(ctx);
      if (result) ctx = result;
      if (ctx.skip) break; // short-circuit if a hook says to skip
    }
    return ctx;
  }

  /** Run all afterRule hooks in registration order. */
  runAfterRuleHooks(context: RuleHookContext): RuleHookContext {
    let ctx = context;
    for (const hook of this._afterRuleHooks) {
      const result = hook(ctx);
      if (result) ctx = result;
    }
    return ctx;
  }

  /** Destroy all plugins and clear the registry. */
  destroyAll(): void {
    for (const plugin of this._plugins.values()) {
      if (plugin.onDestroy) {
        plugin.onDestroy();
      }
    }
    this._plugins.clear();
    this._operators.clear();
    this._actionHandlers.clear();
    this._functions.clear();
    this._beforeExecuteHooks = [];
    this._afterExecuteHooks = [];
    this._beforeRuleHooks = [];
    this._afterRuleHooks = [];
  }
}
