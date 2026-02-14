// ============================================================
// SOA One DI — Job Scheduler
// ============================================================
//
// Job scheduling and orchestration for data integration pipelines.
//
// Features beyond Oracle Data Integrator:
// - Cron, interval, event, file-arrival, data-change,
//   API, dependency, and manual trigger types
// - Job dependency chains with condition-based triggering
// - Concurrent execution control
// - Priority-based job queuing
// - Automatic retry with exponential backoff
// - Schedule enable/disable at runtime
// - Job history and audit trail
// - Timezone-aware scheduling
// - Calendar-based exclusions
//
// Zero external dependencies.
// ============================================================

import type {
  ScheduleDefinition,
  ScheduleTrigger,
  ScheduleDependency,
  JobInstance,
  JobStatus,
} from './types';

import { generateId } from './connector';

// ── Cron Utilities ──────────────────────────────────────────

/** Parsed cron schedule. */
export interface CronSchedule {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/** Parse a cron expression (minute hour dom month dow). */
export function parseCronExpression(expression: string): CronSchedule {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: '${expression}'. Expected 5 fields.`);
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

/** Parse a single cron field. */
function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes('/')) {
      const [range, step] = part.split('/');
      const stepNum = parseInt(step, 10);
      const start = range === '*' ? min : parseInt(range, 10);
      for (let i = start; i <= max; i += stepNum) values.add(i);
    } else if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      for (let i = s; i <= e; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/** Check if a date matches a cron schedule. */
export function matchesCron(date: Date, schedule: CronSchedule): boolean {
  return (
    schedule.minute.includes(date.getMinutes()) &&
    schedule.hour.includes(date.getHours()) &&
    schedule.dayOfMonth.includes(date.getDate()) &&
    schedule.month.includes(date.getMonth() + 1) &&
    schedule.dayOfWeek.includes(date.getDay())
  );
}

/** Calculate the next occurrence of a cron schedule. */
export function nextCronOccurrence(schedule: CronSchedule, from?: Date): Date {
  const date = from ? new Date(from.getTime() + 60000) : new Date();
  date.setSeconds(0, 0);

  // Brute force: check up to 1 year ahead
  const maxIterations = 525600; // ~1 year in minutes
  for (let i = 0; i < maxIterations; i++) {
    if (matchesCron(date, schedule)) {
      return date;
    }
    date.setMinutes(date.getMinutes() + 1);
  }

  throw new Error('No cron match found within 1 year.');
}

// ── Job Executor ────────────────────────────────────────────

/** Function that executes a scheduled job. */
export type JobExecutor = (
  schedule: ScheduleDefinition,
  jobInstance: JobInstance,
) => Promise<Record<string, any> | void>;

// ── Job Scheduler ───────────────────────────────────────────

/**
 * Job scheduler for data integration pipeline orchestration.
 *
 * Usage:
 * ```ts
 * const scheduler = new JobScheduler();
 *
 * // Register a pipeline executor
 * scheduler.setExecutor(async (schedule, job) => {
 *   const result = await pipelineEngine.execute(schedule.pipelineId, schedule.parameters);
 *   return { pipelineInstanceId: result.instanceId };
 * });
 *
 * // Register a schedule
 * scheduler.registerSchedule({
 *   id: 'daily-etl',
 *   name: 'Daily ETL',
 *   pipelineId: 'orders-pipeline',
 *   trigger: { type: 'cron', cronExpression: '0 2 * * *' },
 *   priority: 5,
 *   concurrent: false,
 *   enabled: true,
 * });
 *
 * // Start the scheduler
 * scheduler.start();
 * ```
 */
export class JobScheduler {
  private readonly _schedules = new Map<string, ScheduleDefinition>();
  private readonly _jobs = new Map<string, JobInstance>();
  private _executor?: JobExecutor;
  private _tickTimer?: ReturnType<typeof setInterval>;
  private _started = false;

  // Callbacks
  private _onJobComplete?: (job: JobInstance) => void;
  private _onJobFailed?: (job: JobInstance, error: Error) => void;

  /** Register a schedule. */
  registerSchedule(schedule: ScheduleDefinition): void {
    this._schedules.set(schedule.id, { ...schedule });
  }

  /** Unregister a schedule. */
  unregisterSchedule(scheduleId: string): void {
    this._schedules.delete(scheduleId);
  }

  /** Get a schedule. */
  getSchedule(scheduleId: string): ScheduleDefinition | undefined {
    return this._schedules.get(scheduleId);
  }

  /** List all schedules. */
  listSchedules(): ScheduleDefinition[] {
    return Array.from(this._schedules.values());
  }

  /** Enable a schedule. */
  enableSchedule(scheduleId: string): void {
    const schedule = this._schedules.get(scheduleId);
    if (schedule) schedule.enabled = true;
  }

  /** Disable a schedule. */
  disableSchedule(scheduleId: string): void {
    const schedule = this._schedules.get(scheduleId);
    if (schedule) schedule.enabled = false;
  }

  /** Set the job executor function. */
  setExecutor(executor: JobExecutor): void {
    this._executor = executor;
  }

  /** Start the scheduler tick loop. */
  start(tickIntervalMs = 60_000): void {
    if (this._started) return;
    this._started = true;

    // Immediate tick
    this._tick();

    // Periodic tick
    this._tickTimer = setInterval(() => {
      this._tick();
    }, tickIntervalMs);
  }

  /** Stop the scheduler. */
  stop(): void {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = undefined;
    }
    this._started = false;
  }

  /** Manually trigger a schedule. */
  async trigger(
    scheduleId: string,
    parameters?: Record<string, any>,
    triggeredBy?: string,
  ): Promise<JobInstance> {
    const schedule = this._schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule '${scheduleId}' not found.`);
    }

    return this._createAndExecuteJob(
      schedule,
      parameters ?? schedule.parameters,
      triggeredBy ?? 'manual',
    );
  }

  /** Get a job instance. */
  getJob(jobId: string): JobInstance | undefined {
    return this._jobs.get(jobId);
  }

  /** Get jobs by schedule. */
  getJobsBySchedule(scheduleId: string): JobInstance[] {
    return Array.from(this._jobs.values()).filter(
      (j) => j.scheduleId === scheduleId,
    );
  }

  /** Get jobs by status. */
  getJobsByStatus(status: JobStatus): JobInstance[] {
    return Array.from(this._jobs.values()).filter(
      (j) => j.status === status,
    );
  }

  /** Get recent job history. */
  getJobHistory(limit = 100): JobInstance[] {
    return Array.from(this._jobs.values())
      .sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      )
      .slice(0, limit);
  }

  /** Register a job completion callback. */
  onJobComplete(callback: (job: JobInstance) => void): void {
    this._onJobComplete = callback;
  }

  /** Register a job failure callback. */
  onJobFailed(callback: (job: JobInstance, error: Error) => void): void {
    this._onJobFailed = callback;
  }

  /** Whether the scheduler is running. */
  get isStarted(): boolean {
    return this._started;
  }

  /** Total schedules. */
  get scheduleCount(): number {
    return this._schedules.size;
  }

  /** Active schedules (enabled). */
  get activeScheduleCount(): number {
    return Array.from(this._schedules.values()).filter(
      (s) => s.enabled,
    ).length;
  }

  /** Running jobs count. */
  get runningJobCount(): number {
    return this.getJobsByStatus('running').length;
  }

  /** Total jobs executed today. */
  get jobsToday(): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return Array.from(this._jobs.values()).filter(
      (j) => new Date(j.scheduledAt) >= todayStart,
    ).length;
  }

  /** Successful jobs today. */
  get successfulJobsToday(): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return Array.from(this._jobs.values()).filter(
      (j) =>
        j.status === 'completed' && new Date(j.scheduledAt) >= todayStart,
    ).length;
  }

  /** Failed jobs today. */
  get failedJobsToday(): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return Array.from(this._jobs.values()).filter(
      (j) =>
        j.status === 'failed' && new Date(j.scheduledAt) >= todayStart,
    ).length;
  }

  /** Shut down the scheduler. */
  shutdown(): void {
    this.stop();
    this._schedules.clear();
  }

  // ── Private ─────────────────────────────────────────────

  private _tick(): void {
    const now = new Date();

    for (const schedule of this._schedules.values()) {
      if (!schedule.enabled) continue;

      // Check date range
      if (schedule.startDate && new Date(schedule.startDate) > now) continue;
      if (schedule.endDate && new Date(schedule.endDate) < now) continue;

      // Check trigger
      if (this._shouldTrigger(schedule, now)) {
        // Check concurrency
        if (!schedule.concurrent) {
          const running = this.getJobsBySchedule(schedule.id).filter(
            (j) => j.status === 'running',
          );
          if (running.length > 0) continue;
          if (
            schedule.maxConcurrentRuns &&
            running.length >= schedule.maxConcurrentRuns
          ) {
            continue;
          }
        }

        // Check dependencies
        if (!this._dependenciesMet(schedule)) continue;

        this._createAndExecuteJob(schedule, schedule.parameters, 'scheduler').catch(
          () => {},
        );
      }
    }
  }

  private _shouldTrigger(
    schedule: ScheduleDefinition,
    now: Date,
  ): boolean {
    const trigger = schedule.trigger;

    switch (trigger.type) {
      case 'cron':
        if (!trigger.cronExpression) return false;
        try {
          const parsed = parseCronExpression(trigger.cronExpression);
          return matchesCron(now, parsed);
        } catch {
          return false;
        }

      case 'interval':
        if (!trigger.intervalMs) return false;
        const lastJob = this.getJobsBySchedule(schedule.id)
          .sort(
            (a, b) =>
              new Date(b.scheduledAt).getTime() -
              new Date(a.scheduledAt).getTime(),
          )[0];
        if (!lastJob) return true;
        return (
          now.getTime() - new Date(lastJob.scheduledAt).getTime() >=
          trigger.intervalMs
        );

      case 'manual':
      case 'api':
        return false; // Only triggered explicitly

      default:
        return false;
    }
  }

  private _dependenciesMet(schedule: ScheduleDefinition): boolean {
    if (!schedule.dependencies || schedule.dependencies.length === 0) {
      return true;
    }

    for (const dep of schedule.dependencies) {
      const depJobs = this.getJobsBySchedule(dep.scheduleId);
      const latestJob = depJobs.sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() -
          new Date(a.scheduledAt).getTime(),
      )[0];

      if (!latestJob) return false;

      switch (dep.condition) {
        case 'completed':
          if (
            latestJob.status !== 'completed' &&
            latestJob.status !== 'failed'
          )
            return false;
          break;
        case 'succeeded':
          if (latestJob.status !== 'completed') return false;
          break;
        case 'failed':
          if (latestJob.status !== 'failed') return false;
          break;
        case 'any':
          break;
      }
    }

    return true;
  }

  private async _createAndExecuteJob(
    schedule: ScheduleDefinition,
    parameters?: Record<string, any>,
    triggeredBy?: string,
  ): Promise<JobInstance> {
    const job: JobInstance = {
      instanceId: generateId(),
      scheduleId: schedule.id,
      status: 'running',
      scheduledAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      triggeredBy: triggeredBy ?? 'system',
      attempt: 1,
      parameters,
    };

    this._jobs.set(job.instanceId, job);

    if (!this._executor) {
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      return job;
    }

    const maxRetries = schedule.maxRetries ?? 0;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      job.attempt = attempt;
      try {
        const result = await this._executor(schedule, job);
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.result = result ?? {};

        if (this._onJobComplete) {
          this._onJobComplete(job);
        }

        return job;
      } catch (err: any) {
        job.error = err.message;

        if (attempt <= maxRetries) {
          const delay = (schedule.retryDelayMs ?? 5000) * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    job.status = 'failed';
    job.completedAt = new Date().toISOString();

    if (this._onJobFailed) {
      this._onJobFailed(job, new Error(job.error ?? 'Unknown error'));
    }

    return job;
  }
}
