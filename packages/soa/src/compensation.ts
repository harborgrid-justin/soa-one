// ============================================================
// SOA One SOA — Compensation Manager
// ============================================================
//
// Advanced compensation subsystem with nested scopes, LIFO
// action execution, exponential-backoff retries, and
// transaction-level lifecycle callbacks.
//
// Implements the Saga / compensation pattern for long-running
// SOA transactions, supporting:
// - Nested compensation scopes with parent-child relationships
// - LIFO (last-registered-first) action execution order
// - Per-action retry with configurable exponential backoff
// - Transaction-level lifecycle events (started/completed/failed)
// - Full compensation logging with timestamps and durations
//
// Zero external dependencies.
// ============================================================

import type {
  CompensationTransaction,
  CompensationScope,
  CompensationAction,
  CompensationScopeStatus,
  CompensationLogEntry,
} from './types';

import { generateId } from './registry';

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked when compensation starts for a transaction. */
type CompensationStartedCallback = (transactionId: string, processInstanceId: string) => void;

/** Callback invoked when compensation completes for a transaction. */
type CompensationCompletedCallback = (transactionId: string, processInstanceId: string) => void;

/** Callback invoked when compensation fails for a transaction. */
type CompensationFailedCallback = (transactionId: string, processInstanceId: string, error: string) => void;

// ── Compensation Manager ────────────────────────────────────

/**
 * Manages compensation transactions for long-running SOA processes.
 *
 * The CompensationManager implements the Saga pattern, allowing
 * forward-progressing processes to register compensating actions
 * that are executed in reverse (LIFO) order when a rollback is
 * required.
 *
 * Usage:
 * ```ts
 * const manager = new CompensationManager();
 *
 * // Register a compensation handler
 * manager.registerHandler('cancelOrder', async (data) => {
 *   await orderService.cancel(data.orderId);
 * });
 *
 * // Create a transaction for a process instance
 * const tx = manager.createTransaction('process-123');
 *
 * // Register a compensating action
 * manager.registerAction(
 *   tx.id,
 *   'root',
 *   'Cancel Order',
 *   'cancelOrder',
 *   { orderId: 'order-456' },
 * );
 *
 * // Compensate when something goes wrong
 * await manager.compensateTransaction(tx.id);
 * ```
 */
export class CompensationManager {
  /** All managed compensation transactions, keyed by transaction ID. */
  private _transactions: Map<string, CompensationTransaction> = new Map();

  /** Registered compensation handler functions, keyed by handler name. */
  private _handlers: Map<string, (data: Record<string, any>) => Promise<void>> = new Map();

  /** Callbacks fired when compensation begins on a transaction. */
  private _onCompensationStarted: CompensationStartedCallback[] = [];

  /** Callbacks fired when compensation completes successfully on a transaction. */
  private _onCompensationCompleted: CompensationCompletedCallback[] = [];

  /** Callbacks fired when compensation fails on a transaction. */
  private _onCompensationFailed: CompensationFailedCallback[] = [];

  // ── Handler Registration ──────────────────────────────────

  /**
   * Register a named compensation handler function.
   *
   * Handlers are invoked during compensation to undo the effect
   * of a previously completed action. The `data` argument carries
   * whatever context the handler needs to perform the rollback.
   *
   * @param name    - Unique handler name.
   * @param handler - Async function that performs the compensation.
   */
  registerHandler(name: string, handler: (data: Record<string, any>) => Promise<void>): void {
    this._handlers.set(name, handler);
  }

  // ── Transaction Lifecycle ─────────────────────────────────

  /**
   * Create a new compensation transaction for the given process
   * instance.
   *
   * The transaction is initialised with a root scope named `'root'`
   * and an `'active'` status.
   *
   * @param processInstanceId - The BPEL process instance this transaction tracks.
   * @returns The newly created `CompensationTransaction`.
   */
  createTransaction(processInstanceId: string): CompensationTransaction {
    const id = generateId();
    const now = new Date().toISOString();

    const rootScope: CompensationScope = {
      name: 'root',
      status: 'active' as CompensationScopeStatus,
      actions: [],
      childScopes: [],
    };

    const transaction: CompensationTransaction = {
      id,
      processInstanceId,
      rootScope: 'root',
      scopes: { root: rootScope },
      status: 'active',
      startedAt: now,
      log: [],
    };

    this._transactions.set(id, transaction);
    return transaction;
  }

  /**
   * Retrieve a compensation transaction by its ID.
   *
   * @param transactionId - The transaction ID.
   * @returns The `CompensationTransaction`, or `undefined` if not found.
   */
  getTransaction(transactionId: string): CompensationTransaction | undefined {
    return this._transactions.get(transactionId);
  }

  /**
   * Find a compensation transaction by its associated process instance ID.
   *
   * @param processInstanceId - The BPEL process instance ID.
   * @returns The matching `CompensationTransaction`, or `undefined`.
   */
  getTransactionByProcess(processInstanceId: string): CompensationTransaction | undefined {
    for (const tx of this._transactions.values()) {
      if (tx.processInstanceId === processInstanceId) {
        return tx;
      }
    }
    return undefined;
  }

  // ── Scope Management ──────────────────────────────────────

  /**
   * Begin a new compensation scope within a transaction.
   *
   * If `parentScopeName` is omitted the scope is added as a child
   * of the `'root'` scope. The parent scope's `childScopes` array
   * is updated accordingly.
   *
   * @param transactionId   - The owning transaction ID.
   * @param scopeName       - Name for the new scope.
   * @param parentScopeName - Optional parent scope (defaults to `'root'`).
   * @returns The newly created `CompensationScope`, or `undefined`
   *          if the transaction or parent scope was not found.
   */
  beginScope(
    transactionId: string,
    scopeName: string,
    parentScopeName?: string,
  ): CompensationScope | undefined {
    const tx = this._transactions.get(transactionId);
    if (!tx) return undefined;

    const parentName = parentScopeName ?? 'root';
    const parent = tx.scopes[parentName];
    if (!parent) return undefined;

    const scope: CompensationScope = {
      name: scopeName,
      parentScope: parentName,
      status: 'active' as CompensationScopeStatus,
      actions: [],
      childScopes: [],
    };

    tx.scopes[scopeName] = scope;
    parent.childScopes.push(scopeName);

    return scope;
  }

  /**
   * Mark a scope as `'completed'`.
   *
   * @param transactionId - The owning transaction ID.
   * @param scopeName     - The scope to complete.
   * @returns `true` if the scope was found and updated; `false` otherwise.
   */
  completeScope(transactionId: string, scopeName: string): boolean {
    const tx = this._transactions.get(transactionId);
    if (!tx) return false;

    const scope = tx.scopes[scopeName];
    if (!scope) return false;

    scope.status = 'completed';
    return true;
  }

  // ── Action Registration ───────────────────────────────────

  /**
   * Register a compensation action within a scope.
   *
   * Actions are stored in the scope's `actions` array. During
   * compensation they are executed in LIFO order (last registered
   * action runs first).
   *
   * @param transactionId    - The owning transaction ID.
   * @param scopeName        - The scope to register the action in.
   * @param actionName       - Human-readable action name.
   * @param handlerName      - Name of the registered handler to invoke.
   * @param compensationData - Data passed to the handler at compensation time.
   * @param originalActionId - Optional ID of the original action being compensated.
   * @returns The newly created `CompensationAction`, or `undefined`
   *          if the transaction or scope was not found.
   */
  registerAction(
    transactionId: string,
    scopeName: string,
    actionName: string,
    handlerName: string,
    compensationData: Record<string, any>,
    originalActionId?: string,
  ): CompensationAction | undefined {
    const tx = this._transactions.get(transactionId);
    if (!tx) return undefined;

    const scope = tx.scopes[scopeName];
    if (!scope) return undefined;

    const now = new Date().toISOString();
    const actionId = generateId();

    const action: CompensationAction = {
      id: actionId,
      name: actionName,
      scopeName,
      originalActionId: originalActionId ?? actionId,
      handlerName,
      compensationData,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      registeredAt: now,
    };

    scope.actions.push(action);

    // Log the registration
    const logEntry: CompensationLogEntry = {
      timestamp: now,
      scopeName,
      actionId,
      actionName,
      type: 'register',
    };
    tx.log.push(logEntry);

    return action;
  }

  // ── Compensation Execution ────────────────────────────────

  /**
   * Compensate a single scope by executing its actions in LIFO
   * order (last registered first) and then compensating all child
   * scopes.
   *
   * For each action the registered handler is invoked. If the
   * handler throws and the action's `retryCount` is below
   * `maxRetries`, the action is retried with exponential backoff
   * (base 100 ms, doubling per attempt). After exhausting retries
   * the action is marked `'failed'`.
   *
   * After all actions in the scope have been attempted, each child
   * scope is compensated recursively.
   *
   * @param transactionId - The owning transaction ID.
   * @param scopeName     - The scope to compensate.
   * @throws If the transaction or scope cannot be found.
   */
  async compensateScope(transactionId: string, scopeName: string): Promise<void> {
    const tx = this._transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const scope = tx.scopes[scopeName];
    if (!scope) {
      throw new Error(`Scope not found: ${scopeName} in transaction ${transactionId}`);
    }

    scope.status = 'compensating';

    // Execute actions in LIFO order (reverse of registration order)
    const actionsReversed = [...scope.actions].reverse();

    for (const action of actionsReversed) {
      await this._executeAction(tx, action);
    }

    // Compensate child scopes
    for (const childScopeName of scope.childScopes) {
      await this.compensateScope(transactionId, childScopeName);
    }

    // Determine final scope status based on action outcomes
    const anyFailed = scope.actions.some((a) => a.status === 'failed');
    scope.status = anyFailed ? 'failed' : 'compensated';
  }

  /**
   * Compensate an entire transaction starting from the root scope.
   *
   * Sets the transaction status to `'compensating'`, fires the
   * `onCompensationStarted` callbacks, then compensates the root
   * scope (which recursively compensates all nested scopes).
   *
   * On success the status is set to `'compensated'` and the
   * `onCompensationCompleted` callbacks fire. On failure the status
   * is set to `'failed'` and `onCompensationFailed` callbacks fire.
   *
   * @param transactionId - The transaction to compensate.
   */
  async compensateTransaction(transactionId: string): Promise<void> {
    const tx = this._transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // Mark as compensating and fire started callbacks
    tx.status = 'compensating';
    for (const cb of this._onCompensationStarted) {
      cb(tx.id, tx.processInstanceId);
    }

    try {
      await this.compensateScope(transactionId, tx.rootScope);

      // Check if any scope failed
      const anyFailed = Object.values(tx.scopes).some((s) => s.status === 'failed');

      if (anyFailed) {
        tx.status = 'failed';
        tx.completedAt = new Date().toISOString();
        for (const cb of this._onCompensationFailed) {
          cb(tx.id, tx.processInstanceId, 'One or more compensation actions failed');
        }
      } else {
        tx.status = 'compensated';
        tx.completedAt = new Date().toISOString();
        for (const cb of this._onCompensationCompleted) {
          cb(tx.id, tx.processInstanceId);
        }
      }
    } catch (err: unknown) {
      tx.status = 'failed';
      tx.completedAt = new Date().toISOString();
      const errorMessage = err instanceof Error ? err.message : String(err);
      for (const cb of this._onCompensationFailed) {
        cb(tx.id, tx.processInstanceId, errorMessage);
      }
    }
  }

  // ── Lifecycle Callbacks ───────────────────────────────────

  /**
   * Register a callback that fires when transaction compensation starts.
   *
   * @param cb - The callback function.
   */
  onCompensationStarted(cb: CompensationStartedCallback): void {
    this._onCompensationStarted.push(cb);
  }

  /**
   * Register a callback that fires when transaction compensation completes.
   *
   * @param cb - The callback function.
   */
  onCompensationCompleted(cb: CompensationCompletedCallback): void {
    this._onCompensationCompleted.push(cb);
  }

  /**
   * Register a callback that fires when transaction compensation fails.
   *
   * @param cb - The callback function.
   */
  onCompensationFailed(cb: CompensationFailedCallback): void {
    this._onCompensationFailed.push(cb);
  }

  // ── Aggregate Queries ─────────────────────────────────────

  /** Total number of compensation transactions. */
  get transactionCount(): number {
    return this._transactions.size;
  }

  /** Number of transactions with status `'active'`. */
  get activeCount(): number {
    let n = 0;
    for (const tx of this._transactions.values()) {
      if (tx.status === 'active') n++;
    }
    return n;
  }

  /** Number of transactions with status `'compensated'`. */
  get compensatedCount(): number {
    let n = 0;
    for (const tx of this._transactions.values()) {
      if (tx.status === 'compensated') n++;
    }
    return n;
  }

  /** Number of transactions with status `'failed'`. */
  get failedCount(): number {
    let n = 0;
    for (const tx of this._transactions.values()) {
      if (tx.status === 'failed') n++;
    }
    return n;
  }

  // ── Private Helpers ───────────────────────────────────────

  /**
   * Execute a single compensation action, handling retries with
   * exponential backoff on failure.
   *
   * The action status transitions through:
   * `pending` -> `executing` -> `completed` | `failed`
   *
   * On each failure, if `retryCount < maxRetries`, the action is
   * retried after a delay of `100ms * 2^retryCount`.
   */
  private async _executeAction(
    tx: CompensationTransaction,
    action: CompensationAction,
  ): Promise<void> {
    const handler = this._handlers.get(action.handlerName);
    if (!handler) {
      action.status = 'failed';
      const now = new Date().toISOString();
      action.executedAt = now;
      tx.log.push({
        timestamp: now,
        scopeName: action.scopeName,
        actionId: action.id,
        actionName: action.name,
        type: 'fail',
        error: `Handler not found: ${action.handlerName}`,
      });
      return;
    }

    let succeeded = false;

    while (!succeeded && action.retryCount <= action.maxRetries) {
      action.status = 'executing';
      const startTime = Date.now();

      // Log execution attempt
      tx.log.push({
        timestamp: new Date().toISOString(),
        scopeName: action.scopeName,
        actionId: action.id,
        actionName: action.name,
        type: action.retryCount > 0 ? 'retry' : 'execute',
      });

      try {
        await handler(action.compensationData);

        const durationMs = Date.now() - startTime;
        action.status = 'completed';
        action.executedAt = new Date().toISOString();
        succeeded = true;

        // Log completion
        tx.log.push({
          timestamp: new Date().toISOString(),
          scopeName: action.scopeName,
          actionId: action.id,
          actionName: action.name,
          type: 'complete',
          durationMs,
        });
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        action.retryCount++;

        if (action.retryCount <= action.maxRetries) {
          // Exponential backoff: 100ms * 2^(retryCount - 1)
          const delay = 100 * Math.pow(2, action.retryCount - 1);
          await this._sleep(delay);
        } else {
          // Exhausted retries — mark as failed
          action.status = 'failed';
          action.executedAt = new Date().toISOString();

          tx.log.push({
            timestamp: new Date().toISOString(),
            scopeName: action.scopeName,
            actionId: action.id,
            actionName: action.name,
            type: 'fail',
            error: errorMessage,
            durationMs,
          });
        }
      }
    }
  }

  /**
   * Sleep for the specified number of milliseconds.
   *
   * @param ms - Duration in milliseconds.
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
