// ============================================================
// SOA One ESB — Scheduled Message Delivery
// ============================================================
//
// Provides delayed and recurring message delivery:
// - One-time delayed delivery
// - Cron-like recurring schedules
// - Schedule management (pause, resume, cancel)
//
// Beyond Oracle ESB:
// - In-process scheduler (no external dependency)
// - Simple cron expression parsing
// - Per-schedule delivery limits
// - Schedule metrics
// ============================================================

import type {
  ESBMessage,
  ScheduledDelivery,
} from './types';
import { generateId } from './channel';

// ── Simple Cron Parser ────────────────────────────────────────

/**
 * Simple cron expression parser supporting:
 * - Minute (0-59)
 * - Hour (0-23)
 * - Day of Month (1-31)
 * - Month (1-12)
 * - Day of Week (0-6, 0=Sunday)
 *
 * Supported syntax: *, specific value, comma-separated lists.
 * Format: "min hour dom month dow"
 */
export function parseCronExpression(expression: string): CronSchedule {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression "${expression}": expected 5 fields (min hour dom month dow).`,
    );
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

/** Parsed cron schedule. */
export interface CronSchedule {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/** Parse a single cron field into an array of valid values. */
function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    const result: number[] = [];
    for (let i = min; i <= max; i++) result.push(i);
    return result;
  }

  // Handle */N (every N)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10);
    if (isNaN(step) || step <= 0) throw new Error(`Invalid cron step: ${field}`);
    const result: number[] = [];
    for (let i = min; i <= max; i += step) result.push(i);
    return result;
  }

  // Handle comma-separated values
  return field.split(',').map((v) => {
    const num = parseInt(v.trim(), 10);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`Invalid cron value "${v}" (range: ${min}-${max}).`);
    }
    return num;
  });
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

/**
 * Calculate the next occurrence after the given date.
 * Searches up to 366 days ahead.
 */
export function nextCronOccurrence(from: Date, schedule: CronSchedule): Date | undefined {
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1); // Start from next minute

  const maxIterations = 366 * 24 * 60; // ~1 year in minutes
  for (let i = 0; i < maxIterations; i++) {
    if (matchesCron(candidate, schedule)) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return undefined; // No occurrence found within range
}

// ── Message Scheduler ─────────────────────────────────────────

/**
 * Schedules messages for delayed or recurring delivery.
 */
export class MessageScheduler {
  private _schedules: Map<string, ScheduledDelivery> = new Map();
  private _timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _cronTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private _deliveryHandler?: (schedule: ScheduledDelivery) => Promise<void>;

  /** Set the delivery handler called when a scheduled message is due. */
  onDelivery(handler: (schedule: ScheduledDelivery) => Promise<void>): void {
    this._deliveryHandler = handler;
  }

  // ── Schedule Management ─────────────────────────────────

  /**
   * Schedule a one-time delayed message delivery.
   */
  scheduleDelayed(
    message: ESBMessage,
    destination: string,
    delayMs: number,
  ): string {
    const id = generateId();
    const deliverAt = new Date(Date.now() + delayMs).toISOString();

    const schedule: ScheduledDelivery = {
      id,
      message,
      destination,
      deliverAt,
      delayMs,
      active: true,
      maxDeliveries: 1,
      deliveryCount: 0,
    };

    this._schedules.set(id, schedule);

    // Set timer
    const timer = setTimeout(() => {
      this._executeDelivery(id);
    }, delayMs);
    this._timers.set(id, timer);

    return id;
  }

  /**
   * Schedule a recurring message delivery using a cron expression.
   */
  scheduleRecurring(
    message: ESBMessage,
    destination: string,
    cronExpression: string,
    maxDeliveries: number = 0,
  ): string {
    const id = generateId();
    const cronSchedule = parseCronExpression(cronExpression);
    const nextOccurrence = nextCronOccurrence(new Date(), cronSchedule);

    const schedule: ScheduledDelivery = {
      id,
      message,
      destination,
      cronExpression,
      active: true,
      maxDeliveries,
      deliveryCount: 0,
      nextDeliveryAt: nextOccurrence?.toISOString(),
    };

    this._schedules.set(id, schedule);

    // Check every minute for cron matches
    const interval = setInterval(() => {
      const sched = this._schedules.get(id);
      if (!sched || !sched.active) return;

      if (matchesCron(new Date(), cronSchedule)) {
        this._executeDelivery(id);
      }
    }, 60_000); // Check every minute

    this._cronTimers.set(id, interval);

    return id;
  }

  /**
   * Schedule a message for delivery at a specific time.
   */
  scheduleAt(
    message: ESBMessage,
    destination: string,
    deliverAt: Date,
  ): string {
    const delayMs = deliverAt.getTime() - Date.now();
    if (delayMs <= 0) {
      // Deliver immediately
      const id = generateId();
      const schedule: ScheduledDelivery = {
        id,
        message,
        destination,
        deliverAt: deliverAt.toISOString(),
        active: true,
        maxDeliveries: 1,
        deliveryCount: 0,
      };
      this._schedules.set(id, schedule);
      this._executeDelivery(id);
      return id;
    }

    return this.scheduleDelayed(message, destination, delayMs);
  }

  /** Cancel a scheduled delivery. */
  cancel(scheduleId: string): boolean {
    const schedule = this._schedules.get(scheduleId);
    if (!schedule) return false;

    schedule.active = false;

    const timer = this._timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(scheduleId);
    }

    const cronTimer = this._cronTimers.get(scheduleId);
    if (cronTimer) {
      clearInterval(cronTimer);
      this._cronTimers.delete(scheduleId);
    }

    return true;
  }

  /** Pause a schedule. */
  pause(scheduleId: string): boolean {
    const schedule = this._schedules.get(scheduleId);
    if (schedule) {
      schedule.active = false;
      return true;
    }
    return false;
  }

  /** Resume a paused schedule. */
  resume(scheduleId: string): boolean {
    const schedule = this._schedules.get(scheduleId);
    if (schedule) {
      schedule.active = true;
      return true;
    }
    return false;
  }

  /** Get a schedule by ID. */
  getSchedule(scheduleId: string): ScheduledDelivery | undefined {
    return this._schedules.get(scheduleId);
  }

  /** Get all schedules. */
  get schedules(): ScheduledDelivery[] {
    return Array.from(this._schedules.values());
  }

  /** Get active schedules. */
  get activeSchedules(): ScheduledDelivery[] {
    return this.schedules.filter((s) => s.active);
  }

  /** Destroy the scheduler and cancel all schedules. */
  destroy(): void {
    for (const timer of this._timers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this._cronTimers.values()) {
      clearInterval(timer);
    }
    this._timers.clear();
    this._cronTimers.clear();
    this._schedules.clear();
  }

  // ── Private ───────────────────────────────────────────────

  private async _executeDelivery(scheduleId: string): Promise<void> {
    const schedule = this._schedules.get(scheduleId);
    if (!schedule || !schedule.active) return;

    // Check max deliveries
    if (schedule.maxDeliveries !== undefined && schedule.maxDeliveries > 0 && schedule.deliveryCount >= schedule.maxDeliveries) {
      schedule.active = false;
      return;
    }

    schedule.deliveryCount++;
    schedule.lastDeliveredAt = new Date().toISOString();

    if (this._deliveryHandler) {
      try {
        await this._deliveryHandler(schedule);
      } catch {
        // Swallow delivery errors
      }
    }

    // Deactivate one-time schedules
    if (!schedule.cronExpression) {
      schedule.active = false;
    }

    // Update next delivery for cron schedules
    if (schedule.cronExpression) {
      const cronSchedule = parseCronExpression(schedule.cronExpression);
      const next = nextCronOccurrence(new Date(), cronSchedule);
      schedule.nextDeliveryAt = next?.toISOString();
    }
  }
}
