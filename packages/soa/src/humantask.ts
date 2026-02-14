// ============================================================
// SOA One SOA — Human Task Manager
// ============================================================
//
// Provides a full-featured human task engine with task lifecycle
// management, claiming, delegation, escalation, comments,
// attachments, and SLA tracking.
//
// Surpasses Oracle SOA Suite Human Task Service with:
// - Delegation chains with full audit trail
// - Automatic due-date and expiration tracking
// - Escalation count management with event hooks
// - Rich comment and attachment management
// - Overdue and expired task detection
// - Fine-grained lifecycle callbacks (created, claimed,
//   completed, delegated, escalated)
// ============================================================

import type {
  HumanTaskDefinition,
  HumanTaskInstance,
  HumanTaskStatus,
  TaskPriority,
  AssignmentType,
  EscalationRule,
  EscalationType,
  TaskOutcome,
  TaskComment,
  TaskAttachment,
} from './types';

import { generateId } from './registry';

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked when a task is created. */
export type TaskCreatedCallback = (task: HumanTaskInstance) => void;

/** Callback invoked when a task is claimed. */
export type TaskClaimedCallback = (task: HumanTaskInstance, userId: string) => void;

/** Callback invoked when a task is completed. */
export type TaskCompletedCallback = (task: HumanTaskInstance) => void;

/** Callback invoked when a task is delegated. */
export type TaskDelegatedCallback = (task: HumanTaskInstance, fromUser: string, toUser: string) => void;

/** Callback invoked when a task is escalated. */
export type TaskEscalatedCallback = (task: HumanTaskInstance) => void;

// ── Human Task Manager ──────────────────────────────────────

/**
 * Human task engine providing full task lifecycle management
 * including creation, claiming, delegation, escalation,
 * comments, attachments, and SLA tracking.
 */
export class HumanTaskManager {
  /** Registered task definitions keyed by definition ID. */
  private _definitions: Map<string, HumanTaskDefinition> = new Map();

  /** Active task instances keyed by instance ID. */
  private _instances: Map<string, HumanTaskInstance> = new Map();

  /** Callbacks fired when a task is created. */
  private _onCreated: TaskCreatedCallback[] = [];

  /** Callbacks fired when a task is claimed. */
  private _onClaimed: TaskClaimedCallback[] = [];

  /** Callbacks fired when a task is completed. */
  private _onCompleted: TaskCompletedCallback[] = [];

  /** Callbacks fired when a task is delegated. */
  private _onDelegated: TaskDelegatedCallback[] = [];

  /** Callbacks fired when a task is escalated. */
  private _onEscalated: TaskEscalatedCallback[] = [];

  // ── Definition Management ───────────────────────────────

  /**
   * Register a human task definition.
   * @param def - The task definition to register.
   */
  registerDefinition(def: HumanTaskDefinition): void {
    this._definitions.set(def.id, def);
  }

  /**
   * Retrieve a task definition by its ID.
   * @param definitionId - The definition ID.
   * @returns The task definition, or undefined if not found.
   */
  getDefinition(definitionId: string): HumanTaskDefinition | undefined {
    const def = this._definitions.get(definitionId);
    return def ? { ...def } : undefined;
  }

  // ── Task Creation ─────────────────────────────────────────

  /**
   * Create a new human task instance from a registered definition.
   *
   * The task is created with status `'created'`, then immediately
   * transitioned to `'ready'`. Due dates and expiration dates are
   * computed from the definition if configured.
   *
   * @param definitionId - The task definition ID.
   * @param input - Input data for the task.
   * @param processInstanceId - Optional linked BPEL process instance ID.
   * @param activityId - Optional linked BPEL activity ID.
   * @returns The newly created task instance.
   */
  createTask(
    definitionId: string,
    input: Record<string, any>,
    processInstanceId?: string,
    activityId?: string,
  ): HumanTaskInstance {
    const def = this._definitions.get(definitionId);
    if (!def) {
      throw new Error(`Task definition not found: ${definitionId}`);
    }

    const now = new Date();
    const nowISO = now.toISOString();

    const instance: HumanTaskInstance = {
      instanceId: generateId(),
      taskDefinitionId: definitionId,
      name: def.name,
      status: 'created',
      priority: def.priority,
      potentialOwners: [...def.potentialOwners],
      input: { ...input },
      output: {},
      comments: [],
      attachments: [],
      delegationChain: [],
      createdAt: nowISO,
      escalationCount: 0,
      metadata: {},
    };

    // Apply due date from definition
    if (def.dueDateMs !== undefined) {
      const dueDate = new Date(now.getTime() + def.dueDateMs);
      instance.dueDate = dueDate.toISOString();
    }

    // Apply expiration date from definition
    if (def.expirationMs !== undefined) {
      const expirationDate = new Date(now.getTime() + def.expirationMs);
      instance.expirationDate = expirationDate.toISOString();
    }

    // Link to BPEL process if provided
    if (processInstanceId !== undefined) {
      instance.processInstanceId = processInstanceId;
    }
    if (activityId !== undefined) {
      instance.activityId = activityId;
    }

    // Transition from 'created' to 'ready'
    instance.status = 'ready';

    this._instances.set(instance.instanceId, instance);

    // Fire created callbacks
    for (const cb of this._onCreated) {
      cb(instance);
    }

    return { ...instance };
  }

  // ── Task Retrieval ────────────────────────────────────────

  /**
   * Retrieve a task instance by its ID.
   * @param instanceId - The task instance ID.
   * @returns The task instance, or undefined if not found.
   */
  getTask(instanceId: string): HumanTaskInstance | undefined {
    const task = this._instances.get(instanceId);
    return task ? { ...task } : undefined;
  }

  /**
   * Retrieve all task instances with a given status.
   * @param status - The task status to filter by.
   * @returns Array of matching task instances.
   */
  getTasksByStatus(status: HumanTaskStatus): HumanTaskInstance[] {
    const results: HumanTaskInstance[] = [];
    for (const task of this._instances.values()) {
      if (task.status === status) {
        results.push({ ...task });
      }
    }
    return results;
  }

  /**
   * Retrieve all tasks owned by a specific user.
   * @param owner - The user ID of the task owner.
   * @returns Array of tasks owned by the user.
   */
  getTasksByOwner(owner: string): HumanTaskInstance[] {
    const results: HumanTaskInstance[] = [];
    for (const task of this._instances.values()) {
      if (task.actualOwner === owner) {
        results.push({ ...task });
      }
    }
    return results;
  }

  /**
   * Retrieve all tasks where a user is a potential owner and
   * the task is in `'ready'` status (available to claim).
   * @param user - The user ID to match against potential owners.
   * @returns Array of claimable tasks for the user.
   */
  getTasksByPotentialOwner(user: string): HumanTaskInstance[] {
    const results: HumanTaskInstance[] = [];
    for (const task of this._instances.values()) {
      if (task.status === 'ready' && task.potentialOwners.includes(user)) {
        results.push({ ...task });
      }
    }
    return results;
  }

  // ── Task Lifecycle ────────────────────────────────────────

  /**
   * Claim a ready task for a specific user.
   *
   * Transitions the task from `'ready'` to `'reserved'` and
   * assigns the actual owner.
   *
   * @param instanceId - The task instance ID.
   * @param userId - The user claiming the task.
   * @returns The updated task instance.
   */
  claimTask(instanceId: string, userId: string): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }
    if (task.status !== 'ready') {
      throw new Error(`Cannot claim task in status '${task.status}'; expected 'ready'`);
    }

    task.status = 'reserved';
    task.actualOwner = userId;
    task.claimedAt = new Date().toISOString();

    // Fire claimed callbacks
    for (const cb of this._onClaimed) {
      cb(task, userId);
    }

    return { ...task };
  }

  /**
   * Start working on a reserved task.
   *
   * Transitions the task from `'reserved'` to `'in-progress'`.
   *
   * @param instanceId - The task instance ID.
   * @param userId - The user starting the task (must be actual owner).
   * @returns The updated task instance.
   */
  startTask(instanceId: string, userId: string): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }
    if (task.status !== 'reserved') {
      throw new Error(`Cannot start task in status '${task.status}'; expected 'reserved'`);
    }
    if (task.actualOwner !== userId) {
      throw new Error(`User '${userId}' is not the actual owner of task '${instanceId}'`);
    }

    task.status = 'in-progress';

    return { ...task };
  }

  /**
   * Complete a task with output data and an outcome.
   *
   * Transitions the task from `'in-progress'` to `'completed'`.
   *
   * @param instanceId - The task instance ID.
   * @param userId - The user completing the task (must be actual owner).
   * @param output - The task output data.
   * @param outcome - The selected outcome name.
   * @returns The updated task instance.
   */
  completeTask(
    instanceId: string,
    userId: string,
    output: Record<string, any>,
    outcome: string,
  ): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }
    if (task.status !== 'in-progress') {
      throw new Error(`Cannot complete task in status '${task.status}'; expected 'in-progress'`);
    }
    if (task.actualOwner !== userId) {
      throw new Error(`User '${userId}' is not the actual owner of task '${instanceId}'`);
    }

    task.status = 'completed';
    task.output = { ...output };
    task.outcome = outcome;
    task.completedAt = new Date().toISOString();

    // Fire completed callbacks
    for (const cb of this._onCompleted) {
      cb(task);
    }

    return { ...task };
  }

  /**
   * Mark a task as failed.
   *
   * Transitions the task from `'in-progress'` to `'failed'`.
   *
   * @param instanceId - The task instance ID.
   * @param userId - The user failing the task (must be actual owner).
   * @param reason - The reason for failure.
   * @returns The updated task instance.
   */
  failTask(
    instanceId: string,
    userId: string,
    reason: string,
  ): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }
    if (task.status !== 'in-progress') {
      throw new Error(`Cannot fail task in status '${task.status}'; expected 'in-progress'`);
    }
    if (task.actualOwner !== userId) {
      throw new Error(`User '${userId}' is not the actual owner of task '${instanceId}'`);
    }

    task.status = 'failed';
    task.metadata.failureReason = reason;
    task.completedAt = new Date().toISOString();

    return { ...task };
  }

  /**
   * Delegate a task to another user.
   *
   * Records the delegation in the delegation chain and transfers
   * ownership to the target user. The task moves to `'reserved'`
   * status with the new owner.
   *
   * @param instanceId - The task instance ID.
   * @param fromUser - The user delegating the task.
   * @param toUser - The user receiving the delegation.
   * @returns The updated task instance.
   */
  delegateTask(
    instanceId: string,
    fromUser: string,
    toUser: string,
  ): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }
    if (task.actualOwner !== fromUser) {
      throw new Error(`User '${fromUser}' is not the actual owner of task '${instanceId}'`);
    }

    // Track the delegation
    task.delegationChain.push(fromUser);
    task.actualOwner = toUser;
    task.status = 'reserved';

    // Fire delegated callbacks
    for (const cb of this._onDelegated) {
      cb(task, fromUser, toUser);
    }

    return { ...task };
  }

  /**
   * Suspend a task.
   *
   * Transitions the task to `'suspended'` status. Only tasks that
   * are in `'ready'`, `'reserved'`, or `'in-progress'` can be suspended.
   *
   * @param instanceId - The task instance ID.
   * @returns The updated task instance.
   */
  suspendTask(instanceId: string): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }

    const suspendable: HumanTaskStatus[] = ['ready', 'reserved', 'in-progress'];
    if (!suspendable.includes(task.status)) {
      throw new Error(`Cannot suspend task in status '${task.status}'`);
    }

    task.metadata.previousStatus = task.status;
    task.status = 'suspended';

    return { ...task };
  }

  /**
   * Resume a suspended task.
   *
   * Restores the task to its previous status before suspension.
   *
   * @param instanceId - The task instance ID.
   * @returns The updated task instance.
   */
  resumeTask(instanceId: string): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }
    if (task.status !== 'suspended') {
      throw new Error(`Cannot resume task in status '${task.status}'; expected 'suspended'`);
    }

    const previousStatus = task.metadata.previousStatus as HumanTaskStatus | undefined;
    task.status = previousStatus ?? 'ready';
    delete task.metadata.previousStatus;

    return { ...task };
  }

  // ── Comments & Attachments ────────────────────────────────

  /**
   * Add a comment to a task instance.
   *
   * Generates a unique comment ID and timestamps the comment.
   *
   * @param instanceId - The task instance ID.
   * @param author - The comment author user ID.
   * @param text - The comment text.
   * @returns The newly created comment.
   */
  addComment(instanceId: string, author: string, text: string): TaskComment {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }

    const comment: TaskComment = {
      id: generateId(),
      author,
      text,
      createdAt: new Date().toISOString(),
    };

    task.comments.push(comment);

    return { ...comment };
  }

  /**
   * Add an attachment to a task instance.
   *
   * @param instanceId - The task instance ID.
   * @param name - The attachment name.
   * @param mimeType - The MIME type of the attachment.
   * @param content - The attachment content (base64 or text).
   * @param addedBy - The user adding the attachment.
   * @returns The newly created attachment.
   */
  addAttachment(
    instanceId: string,
    name: string,
    mimeType: string,
    content: string,
    addedBy: string,
  ): TaskAttachment {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }

    const attachment: TaskAttachment = {
      id: generateId(),
      name,
      mimeType,
      content,
      addedBy,
      addedAt: new Date().toISOString(),
    };

    task.attachments.push(attachment);

    return { ...attachment };
  }

  // ── Escalation ────────────────────────────────────────────

  /**
   * Escalate a task by incrementing its escalation count
   * and firing escalation callbacks.
   *
   * @param instanceId - The task instance ID.
   * @returns The updated task instance.
   */
  escalateTask(instanceId: string): HumanTaskInstance {
    const task = this._instances.get(instanceId);
    if (!task) {
      throw new Error(`Task instance not found: ${instanceId}`);
    }

    task.escalationCount += 1;

    // Fire escalated callbacks
    for (const cb of this._onEscalated) {
      cb(task);
    }

    return { ...task };
  }

  // ── Overdue & Expired Detection ───────────────────────────

  /**
   * Retrieve all tasks whose due date has passed and whose
   * status is not `'completed'` or `'failed'`.
   *
   * @returns Array of overdue task instances.
   */
  getOverdueTasks(): HumanTaskInstance[] {
    const now = new Date();
    const results: HumanTaskInstance[] = [];
    const terminalStatuses: HumanTaskStatus[] = ['completed', 'failed'];

    for (const task of this._instances.values()) {
      if (terminalStatuses.includes(task.status)) continue;
      if (task.dueDate && new Date(task.dueDate) < now) {
        results.push({ ...task });
      }
    }

    return results;
  }

  /**
   * Retrieve all tasks whose expiration date has passed.
   *
   * @returns Array of expired task instances.
   */
  getExpiredTasks(): HumanTaskInstance[] {
    const now = new Date();
    const results: HumanTaskInstance[] = [];

    for (const task of this._instances.values()) {
      if (task.expirationDate && new Date(task.expirationDate) < now) {
        results.push({ ...task });
      }
    }

    return results;
  }

  // ── Event Callbacks ───────────────────────────────────────

  /**
   * Register a callback to be invoked when a task is created.
   * @param callback - The callback function.
   */
  onCreated(callback: TaskCreatedCallback): void {
    this._onCreated.push(callback);
  }

  /**
   * Register a callback to be invoked when a task is claimed.
   * @param callback - The callback function.
   */
  onClaimed(callback: TaskClaimedCallback): void {
    this._onClaimed.push(callback);
  }

  /**
   * Register a callback to be invoked when a task is completed.
   * @param callback - The callback function.
   */
  onCompleted(callback: TaskCompletedCallback): void {
    this._onCompleted.push(callback);
  }

  /**
   * Register a callback to be invoked when a task is delegated.
   * @param callback - The callback function.
   */
  onDelegated(callback: TaskDelegatedCallback): void {
    this._onDelegated.push(callback);
  }

  /**
   * Register a callback to be invoked when a task is escalated.
   * @param callback - The callback function.
   */
  onEscalated(callback: TaskEscalatedCallback): void {
    this._onEscalated.push(callback);
  }

  // ── Metrics ───────────────────────────────────────────────

  /** Total number of registered task definitions. */
  get definitionCount(): number {
    return this._definitions.size;
  }

  /** Total number of task instances. */
  get instanceCount(): number {
    return this._instances.size;
  }

  /** Number of tasks in `'ready'` or `'reserved'` status (pending work). */
  get pendingCount(): number {
    let count = 0;
    for (const task of this._instances.values()) {
      if (task.status === 'ready' || task.status === 'reserved') {
        count++;
      }
    }
    return count;
  }

  /** Number of tasks currently in progress. */
  get inProgressCount(): number {
    let count = 0;
    for (const task of this._instances.values()) {
      if (task.status === 'in-progress') {
        count++;
      }
    }
    return count;
  }

  /** Number of completed tasks. */
  get completedCount(): number {
    let count = 0;
    for (const task of this._instances.values()) {
      if (task.status === 'completed') {
        count++;
      }
    }
    return count;
  }

  /** Number of overdue tasks (due date passed, not completed or failed). */
  get overdueCount(): number {
    return this.getOverdueTasks().length;
  }
}
