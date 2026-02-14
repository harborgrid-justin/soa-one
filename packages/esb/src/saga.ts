// ============================================================
// SOA One ESB — Saga Coordinator
// ============================================================
//
// Implements the Saga pattern for distributed transactions.
// Coordinates multi-step business processes with compensating
// transactions for rollback on failure.
//
// Beyond Oracle ESB (which uses BPEL transactions):
// - Saga pattern with automatic compensation
// - Step dependency graphs
// - Parallel step execution where dependencies allow
// - Per-step timeout and retry policies
// - Saga instance persistence and recovery
// - Detailed execution logging
// ============================================================

import type {
  SagaDefinition,
  SagaStepDefinition,
  SagaInstance,
  SagaContext,
  SagaStatus,
  SagaStepStatus,
  SagaLogEntry,
  RetryPolicy,
} from './types';
import { generateId } from './channel';
import { RetryExecutor } from './resilience';

// ── Saga Step Handler Types ───────────────────────────────────

/** Function that executes a saga step's forward action. */
export type SagaStepExecutor = (context: SagaContext) => Promise<any>;

/** Function that compensates (rolls back) a saga step. */
export type SagaStepCompensator = (context: SagaContext) => Promise<void>;

/** A registered saga step with its handlers. */
export interface SagaStepRegistration {
  definition: SagaStepDefinition;
  execute: SagaStepExecutor;
  compensate: SagaStepCompensator;
}

// ── Saga Coordinator ──────────────────────────────────────────

/**
 * Orchestrates multi-step distributed transactions using the
 * Saga pattern. Each step has an execute and compensate handler.
 * On failure, previously completed steps are compensated in
 * reverse order.
 */
export class SagaCoordinator {
  private _definitions: Map<string, SagaDefinition> = new Map();
  private _stepHandlers: Map<string, Map<string, SagaStepRegistration>> = new Map();
  private _instances: Map<string, SagaInstance> = new Map();
  private _onComplete?: (instance: SagaInstance) => void;
  private _onFailed?: (instance: SagaInstance, error: Error) => void;

  // ── Registration ──────────────────────────────────────────

  /**
   * Register a saga definition with its step handlers.
   */
  registerSaga(
    definition: SagaDefinition,
    stepHandlers: Record<
      string,
      { execute: SagaStepExecutor; compensate: SagaStepCompensator }
    >,
  ): void {
    this._definitions.set(definition.id, definition);

    const handlers = new Map<string, SagaStepRegistration>();
    for (const step of definition.steps) {
      const handler = stepHandlers[step.name];
      if (!handler) {
        throw new Error(
          `Missing handlers for saga step "${step.name}" in saga "${definition.id}".`,
        );
      }
      handlers.set(step.name, {
        definition: step,
        execute: handler.execute,
        compensate: handler.compensate,
      });
    }

    this._stepHandlers.set(definition.id, handlers);
  }

  /** Unregister a saga by ID. */
  unregisterSaga(sagaId: string): boolean {
    this._definitions.delete(sagaId);
    this._stepHandlers.delete(sagaId);
    return true;
  }

  /** Set completion handler. */
  onComplete(handler: (instance: SagaInstance) => void): void {
    this._onComplete = handler;
  }

  /** Set failure handler. */
  onFailed(handler: (instance: SagaInstance, error: Error) => void): void {
    this._onFailed = handler;
  }

  // ── Execution ─────────────────────────────────────────────

  /**
   * Start a new saga instance.
   * Returns the saga instance with final status.
   */
  async execute(
    sagaId: string,
    initialData: Record<string, any> = {},
    metadata: Record<string, any> = {},
  ): Promise<SagaInstance> {
    const definition = this._definitions.get(sagaId);
    if (!definition) {
      throw new Error(`Saga "${sagaId}" is not registered.`);
    }

    const handlers = this._stepHandlers.get(sagaId)!;
    const instanceId = generateId();

    const context: SagaContext = {
      sagaId: instanceId,
      correlationId: generateId(),
      data: { ...initialData },
      metadata: { ...metadata },
      stepResults: {},
    };

    const instance: SagaInstance = {
      instanceId,
      sagaId: definition.id,
      sagaName: definition.name,
      status: 'running',
      currentStep: 0,
      stepStatuses: {},
      context,
      startedAt: new Date().toISOString(),
      log: [],
    };

    // Initialize step statuses
    for (const step of definition.steps) {
      instance.stepStatuses[step.name] = 'pending';
    }

    this._instances.set(instanceId, instance);

    // Set saga-level timeout
    let sagaTimer: ReturnType<typeof setTimeout> | undefined;
    const sagaPromise = this._executeSteps(definition, handlers, instance);

    if (definition.timeoutMs) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        sagaTimer = setTimeout(() => {
          reject(new Error(`Saga "${definition.name}" timed out after ${definition.timeoutMs}ms.`));
        }, definition.timeoutMs);
      });

      try {
        await Promise.race([sagaPromise, timeoutPromise]);
      } catch (error: any) {
        if (sagaTimer) clearTimeout(sagaTimer);
        if (instance.status === 'running') {
          await this._compensate(definition, handlers, instance, error);
        }
        return instance;
      }

      if (sagaTimer) clearTimeout(sagaTimer);
    } else {
      await sagaPromise;
    }

    return instance;
  }

  /** Get a saga instance by ID. */
  getInstance(instanceId: string): SagaInstance | undefined {
    return this._instances.get(instanceId);
  }

  /** Get all saga instances. */
  get instances(): SagaInstance[] {
    return Array.from(this._instances.values());
  }

  /** Get instances by status. */
  getInstancesByStatus(status: SagaStatus): SagaInstance[] {
    return this.instances.filter((i) => i.status === status);
  }

  /** Get all registered saga definitions. */
  get definitions(): SagaDefinition[] {
    return Array.from(this._definitions.values());
  }

  // ── Private: Step Execution ───────────────────────────────

  private async _executeSteps(
    definition: SagaDefinition,
    handlers: Map<string, SagaStepRegistration>,
    instance: SagaInstance,
  ): Promise<void> {
    const completedSteps: string[] = [];

    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      const handler = handlers.get(step.name)!;
      instance.currentStep = i;

      // Check dependencies
      if (step.dependsOn) {
        const depsComplete = step.dependsOn.every(
          (dep) => instance.stepStatuses[dep] === 'completed',
        );
        if (!depsComplete) {
          this._logStep(instance, step.name, 'skip', 'started');
          this._logStep(instance, step.name, 'skip', 'completed');
          continue;
        }
      }

      instance.stepStatuses[step.name] = 'executing';
      this._logStep(instance, step.name, 'execute', 'started');

      const stepStart = Date.now();

      try {
        let result: any;

        // Execute with retry if configured
        if (step.retryPolicy) {
          const retryExecutor = new RetryExecutor(step.retryPolicy);
          result = await retryExecutor.execute(() => handler.execute(instance.context));
        } else if (step.timeoutMs) {
          // Execute with timeout
          result = await Promise.race([
            handler.execute(instance.context),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Step "${step.name}" timed out.`)),
                step.timeoutMs,
              ),
            ),
          ]);
        } else {
          result = await handler.execute(instance.context);
        }

        // Store step result
        instance.context.stepResults[step.name] = result;
        if (result !== undefined && typeof result === 'object') {
          Object.assign(instance.context.data, result);
        }

        instance.stepStatuses[step.name] = 'completed';
        completedSteps.push(step.name);

        this._logStep(instance, step.name, 'execute', 'completed', undefined, Date.now() - stepStart);
      } catch (error: any) {
        instance.stepStatuses[step.name] = 'failed';
        this._logStep(instance, step.name, 'execute', 'failed', error.message, Date.now() - stepStart);

        // Compensate completed steps in reverse
        await this._compensate(definition, handlers, instance, error);
        return;
      }
    }

    // All steps completed
    instance.status = 'completed';
    instance.completedAt = new Date().toISOString();

    if (this._onComplete) {
      this._onComplete(instance);
    }
  }

  // ── Private: Compensation ─────────────────────────────────

  private async _compensate(
    definition: SagaDefinition,
    handlers: Map<string, SagaStepRegistration>,
    instance: SagaInstance,
    originalError: Error,
  ): Promise<void> {
    instance.status = 'compensating';
    instance.error = originalError.message;

    // Get completed steps in reverse order
    const completedStepNames = definition.steps
      .filter((s) => instance.stepStatuses[s.name] === 'completed')
      .map((s) => s.name)
      .reverse();

    for (const stepName of completedStepNames) {
      const handler = handlers.get(stepName)!;
      instance.stepStatuses[stepName] = 'compensating';
      this._logStep(instance, stepName, 'compensate', 'started');

      const compensateStart = Date.now();

      try {
        await handler.compensate(instance.context);
        instance.stepStatuses[stepName] = 'compensated';
        this._logStep(instance, stepName, 'compensate', 'completed', undefined, Date.now() - compensateStart);
      } catch (compensateError: any) {
        instance.stepStatuses[stepName] = 'failed';
        this._logStep(instance, stepName, 'compensate', 'failed', compensateError.message, Date.now() - compensateStart);
        // Continue compensating remaining steps even if one fails
      }
    }

    // Check if all compensations succeeded
    const allCompensated = completedStepNames.every(
      (name) => instance.stepStatuses[name] === 'compensated',
    );

    instance.status = allCompensated ? 'compensated' : 'failed';
    instance.completedAt = new Date().toISOString();

    if (this._onFailed) {
      this._onFailed(instance, originalError);
    }
  }

  // ── Private: Logging ──────────────────────────────────────

  private _logStep(
    instance: SagaInstance,
    stepName: string,
    action: 'execute' | 'compensate' | 'skip',
    status: 'started' | 'completed' | 'failed',
    error?: string,
    durationMs?: number,
  ): void {
    const entry: SagaLogEntry = {
      timestamp: new Date().toISOString(),
      stepName,
      action,
      status,
      error,
      durationMs,
    };
    instance.log.push(entry);
  }
}
