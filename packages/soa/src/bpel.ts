// ============================================================
// SOA One SOA — BPEL Process Engine
// ============================================================
//
// Full-featured BPEL (Business Process Execution Language)
// process engine supporting service orchestration with
// structured activities, fault handling, compensation,
// scoped execution, parallel flows, conditional branching,
// and loop constructs.
//
// Zero external dependencies — uses only built-in language
// features and types imported from the local module.
// ============================================================

import type {
  BPELProcessDefinition,
  BPELProcessInstance,
  BPELActivity,
  BPELActivityType,
  BPELProcessStatus,
  BPELActivityStatus,
  BPELLogEntry,
  PartnerLink,
  BPELVariable,
  CorrelationSet,
  FaultHandler,
  CompensationHandler,
  EventHandler,
  AssignCopy,
} from './types';

import { generateId } from './registry';

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked when a process instance completes successfully. */
type CompletionCallback = (instance: BPELProcessInstance) => void;

/** Callback invoked when a process instance enters a faulted state. */
type FaultedCallback = (instance: BPELProcessInstance) => void;

// ── BPELEngine ──────────────────────────────────────────────

/**
 * BPEL Process Engine.
 *
 * Manages the full lifecycle of BPEL process definitions and
 * instances: deployment, instantiation, execution of structured
 * activities (sequence, flow, if, while, scope, etc.), fault
 * handling, compensation, suspension, resumption, and termination.
 *
 * @example
 * ```ts
 * const engine = new BPELEngine();
 * engine.deployProcess(myDefinition);
 * const instance = await engine.startProcess(myDefinition.id, { orderId: '123' }, 'admin');
 * console.log(instance.status); // 'completed' | 'faulted'
 * ```
 */
export class BPELEngine {
  // ── Private State ───────────────────────────────────────────

  /** Deployed process definitions keyed by process ID. */
  private _processes: Map<string, BPELProcessDefinition> = new Map();

  /** Running / completed process instances keyed by instance ID. */
  private _instances: Map<string, BPELProcessInstance> = new Map();

  /** Callbacks invoked when a process instance completes. */
  private _onComplete: CompletionCallback[] = [];

  /** Callbacks invoked when a process instance faults. */
  private _onFaulted: FaultedCallback[] = [];

  // ── Process Definition Management ───────────────────────────

  /**
   * Deploy (register) a BPEL process definition.
   *
   * @param definition - The BPEL process definition to deploy.
   * @throws If a process with the same ID is already deployed.
   */
  deployProcess(definition: BPELProcessDefinition): void {
    if (this._processes.has(definition.id)) {
      throw new Error(`Process '${definition.id}' is already deployed`);
    }
    this._processes.set(definition.id, definition);
  }

  /**
   * Undeploy (remove) a BPEL process definition.
   *
   * @param processId - ID of the process definition to remove.
   * @throws If the process is not deployed.
   */
  undeployProcess(processId: string): void {
    if (!this._processes.has(processId)) {
      throw new Error(`Process '${processId}' is not deployed`);
    }
    this._processes.delete(processId);
  }

  /**
   * Retrieve a deployed process definition by its ID.
   *
   * @param processId - The process definition ID.
   * @returns The process definition, or `undefined` if not found.
   */
  getProcess(processId: string): BPELProcessDefinition | undefined {
    return this._processes.get(processId);
  }

  // ── Instance Lifecycle ──────────────────────────────────────

  /**
   * Start a new process instance from a deployed definition.
   *
   * Creates a fresh {@link BPELProcessInstance}, sets its status
   * to `'active'`, initialises variables from the definition
   * defaults merged with the supplied `input`, and executes the
   * root activity.  On successful completion the status is set to
   * `'completed'`; on fault it is set to `'faulted'`.
   *
   * @param processId   - ID of the deployed process definition.
   * @param input       - Initial variable values / input payload.
   * @param initiatedBy - Identity of the initiator (user / system).
   * @returns The process instance (may be completed or faulted).
   * @throws If the process definition is not deployed or not enabled.
   */
  async startProcess(
    processId: string,
    input: Record<string, any>,
    initiatedBy: string,
  ): Promise<BPELProcessInstance> {
    const definition = this._processes.get(processId);
    if (!definition) {
      throw new Error(`Process '${processId}' is not deployed`);
    }
    if (!definition.enabled) {
      throw new Error(`Process '${processId}' is not enabled`);
    }

    // Initialise variables from definition defaults then overlay input.
    const variables: Record<string, any> = {};
    for (const v of definition.variables) {
      variables[v.name] = v.initialValue !== undefined ? v.initialValue : null;
    }
    Object.assign(variables, input);

    // Create the instance.
    const instance: BPELProcessInstance = {
      instanceId: generateId(),
      processId: definition.id,
      processName: definition.name,
      status: 'active',
      currentActivityId: undefined,
      activityStatuses: {},
      variables,
      correlationValues: {},
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      initiatedBy,
      fault: undefined,
      log: [],
      metadata: {},
    };

    this._instances.set(instance.instanceId, instance);

    // Execute the root activity.
    const rootActivity = definition.activities[definition.rootActivityId];
    if (!rootActivity) {
      instance.status = 'faulted';
      instance.fault = {
        name: 'MissingRootActivity',
        message: `Root activity '${definition.rootActivityId}' not found in process definition`,
      };
      instance.completedAt = new Date().toISOString();
      this._notifyFaulted(instance);
      return instance;
    }

    try {
      await this._executeActivity(instance, rootActivity, definition);
      if (instance.status === 'active') {
        instance.status = 'completed';
        instance.completedAt = new Date().toISOString();
        this._notifyComplete(instance);
      }
    } catch (err: any) {
      // Attempt process-level fault handlers.
      const handled = await this._handleProcessFault(instance, definition, err);
      if (!handled && instance.status !== 'faulted' && instance.status !== 'terminated') {
        instance.status = 'faulted';
        instance.fault = {
          name: err?.name ?? 'UnhandledFault',
          message: err?.message ?? String(err),
        };
        instance.completedAt = new Date().toISOString();
        this._notifyFaulted(instance);
      }
    }

    return instance;
  }

  /**
   * Retrieve a process instance by its instance ID.
   *
   * @param instanceId - The instance ID.
   * @returns The instance, or `undefined` if not found.
   */
  getInstance(instanceId: string): BPELProcessInstance | undefined {
    return this._instances.get(instanceId);
  }

  /**
   * Retrieve all instances belonging to a given process definition.
   *
   * @param processId - The process definition ID.
   * @returns An array of matching instances.
   */
  getInstancesByProcess(processId: string): BPELProcessInstance[] {
    const results: BPELProcessInstance[] = [];
    for (const inst of this._instances.values()) {
      if (inst.processId === processId) {
        results.push(inst);
      }
    }
    return results;
  }

  /**
   * Retrieve all instances with a given status.
   *
   * @param status - The process status to filter by.
   * @returns An array of matching instances.
   */
  getInstancesByStatus(status: BPELProcessStatus): BPELProcessInstance[] {
    const results: BPELProcessInstance[] = [];
    for (const inst of this._instances.values()) {
      if (inst.status === status) {
        results.push(inst);
      }
    }
    return results;
  }

  /**
   * Suspend a running (active) process instance.
   *
   * @param instanceId - The instance ID to suspend.
   * @throws If the instance does not exist or is not active.
   */
  async suspendInstance(instanceId: string): Promise<void> {
    const instance = this._instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    if (instance.status !== 'active') {
      throw new Error(
        `Cannot suspend instance '${instanceId}': current status is '${instance.status}'`,
      );
    }
    instance.status = 'suspended';
  }

  /**
   * Resume a previously suspended process instance.
   *
   * @param instanceId - The instance ID to resume.
   * @throws If the instance does not exist or is not suspended.
   */
  async resumeInstance(instanceId: string): Promise<void> {
    const instance = this._instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    if (instance.status !== 'suspended') {
      throw new Error(
        `Cannot resume instance '${instanceId}': current status is '${instance.status}'`,
      );
    }
    instance.status = 'active';
  }

  /**
   * Terminate a process instance.
   *
   * The instance is immediately set to `'terminated'` regardless
   * of its current status (as long as it is not already completed,
   * faulted, or terminated).
   *
   * @param instanceId - The instance ID to terminate.
   * @throws If the instance does not exist or is already in a final state.
   */
  async terminateInstance(instanceId: string): Promise<void> {
    const instance = this._instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    const finalStates: BPELProcessStatus[] = ['completed', 'faulted', 'terminated'];
    if (finalStates.includes(instance.status)) {
      throw new Error(
        `Cannot terminate instance '${instanceId}': current status is '${instance.status}'`,
      );
    }
    instance.status = 'terminated';
    instance.completedAt = new Date().toISOString();
  }

  /**
   * Trigger compensation for a completed or faulted instance.
   *
   * Walks through the instance's executed scopes in reverse order
   * and invokes their compensation handlers.
   *
   * @param instanceId - The instance ID to compensate.
   * @throws If the instance does not exist or is not in a compensatable state.
   */
  async compensateInstance(instanceId: string): Promise<void> {
    const instance = this._instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    const compensatableStates: BPELProcessStatus[] = ['completed', 'faulted'];
    if (!compensatableStates.includes(instance.status)) {
      throw new Error(
        `Cannot compensate instance '${instanceId}': current status is '${instance.status}'`,
      );
    }

    const definition = this._processes.get(instance.processId);
    if (!definition) {
      throw new Error(`Process definition '${instance.processId}' not found for compensation`);
    }

    instance.status = 'compensating';

    try {
      // Collect scope activities that were completed and have compensation handlers.
      const completedScopes: BPELActivity[] = [];
      for (const [actId, actStatus] of Object.entries(instance.activityStatuses)) {
        if (actStatus === 'completed') {
          const activity = definition.activities[actId];
          if (activity && activity.type === 'scope' && activity.compensationHandler) {
            completedScopes.push(activity);
          }
        }
      }

      // Execute compensation in reverse order (LIFO).
      for (let i = completedScopes.length - 1; i >= 0; i--) {
        const scope = completedScopes[i];
        const handler = scope.compensationHandler!;
        const compensationActivity = definition.activities[handler.activityId];
        if (compensationActivity) {
          await this._executeActivity(instance, compensationActivity, definition);
        }
      }

      // Also execute process-level compensation handler if present.
      if (definition.compensationHandler) {
        const compActivity = definition.activities[definition.compensationHandler.activityId];
        if (compActivity) {
          await this._executeActivity(instance, compActivity, definition);
        }
      }

      instance.status = 'compensated';
      instance.completedAt = new Date().toISOString();
    } catch (err: any) {
      instance.status = 'faulted';
      instance.fault = {
        name: 'CompensationFault',
        message: err?.message ?? String(err),
      };
      instance.completedAt = new Date().toISOString();
      this._notifyFaulted(instance);
    }
  }

  // ── Activity Execution ──────────────────────────────────────

  /**
   * Execute a single BPEL activity within a process instance.
   *
   * Dispatches to specialised handlers based on the activity type.
   * Records execution timing and logs each activity's start/end.
   *
   * @param instance   - The process instance context.
   * @param activity   - The activity to execute.
   * @param definition - The process definition (for resolving child activities).
   */
  private async _executeActivity(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    // Skip execution when the instance is suspended or terminated.
    if (instance.status === 'suspended' || instance.status === 'terminated') {
      return;
    }

    instance.currentActivityId = activity.id;
    instance.activityStatuses[activity.id] = 'executing';
    const startTime = Date.now();

    try {
      switch (activity.type) {
        case 'sequence':
          await this._executeSequence(instance, activity, definition);
          break;

        case 'flow':
          await this._executeFlow(instance, activity, definition);
          break;

        case 'if':
          await this._executeIf(instance, activity, definition);
          break;

        case 'while':
          await this._executeWhile(instance, activity, definition);
          break;

        case 'invoke':
          await this._executeInvoke(instance, activity, definition);
          break;

        case 'assign':
          await this._executeAssign(instance, activity);
          break;

        case 'wait':
          await this._executeWait(activity);
          break;

        case 'throw':
          this._executeThrow(instance, activity);
          break;

        case 'scope':
          await this._executeScope(instance, activity, definition);
          break;

        case 'empty':
          // No-op activity — nothing to execute.
          break;

        case 'exit':
          instance.status = 'terminated';
          instance.completedAt = new Date().toISOString();
          break;

        case 'receive':
          await this._executeReceive(instance, activity);
          break;

        case 'reply':
          await this._executeReply(instance, activity);
          break;

        case 'repeatUntil':
          await this._executeRepeatUntil(instance, activity, definition);
          break;

        case 'forEach':
          await this._executeForEach(instance, activity, definition);
          break;

        case 'pick':
          await this._executePick(instance, activity, definition);
          break;

        case 'compensate':
        case 'compensateScope':
          await this._executeCompensateScope(instance, activity, definition);
          break;

        case 'rethrow':
          this._executeRethrow(instance);
          break;

        case 'validate':
          // Validation is a no-op in this simulation engine.
          break;

        default:
          throw new Error(`Unsupported activity type: '${activity.type}'`);
      }

      // Mark completed unless the activity itself changed status.
      if (instance.activityStatuses[activity.id] === 'executing') {
        instance.activityStatuses[activity.id] = 'completed';
      }

      const durationMs = Date.now() - startTime;
      this._addLogEntry(
        instance,
        activity.id,
        activity.name,
        activity.type,
        'completed',
        durationMs,
      );
    } catch (err: any) {
      instance.activityStatuses[activity.id] = 'faulted';
      const durationMs = Date.now() - startTime;
      this._addLogEntry(
        instance,
        activity.id,
        activity.name,
        activity.type,
        'faulted',
        durationMs,
        err?.message ?? String(err),
      );
      throw err;
    }
  }

  // ── Structured Activity Handlers ────────────────────────────

  /**
   * Execute a sequence activity — children run in order.
   */
  private async _executeSequence(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    if (!activity.children || activity.children.length === 0) return;

    for (const childId of activity.children) {
      if (instance.status === 'suspended' || instance.status === 'terminated') break;

      const child = definition.activities[childId];
      if (!child) {
        throw new Error(`Child activity '${childId}' not found in sequence '${activity.id}'`);
      }
      await this._executeActivity(instance, child, definition);
    }
  }

  /**
   * Execute a flow activity — children run in parallel.
   */
  private async _executeFlow(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    if (!activity.children || activity.children.length === 0) return;

    const childActivities: BPELActivity[] = [];
    for (const childId of activity.children) {
      const child = definition.activities[childId];
      if (!child) {
        throw new Error(`Child activity '${childId}' not found in flow '${activity.id}'`);
      }
      childActivities.push(child);
    }

    await Promise.all(
      childActivities.map((child) => this._executeActivity(instance, child, definition)),
    );
  }

  /**
   * Execute an if activity — evaluate condition, run matching branch.
   */
  private async _executeIf(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    const conditionResult = this._evaluateCondition(
      activity.condition ?? 'false',
      instance.variables,
    );

    if (conditionResult) {
      // Execute the "then" branch (first child).
      if (activity.children && activity.children.length > 0) {
        const thenChild = definition.activities[activity.children[0]];
        if (thenChild) {
          await this._executeActivity(instance, thenChild, definition);
        }
      }
    } else if (activity.elseActivity) {
      // Execute the "else" branch.
      const elseChild = definition.activities[activity.elseActivity];
      if (elseChild) {
        await this._executeActivity(instance, elseChild, definition);
      }
    }
  }

  /**
   * Execute a while activity — loop while condition is true.
   */
  private async _executeWhile(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    const maxIterations = 10_000; // Safety guard against infinite loops.
    let iterations = 0;

    while (this._evaluateCondition(activity.condition ?? 'false', instance.variables)) {
      if (instance.status === 'suspended' || instance.status === 'terminated') break;
      if (++iterations > maxIterations) {
        throw new Error(
          `While loop '${activity.id}' exceeded maximum iterations (${maxIterations})`,
        );
      }

      if (activity.children && activity.children.length > 0) {
        for (const childId of activity.children) {
          const child = definition.activities[childId];
          if (child) {
            await this._executeActivity(instance, child, definition);
          }
        }
      }
    }
  }

  /**
   * Execute a repeatUntil activity — execute body then check condition.
   */
  private async _executeRepeatUntil(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    const maxIterations = 10_000;
    let iterations = 0;

    do {
      if (instance.status === 'suspended' || instance.status === 'terminated') break;
      if (++iterations > maxIterations) {
        throw new Error(
          `RepeatUntil loop '${activity.id}' exceeded maximum iterations (${maxIterations})`,
        );
      }

      if (activity.children && activity.children.length > 0) {
        for (const childId of activity.children) {
          const child = definition.activities[childId];
          if (child) {
            await this._executeActivity(instance, child, definition);
          }
        }
      }
    } while (!this._evaluateCondition(activity.condition ?? 'true', instance.variables));
  }

  /**
   * Execute a forEach activity — iterate over a range.
   */
  private async _executeForEach(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    const start = activity.startValue ?? 0;
    const end = activity.endValue ?? 0;
    const counterVar = activity.counterVariable ?? '__counter';

    if (activity.parallel && activity.children && activity.children.length > 0) {
      // Parallel forEach: execute all iterations concurrently.
      const promises: Promise<void>[] = [];
      for (let i = start; i <= end; i++) {
        instance.variables[counterVar] = i;
        for (const childId of activity.children) {
          const child = definition.activities[childId];
          if (child) {
            promises.push(this._executeActivity(instance, child, definition));
          }
        }
      }
      await Promise.all(promises);
    } else {
      // Sequential forEach.
      for (let i = start; i <= end; i++) {
        if (instance.status === 'suspended' || instance.status === 'terminated') break;
        instance.variables[counterVar] = i;
        if (activity.children && activity.children.length > 0) {
          for (const childId of activity.children) {
            const child = definition.activities[childId];
            if (child) {
              await this._executeActivity(instance, child, definition);
            }
          }
        }
      }
    }
  }

  // ── Basic Activity Handlers ─────────────────────────────────

  /**
   * Execute an invoke activity — simulate a service invocation.
   *
   * Records the invocation in the instance log including the
   * partner link, operation, and input/output variable references.
   */
  private async _executeInvoke(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    const inputData = activity.inputVariable
      ? instance.variables[activity.inputVariable]
      : undefined;

    // Simulate invocation by recording details in the log.
    this._addLogEntry(instance, activity.id, activity.name, 'invoke', 'executing', undefined);

    // If the activity has an output variable, simulate a response.
    if (activity.outputVariable) {
      instance.variables[activity.outputVariable] = {
        _simulated: true,
        partnerLink: activity.partnerLink,
        operation: activity.operation,
        input: inputData,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a receive activity — simulate receiving a message.
   */
  private async _executeReceive(
    instance: BPELProcessInstance,
    activity: BPELActivity,
  ): Promise<void> {
    // Simulate message receipt by recording in the log.
    if (activity.outputVariable && !(activity.outputVariable in instance.variables)) {
      instance.variables[activity.outputVariable] = {
        _simulated: true,
        partnerLink: activity.partnerLink,
        operation: activity.operation,
        receivedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a reply activity — simulate sending a reply message.
   */
  private async _executeReply(
    instance: BPELProcessInstance,
    activity: BPELActivity,
  ): Promise<void> {
    // Simulate reply by recording the response variable.
    const replyData = activity.inputVariable
      ? instance.variables[activity.inputVariable]
      : undefined;

    this._addLogEntry(instance, activity.id, activity.name, 'reply', 'executing', undefined);

    // No state mutation needed — the reply is "sent" as a side effect.
    void replyData;
  }

  /**
   * Execute an assign activity — copy values between variables.
   */
  private async _executeAssign(
    instance: BPELProcessInstance,
    activity: BPELActivity,
  ): Promise<void> {
    if (!activity.copies || activity.copies.length === 0) return;

    for (const copy of activity.copies) {
      let value: any;

      switch (copy.fromType) {
        case 'literal':
          value = copy.from;
          break;

        case 'variable':
          value = this._resolveVariablePath(instance.variables, copy.from);
          break;

        case 'expression':
          value = this._evaluateExpression(copy.from, instance.variables);
          break;

        default:
          value = copy.from;
      }

      this._setVariablePath(instance.variables, copy.to, value);
    }
  }

  /**
   * Execute a wait activity — delay for the specified duration.
   */
  private async _executeWait(activity: BPELActivity): Promise<void> {
    let delayMs = 0;

    if (activity.waitDurationMs !== undefined && activity.waitDurationMs > 0) {
      delayMs = activity.waitDurationMs;
    } else if (activity.waitDeadline) {
      const deadlineTime = new Date(activity.waitDeadline).getTime();
      const now = Date.now();
      delayMs = Math.max(0, deadlineTime - now);
    }

    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Execute a throw activity — raise a BPEL fault.
   */
  private _executeThrow(instance: BPELProcessInstance, activity: BPELActivity): never {
    const faultName = activity.faultName ?? 'UnnamedFault';
    const faultData = activity.faultVariable
      ? instance.variables[activity.faultVariable]
      : undefined;

    instance.fault = {
      name: faultName,
      message: `Fault thrown by activity '${activity.name}'`,
      data: faultData,
    };

    const error = new Error(`BPEL Fault: ${faultName}`);
    (error as any).faultName = faultName;
    (error as any).faultData = faultData;
    throw error;
  }

  /**
   * Execute a rethrow activity — re-raise the current fault.
   */
  private _executeRethrow(instance: BPELProcessInstance): never {
    const fault = instance.fault;
    const error = new Error(
      fault ? `BPEL Fault (rethrown): ${fault.name}` : 'BPEL Fault: no active fault to rethrow',
    );
    if (fault) {
      (error as any).faultName = fault.name;
      (error as any).faultData = fault.data;
    }
    throw error;
  }

  /**
   * Execute a pick activity — select the first matching event handler.
   *
   * In this simulation, message events are immediately matched and
   * alarm events are simulated by their duration.
   */
  private async _executePick(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    if (!activity.eventHandlers || activity.eventHandlers.length === 0) return;

    // In simulation mode, execute the first available event handler.
    const handler = activity.eventHandlers[0];
    const handlerActivity = definition.activities[handler.activityId];
    if (handlerActivity) {
      await this._executeActivity(instance, handlerActivity, definition);
    }
  }

  /**
   * Execute a scope activity — execute children with fault and
   * compensation handler support.
   */
  private async _executeScope(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    try {
      if (activity.children && activity.children.length > 0) {
        for (const childId of activity.children) {
          if (instance.status === 'suspended' || instance.status === 'terminated') break;

          const child = definition.activities[childId];
          if (!child) {
            throw new Error(`Child activity '${childId}' not found in scope '${activity.id}'`);
          }
          await this._executeActivity(instance, child, definition);
        }
      }
    } catch (err: any) {
      // Attempt to handle the fault with scope-level fault handlers.
      const handled = await this._handleScopeFault(instance, activity, definition, err);
      if (!handled) {
        throw err;
      }
    }
  }

  /**
   * Execute a compensate / compensateScope activity.
   *
   * Triggers compensation for a specific scope or all completed scopes.
   */
  private async _executeCompensateScope(
    instance: BPELProcessInstance,
    activity: BPELActivity,
    definition: BPELProcessDefinition,
  ): Promise<void> {
    if (activity.targetScope) {
      // Compensate a specific scope.
      for (const [actId, actStatus] of Object.entries(instance.activityStatuses)) {
        if (actStatus === 'completed') {
          const act = definition.activities[actId];
          if (
            act &&
            act.type === 'scope' &&
            act.name === activity.targetScope &&
            act.compensationHandler
          ) {
            const compActivity = definition.activities[act.compensationHandler.activityId];
            if (compActivity) {
              instance.activityStatuses[actId] = 'compensating';
              await this._executeActivity(instance, compActivity, definition);
              instance.activityStatuses[actId] = 'compensated';
            }
          }
        }
      }
    } else {
      // Compensate all completed scopes in reverse order.
      const scopeIds = Object.keys(instance.activityStatuses).filter((actId) => {
        const act = definition.activities[actId];
        return (
          act &&
          act.type === 'scope' &&
          instance.activityStatuses[actId] === 'completed' &&
          act.compensationHandler
        );
      });

      for (let i = scopeIds.length - 1; i >= 0; i--) {
        const act = definition.activities[scopeIds[i]];
        if (act?.compensationHandler) {
          const compActivity = definition.activities[act.compensationHandler.activityId];
          if (compActivity) {
            instance.activityStatuses[scopeIds[i]] = 'compensating';
            await this._executeActivity(instance, compActivity, definition);
            instance.activityStatuses[scopeIds[i]] = 'compensated';
          }
        }
      }
    }
  }

  // ── Fault Handling ──────────────────────────────────────────

  /**
   * Attempt to handle a fault using scope-level fault handlers.
   *
   * @returns `true` if the fault was handled, `false` otherwise.
   */
  private async _handleScopeFault(
    instance: BPELProcessInstance,
    scopeActivity: BPELActivity,
    definition: BPELProcessDefinition,
    err: any,
  ): Promise<boolean> {
    if (!scopeActivity.faultHandlers || scopeActivity.faultHandlers.length === 0) {
      return false;
    }

    const faultName: string = (err as any).faultName ?? err?.name ?? 'UnknownFault';

    // Find a matching handler: exact match first, then catch-all.
    let matchedHandler: FaultHandler | undefined;
    for (const handler of scopeActivity.faultHandlers) {
      if (handler.faultName === faultName) {
        matchedHandler = handler;
        break;
      }
    }
    if (!matchedHandler) {
      for (const handler of scopeActivity.faultHandlers) {
        if (handler.faultName === '*') {
          matchedHandler = handler;
          break;
        }
      }
    }

    if (!matchedHandler) return false;

    // Set fault variable if specified.
    if (matchedHandler.faultVariable) {
      instance.variables[matchedHandler.faultVariable] = {
        name: faultName,
        message: err?.message ?? String(err),
        data: (err as any).faultData,
      };
    }

    const handlerActivity = definition.activities[matchedHandler.activityId];
    if (handlerActivity) {
      await this._executeActivity(instance, handlerActivity, definition);
    }

    // Clear the fault since it has been handled.
    instance.fault = undefined;
    return true;
  }

  /**
   * Attempt to handle a fault using process-level fault handlers.
   *
   * @returns `true` if the fault was handled, `false` otherwise.
   */
  private async _handleProcessFault(
    instance: BPELProcessInstance,
    definition: BPELProcessDefinition,
    err: any,
  ): Promise<boolean> {
    if (!definition.faultHandlers || definition.faultHandlers.length === 0) {
      return false;
    }

    const faultName: string = (err as any).faultName ?? err?.name ?? 'UnknownFault';

    let matchedHandler: FaultHandler | undefined;
    for (const handler of definition.faultHandlers) {
      if (handler.faultName === faultName) {
        matchedHandler = handler;
        break;
      }
    }
    if (!matchedHandler) {
      for (const handler of definition.faultHandlers) {
        if (handler.faultName === '*') {
          matchedHandler = handler;
          break;
        }
      }
    }

    if (!matchedHandler) return false;

    if (matchedHandler.faultVariable) {
      instance.variables[matchedHandler.faultVariable] = {
        name: faultName,
        message: err?.message ?? String(err),
        data: (err as any).faultData,
      };
    }

    const handlerActivity = definition.activities[matchedHandler.activityId];
    if (handlerActivity) {
      try {
        await this._executeActivity(instance, handlerActivity, definition);
        instance.fault = undefined;
        instance.status = 'completed';
        instance.completedAt = new Date().toISOString();
        this._notifyComplete(instance);
        return true;
      } catch {
        // Fault handler itself faulted — fall through.
        return false;
      }
    }

    return false;
  }

  // ── Condition Evaluation ────────────────────────────────────

  /**
   * Evaluate a simple condition expression against instance variables.
   *
   * Supports:
   * - Boolean literals: `'true'`, `'false'`
   * - Comparison operators: `==`, `!=`, `>`, `<`, `>=`, `<=`
   * - Logical operators: `&&`, `||`
   * - Variable references by name (resolved from the variables map)
   * - Numeric and string literal comparisons
   *
   * @param expression - The condition expression string.
   * @param variables  - The variable context for evaluation.
   * @returns The boolean result of the condition.
   */
  private _evaluateCondition(expression: string, variables: Record<string, any>): boolean {
    const trimmed = expression.trim();

    // Boolean literals.
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Logical OR (lowest precedence) — split on top-level '||'.
    const orParts = this._splitLogical(trimmed, '||');
    if (orParts.length > 1) {
      return orParts.some((part) => this._evaluateCondition(part, variables));
    }

    // Logical AND.
    const andParts = this._splitLogical(trimmed, '&&');
    if (andParts.length > 1) {
      return andParts.every((part) => this._evaluateCondition(part, variables));
    }

    // Comparison operators (ordered by length to match >= before >).
    const operators = ['>=', '<=', '!=', '==', '>', '<'] as const;
    for (const op of operators) {
      const idx = trimmed.indexOf(op);
      if (idx !== -1) {
        const left = this._resolveValue(trimmed.substring(0, idx).trim(), variables);
        const right = this._resolveValue(trimmed.substring(idx + op.length).trim(), variables);
        return this._compare(left, right, op);
      }
    }

    // Treat as a variable reference — truthy check.
    const val = this._resolveValue(trimmed, variables);
    return Boolean(val);
  }

  /**
   * Split a condition string on a logical operator, respecting
   * parenthesisation depth so that nested expressions are not
   * incorrectly split.
   */
  private _splitLogical(expr: string, operator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (ch === '(') {
        depth++;
        current += ch;
      } else if (ch === ')') {
        depth--;
        current += ch;
      } else if (depth === 0 && expr.substring(i, i + operator.length) === operator) {
        parts.push(current);
        current = '';
        i += operator.length - 1; // Skip operator characters.
      } else {
        current += ch;
      }
    }
    parts.push(current);

    return parts.length > 1 ? parts : [expr];
  }

  /**
   * Resolve a value token — could be a numeric literal, quoted
   * string literal, boolean literal, or a variable reference.
   */
  private _resolveValue(token: string, variables: Record<string, any>): any {
    const t = token.trim();

    // Boolean literals.
    if (t === 'true') return true;
    if (t === 'false') return false;

    // Null / undefined literals.
    if (t === 'null') return null;
    if (t === 'undefined') return undefined;

    // Numeric literals.
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      return Number(t);
    }

    // Quoted string literals (single or double quotes).
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
      return t.slice(1, -1);
    }

    // Variable reference (dot-notation supported).
    return this._resolveVariablePath(variables, t);
  }

  /**
   * Compare two values using the specified operator.
   */
  private _compare(left: any, right: any, operator: string): boolean {
    switch (operator) {
      case '==':
        return left == right; // eslint-disable-line eqeqeq
      case '!=':
        return left != right; // eslint-disable-line eqeqeq
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      default:
        return false;
    }
  }

  // ── Variable Helpers ────────────────────────────────────────

  /**
   * Resolve a dot-notation path against a variables map.
   *
   * @param variables - The root variables object.
   * @param path      - Dot-separated path (e.g. `"order.amount"`).
   * @returns The resolved value, or `undefined` if the path is invalid.
   */
  private _resolveVariablePath(variables: Record<string, any>, path: string): any {
    if (!path) return undefined;
    const parts = path.split('.');
    let current: any = variables;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Set a value at a dot-notation path within a variables map.
   *
   * Intermediate objects are created as needed.
   *
   * @param variables - The root variables object.
   * @param path      - Dot-separated path.
   * @param value     - The value to set.
   */
  private _setVariablePath(variables: Record<string, any>, path: string, value: any): void {
    if (!path) return;
    const parts = path.split('.');
    let current: any = variables;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || current[parts[i]] === null) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Evaluate a simple arithmetic / string expression against variables.
   *
   * Supports basic operations for assign copy expressions.
   *
   * @param expression - The expression string.
   * @param variables  - The variable context.
   * @returns The evaluated result.
   */
  private _evaluateExpression(expression: string, variables: Record<string, any>): any {
    const trimmed = expression.trim();

    // Attempt numeric evaluation for simple arithmetic.
    // Replace variable references with their values.
    let resolved = trimmed;
    const varRefPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
    let match: RegExpExecArray | null;

    // Collect all variable references.
    const refs: Array<{ ref: string; start: number; end: number }> = [];
    while ((match = varRefPattern.exec(trimmed)) !== null) {
      refs.push({ ref: match[0], start: match.index, end: match.index + match[0].length });
    }

    // Replace in reverse order to preserve indices.
    for (let i = refs.length - 1; i >= 0; i--) {
      const ref = refs[i];
      // Skip known keywords.
      if (['true', 'false', 'null', 'undefined'].includes(ref.ref)) continue;
      const val = this._resolveVariablePath(variables, ref.ref);
      if (val !== undefined) {
        const replacement = typeof val === 'string' ? `"${val}"` : String(val);
        resolved =
          resolved.substring(0, ref.start) + replacement + resolved.substring(ref.end);
      }
    }

    // If the resolved expression is purely numeric or a simple operation, evaluate it.
    try {
      // Only allow safe numeric expressions (digits, operators, spaces, parens, dots).
      if (/^[\d\s+\-*/%().]+$/.test(resolved)) {
        return Function(`"use strict"; return (${resolved})`)();
      }
    } catch {
      // Fall through — return the resolved string.
    }

    // Return the resolved string as-is.
    return resolved;
  }

  // ── Logging ─────────────────────────────────────────────────

  /**
   * Append a log entry to a process instance's execution log.
   *
   * @param instance     - The process instance.
   * @param activityId   - ID of the activity being logged.
   * @param activityName - Human-readable activity name.
   * @param activityType - The BPEL activity type.
   * @param status       - Execution status of the activity.
   * @param durationMs   - Optional execution duration in milliseconds.
   * @param error        - Optional error message.
   */
  private _addLogEntry(
    instance: BPELProcessInstance,
    activityId: string,
    activityName: string,
    activityType: BPELActivityType,
    status: BPELActivityStatus,
    durationMs?: number,
    error?: string,
  ): void {
    const entry: BPELLogEntry = {
      timestamp: new Date().toISOString(),
      activityId,
      activityName,
      activityType,
      status,
      durationMs,
      error,
    };
    instance.log.push(entry);
  }

  // ── Callback Registration ───────────────────────────────────

  /**
   * Register a callback that fires when a process instance completes.
   *
   * @param callback - The completion callback.
   */
  onComplete(callback: CompletionCallback): void {
    this._onComplete.push(callback);
  }

  /**
   * Register a callback that fires when a process instance faults.
   *
   * @param callback - The fault callback.
   */
  onFaulted(callback: FaultedCallback): void {
    this._onFaulted.push(callback);
  }

  // ── Notification Helpers ────────────────────────────────────

  /**
   * Notify all registered completion callbacks.
   */
  private _notifyComplete(instance: BPELProcessInstance): void {
    for (const cb of this._onComplete) {
      try {
        cb(instance);
      } catch {
        // Swallow errors in callbacks to avoid disrupting the engine.
      }
    }
  }

  /**
   * Notify all registered fault callbacks.
   */
  private _notifyFaulted(instance: BPELProcessInstance): void {
    for (const cb of this._onFaulted) {
      try {
        cb(instance);
      } catch {
        // Swallow errors in callbacks to avoid disrupting the engine.
      }
    }
  }

  // ── Computed Properties ─────────────────────────────────────

  /** All deployed process definitions. */
  get allProcesses(): BPELProcessDefinition[] {
    return Array.from(this._processes.values());
  }

  /** Total number of deployed process definitions. */
  get processCount(): number {
    return this._processes.size;
  }

  /** Total number of process instances (all statuses). */
  get instanceCount(): number {
    return this._instances.size;
  }

  /** Number of currently active process instances. */
  get activeCount(): number {
    let count = 0;
    for (const inst of this._instances.values()) {
      if (inst.status === 'active') count++;
    }
    return count;
  }
}
