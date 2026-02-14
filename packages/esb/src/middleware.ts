// ============================================================
// SOA One ESB — Middleware Pipeline
// ============================================================
//
// Express-style middleware pipeline for message processing.
// Each middleware can inspect, modify, or reject messages
// as they flow through the bus.
//
// Beyond Oracle ESB:
// - Composable middleware chain with next() pattern
// - Conditional middleware (only runs on matching messages)
// - Error-handling middleware
// - Middleware groups for reusable chains
// - Metrics per middleware
// ============================================================

import type {
  ESBMessage,
  MiddlewareContext,
  MiddlewareFunction,
  MiddlewareDefinition,
  Route,
  SecurityContext,
} from './types';

// ── Middleware Pipeline ───────────────────────────────────────

/**
 * Executes an ordered chain of middleware functions on messages
 * using the Express-style next() pattern.
 */
export class MiddlewarePipeline {
  private _middleware: MiddlewareDefinition[] = [];
  private _errorHandlers: Array<{
    name: string;
    handler: (error: Error, ctx: MiddlewareContext) => Promise<void>;
  }> = [];

  // Metrics
  private _executionCounts: Map<string, number> = new Map();
  private _executionTimes: Map<string, number[]> = new Map();

  // ── Registration ──────────────────────────────────────────

  /**
   * Add a middleware to the pipeline.
   * Middleware are executed in order (lowest order number first).
   */
  use(definition: MiddlewareDefinition): void {
    this._middleware.push(definition);
    this._middleware.sort((a, b) => a.order - b.order);
  }

  /**
   * Add a named middleware function with default options.
   */
  add(
    name: string,
    handler: MiddlewareFunction,
    order: number = this._middleware.length,
  ): void {
    this.use({ name, handler, order, enabled: true });
  }

  /**
   * Add an error-handling middleware.
   * Error handlers run when a middleware throws.
   */
  useErrorHandler(
    name: string,
    handler: (error: Error, ctx: MiddlewareContext) => Promise<void>,
  ): void {
    this._errorHandlers.push({ name, handler });
  }

  /** Remove a middleware by name. */
  remove(name: string): boolean {
    const idx = this._middleware.findIndex((m) => m.name === name);
    if (idx >= 0) {
      this._middleware.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Enable a middleware by name. */
  enable(name: string): boolean {
    const mw = this._middleware.find((m) => m.name === name);
    if (mw) {
      mw.enabled = true;
      return true;
    }
    return false;
  }

  /** Disable a middleware by name. */
  disable(name: string): boolean {
    const mw = this._middleware.find((m) => m.name === name);
    if (mw) {
      mw.enabled = false;
      return true;
    }
    return false;
  }

  /** Get all registered middleware names. */
  get middlewareNames(): string[] {
    return this._middleware.map((m) => m.name);
  }

  // ── Execution ─────────────────────────────────────────────

  /**
   * Execute the middleware pipeline on a message.
   * Returns the (potentially modified) middleware context.
   */
  async execute(
    message: ESBMessage,
    options: {
      route?: Route;
      sourceChannel?: string;
      destinationChannel?: string;
      security?: SecurityContext;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<MiddlewareContext> {
    const ctx: MiddlewareContext = {
      message,
      metadata: options.metadata ?? {},
      route: options.route,
      sourceChannel: options.sourceChannel,
      destinationChannel: options.destinationChannel,
      startTime: Date.now(),
      abort: false,
      security: options.security,
    };

    const enabledMiddleware = this._middleware.filter((m) => m.enabled);

    try {
      await this._runChain(enabledMiddleware, 0, ctx);
    } catch (error: any) {
      // Run error handlers
      for (const errorHandler of this._errorHandlers) {
        try {
          await errorHandler.handler(error, ctx);
        } catch {
          // Swallow error handler failures
        }
      }

      // If no error handlers or none resolved the issue, rethrow
      if (!ctx.abort) {
        ctx.abort = true;
        ctx.abortReason = error.message;
      }
    }

    return ctx;
  }

  /** Get execution metrics per middleware. */
  get metrics(): Record<string, { executionCount: number; averageTimeMs: number }> {
    const result: Record<string, { executionCount: number; averageTimeMs: number }> = {};

    for (const [name, count] of this._executionCounts) {
      const times = this._executionTimes.get(name) ?? [];
      const avg = times.length > 0
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 0;
      result[name] = {
        executionCount: count,
        averageTimeMs: Math.round(avg * 100) / 100,
      };
    }

    return result;
  }

  /** Reset all metrics. */
  resetMetrics(): void {
    this._executionCounts.clear();
    this._executionTimes.clear();
  }

  /** Clear all middleware. */
  clear(): void {
    this._middleware = [];
    this._errorHandlers = [];
  }

  // ── Private ───────────────────────────────────────────────

  private async _runChain(
    middleware: MiddlewareDefinition[],
    index: number,
    ctx: MiddlewareContext,
  ): Promise<void> {
    if (ctx.abort || index >= middleware.length) return;

    const mw = middleware[index];
    const start = Date.now();

    // Track execution count
    this._executionCounts.set(
      mw.name,
      (this._executionCounts.get(mw.name) ?? 0) + 1,
    );

    await mw.handler(ctx, async () => {
      // Track time
      const elapsed = Date.now() - start;
      const times = this._executionTimes.get(mw.name) ?? [];
      times.push(elapsed);
      if (times.length > 100) times.shift(); // Keep last 100
      this._executionTimes.set(mw.name, times);

      await this._runChain(middleware, index + 1, ctx);
    });
  }
}

// ── Built-in Middleware ───────────────────────────────────────

/**
 * Logging middleware: logs message processing.
 */
export function createLoggingMiddleware(
  logger: (message: string, data?: any) => void = console.log,
): MiddlewareDefinition {
  return {
    name: 'logging',
    order: 0,
    enabled: true,
    handler: async (ctx, next) => {
      logger(`[ESB] Processing message ${ctx.message.id}`, {
        type: ctx.message.headers.messageType,
        source: ctx.sourceChannel,
        destination: ctx.destinationChannel,
      });
      const start = Date.now();
      await next();
      logger(`[ESB] Completed message ${ctx.message.id} in ${Date.now() - start}ms`);
    },
  };
}

/**
 * Correlation middleware: ensures all messages have correlation IDs.
 */
export function createCorrelationMiddleware(): MiddlewareDefinition {
  let counter = 0;
  return {
    name: 'correlation',
    order: 1,
    enabled: true,
    handler: async (ctx, next) => {
      if (!ctx.message.correlationId) {
        ctx.message.correlationId = `corr-${Date.now()}-${++counter}`;
      }
      if (!ctx.message.headers.correlationId) {
        ctx.message.headers.correlationId = ctx.message.correlationId;
      }
      await next();
    },
  };
}

/**
 * Breadcrumb middleware: tracks the path a message takes through services.
 */
export function createBreadcrumbMiddleware(
  serviceName: string,
): MiddlewareDefinition {
  return {
    name: 'breadcrumb',
    order: 2,
    enabled: true,
    handler: async (ctx, next) => {
      const existing = ctx.message.headers.breadcrumb ?? '';
      ctx.message.headers.breadcrumb = existing
        ? `${existing} > ${serviceName}`
        : serviceName;
      await next();
    },
  };
}

/**
 * Validation middleware: validates messages against size limits.
 */
export function createSizeLimitMiddleware(
  maxSizeBytes: number,
): MiddlewareDefinition {
  return {
    name: 'size-limit',
    order: 3,
    enabled: true,
    handler: async (ctx, next) => {
      const bodySize = JSON.stringify(ctx.message.body).length;
      if (bodySize > maxSizeBytes) {
        ctx.abort = true;
        ctx.abortReason = `Message body exceeds size limit: ${bodySize} > ${maxSizeBytes} bytes`;
        return;
      }
      await next();
    },
  };
}

/**
 * Timestamp middleware: adds processing timestamps.
 */
export function createTimestampMiddleware(): MiddlewareDefinition {
  return {
    name: 'timestamp',
    order: 4,
    enabled: true,
    handler: async (ctx, next) => {
      ctx.metadata.processingStartTime = new Date().toISOString();
      await next();
      ctx.metadata.processingEndTime = new Date().toISOString();
      ctx.metadata.processingDurationMs = Date.now() - ctx.startTime;
    },
  };
}

/**
 * Security context middleware: propagates auth context.
 */
export function createSecurityMiddleware(
  validator?: (ctx: MiddlewareContext) => boolean,
): MiddlewareDefinition {
  return {
    name: 'security',
    order: -1, // Run early
    enabled: true,
    handler: async (ctx, next) => {
      if (validator && !validator(ctx)) {
        ctx.abort = true;
        ctx.abortReason = 'Security validation failed';
        return;
      }

      // Propagate security context to message headers
      if (ctx.security) {
        if (ctx.security.tenantId) {
          ctx.message.headers.tenantId = ctx.security.tenantId;
        }
        if (ctx.security.principal) {
          ctx.metadata.principal = ctx.security.principal;
        }
      }

      await next();
    },
  };
}
