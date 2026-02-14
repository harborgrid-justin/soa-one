// ============================================================
// SOA One ESB — Resilience Patterns
// ============================================================
//
// Production-grade resilience patterns for service communication:
//   - Circuit Breaker: prevent cascading failures
//   - Retry with exponential backoff + jitter
//   - Bulkhead: concurrency isolation
//   - Timeout: execution time limits
//   - Rate Limiter: throughput control
//
// All patterns beyond Oracle ESB (which only has basic retry):
//   - Circuit breaker with half-open probe
//   - Bulkhead pattern for concurrency limits
//   - Token bucket and sliding window rate limiters
//   - Composable: wrap any async operation
// ============================================================

import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  RetryPolicy,
  BulkheadConfig,
  TimeoutConfig,
  RateLimiterConfig,
} from './types';

// ── Circuit Breaker ───────────────────────────────────────────

/**
 * Circuit breaker that prevents cascading failures by stopping
 * calls to a failing service and allowing periodic probes.
 *
 * States:
 *   - closed: all calls pass through
 *   - open: all calls are rejected immediately
 *   - half-open: limited probe calls are allowed
 */
export class CircuitBreaker {
  private readonly _config: CircuitBreakerConfig;
  private _state: CircuitBreakerState = 'closed';
  private _failureCount = 0;
  private _successCount = 0;
  private _halfOpenCalls = 0;
  private _lastFailureTime = 0;
  private _lastStateChangeTime = Date.now();

  // Metrics
  private _totalCalls = 0;
  private _totalFailures = 0;
  private _totalSuccesses = 0;
  private _totalRejections = 0;

  /** Event listener for state changes. */
  private _onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;

  constructor(config: CircuitBreakerConfig) {
    this._config = config;
  }

  /** Set a state change listener. */
  onStateChange(handler: (from: CircuitBreakerState, to: CircuitBreakerState) => void): void {
    this._onStateChange = handler;
  }

  /**
   * Execute an operation through the circuit breaker.
   * Throws if the circuit is open.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this._totalCalls++;

    // Check if we should transition from open to half-open
    if (this._state === 'open') {
      if (Date.now() - this._lastFailureTime >= this._config.resetTimeoutMs) {
        this._transitionTo('half-open');
      } else {
        this._totalRejections++;
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open. Retry after ${this._config.resetTimeoutMs}ms.`,
        );
      }
    }

    // In half-open, limit concurrent calls
    if (this._state === 'half-open') {
      if (this._halfOpenCalls >= this._config.halfOpenMaxCalls) {
        this._totalRejections++;
        throw new CircuitBreakerOpenError(
          'Circuit breaker is half-open and max probe calls reached.',
        );
      }
      this._halfOpenCalls++;
    }

    try {
      const result = await operation();
      this._recordSuccess();
      return result;
    } catch (error: any) {
      if (this._shouldCountAsFailure(error)) {
        this._recordFailure();
      }
      throw error;
    }
  }

  /** Get the current state. */
  get state(): CircuitBreakerState {
    // Check for automatic transition from open to half-open
    if (
      this._state === 'open' &&
      Date.now() - this._lastFailureTime >= this._config.resetTimeoutMs
    ) {
      this._transitionTo('half-open');
    }
    return this._state;
  }

  /** Reset the circuit breaker to closed state. */
  reset(): void {
    this._transitionTo('closed');
    this._failureCount = 0;
    this._successCount = 0;
    this._halfOpenCalls = 0;
  }

  /** Get circuit breaker metrics. */
  get metrics() {
    return {
      state: this._state,
      failureCount: this._failureCount,
      successCount: this._successCount,
      totalCalls: this._totalCalls,
      totalFailures: this._totalFailures,
      totalSuccesses: this._totalSuccesses,
      totalRejections: this._totalRejections,
      lastStateChangeTime: this._lastStateChangeTime,
      lastFailureTime: this._lastFailureTime,
    };
  }

  private _recordSuccess(): void {
    this._totalSuccesses++;

    if (this._state === 'half-open') {
      this._successCount++;
      if (this._successCount >= this._config.successThreshold) {
        this._transitionTo('closed');
      }
    } else if (this._state === 'closed') {
      this._failureCount = 0; // Reset on success
    }
  }

  private _recordFailure(): void {
    this._totalFailures++;
    this._lastFailureTime = Date.now();

    if (this._state === 'half-open') {
      this._transitionTo('open');
    } else if (this._state === 'closed') {
      this._failureCount++;
      if (this._failureCount >= this._config.failureThreshold) {
        this._transitionTo('open');
      }
    }
  }

  private _shouldCountAsFailure(error: any): boolean {
    const errorCode = error?.code ?? error?.message ?? '';

    if (this._config.ignoreOn && this._config.ignoreOn.length > 0) {
      if (this._config.ignoreOn.some((e) => errorCode.includes(e))) {
        return false;
      }
    }

    if (this._config.failureOn && this._config.failureOn.length > 0) {
      return this._config.failureOn.some((e) => errorCode.includes(e));
    }

    return true; // All errors count by default
  }

  private _transitionTo(newState: CircuitBreakerState): void {
    const oldState = this._state;
    this._state = newState;
    this._lastStateChangeTime = Date.now();

    if (newState === 'closed') {
      this._failureCount = 0;
      this._successCount = 0;
      this._halfOpenCalls = 0;
    } else if (newState === 'half-open') {
      this._successCount = 0;
      this._halfOpenCalls = 0;
    }

    if (this._onStateChange && oldState !== newState) {
      this._onStateChange(oldState, newState);
    }
  }
}

/** Error thrown when the circuit breaker is open. */
export class CircuitBreakerOpenError extends Error {
  readonly code = 'CIRCUIT_BREAKER_OPEN';
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ── Retry ─────────────────────────────────────────────────────

/**
 * Retry an async operation with exponential backoff and
 * optional jitter.
 */
export class RetryExecutor {
  private readonly _policy: RetryPolicy;

  constructor(policy: RetryPolicy) {
    this._policy = policy;
  }

  /**
   * Execute an operation with retry logic.
   * Returns the result on success, throws the last error on exhaustion.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this._policy.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (attempt >= this._policy.maxAttempts) break;

        if (!this._isRetryable(error)) {
          throw error;
        }

        const delay = this._calculateDelay(attempt);
        await this._sleep(delay);
      }
    }

    throw lastError ?? new Error('Retry exhausted with no error captured.');
  }

  /** Calculate the delay for a given attempt. */
  private _calculateDelay(attempt: number): number {
    let delay = this._policy.initialDelayMs *
      Math.pow(this._policy.backoffMultiplier, attempt);

    delay = Math.min(delay, this._policy.maxDelayMs);

    if (this._policy.jitter) {
      // Add random jitter: ±25% of the delay
      const jitterRange = delay * 0.25;
      delay += (Math.random() * jitterRange * 2) - jitterRange;
    }

    return Math.max(0, Math.round(delay));
  }

  /** Check if an error is retryable. */
  private _isRetryable(error: any): boolean {
    const errorCode = error?.code ?? error?.message ?? '';

    if (this._policy.nonRetryableErrors && this._policy.nonRetryableErrors.length > 0) {
      if (this._policy.nonRetryableErrors.some((e) => errorCode.includes(e))) {
        return false;
      }
    }

    if (this._policy.retryableErrors && this._policy.retryableErrors.length > 0) {
      return this._policy.retryableErrors.some((e) => errorCode.includes(e));
    }

    return true; // All errors are retryable by default
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Bulkhead ──────────────────────────────────────────────────

/**
 * Bulkhead pattern: limits concurrent execution to prevent
 * resource exhaustion. Excess requests are queued up to a
 * configurable limit.
 */
export class Bulkhead {
  private readonly _config: BulkheadConfig;
  private _activeCalls = 0;
  private _queue: Array<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    operation: () => Promise<any>;
    timer?: ReturnType<typeof setTimeout>;
  }> = [];

  // Metrics
  private _totalAccepted = 0;
  private _totalRejected = 0;
  private _totalQueued = 0;

  constructor(config: BulkheadConfig) {
    this._config = config;
  }

  /**
   * Execute an operation within the bulkhead.
   * If at capacity, queues or rejects based on configuration.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this._activeCalls < this._config.maxConcurrent) {
      return this._run(operation);
    }

    if (this._queue.length >= this._config.maxQueue) {
      this._totalRejected++;
      throw new BulkheadFullError(
        `Bulkhead full: ${this._activeCalls} active, ${this._queue.length} queued.`,
      );
    }

    // Queue the operation
    this._totalQueued++;
    return new Promise<T>((resolve, reject) => {
      const entry: any = { resolve, reject, operation };

      if (this._config.queueTimeoutMs) {
        entry.timer = setTimeout(() => {
          const idx = this._queue.indexOf(entry);
          if (idx >= 0) {
            this._queue.splice(idx, 1);
            reject(new BulkheadTimeoutError(
              `Bulkhead queue timeout after ${this._config.queueTimeoutMs}ms.`,
            ));
          }
        }, this._config.queueTimeoutMs);
      }

      this._queue.push(entry);
    });
  }

  /** Get bulkhead metrics. */
  get metrics() {
    return {
      activeCalls: this._activeCalls,
      queueSize: this._queue.length,
      maxConcurrent: this._config.maxConcurrent,
      maxQueue: this._config.maxQueue,
      totalAccepted: this._totalAccepted,
      totalRejected: this._totalRejected,
      totalQueued: this._totalQueued,
    };
  }

  private async _run<T>(operation: () => Promise<T>): Promise<T> {
    this._activeCalls++;
    this._totalAccepted++;

    try {
      return await operation();
    } finally {
      this._activeCalls--;
      this._processQueue();
    }
  }

  private _processQueue(): void {
    if (this._queue.length > 0 && this._activeCalls < this._config.maxConcurrent) {
      const entry = this._queue.shift()!;
      if (entry.timer) clearTimeout(entry.timer);

      this._run(entry.operation)
        .then(entry.resolve)
        .catch(entry.reject);
    }
  }
}

/** Error thrown when the bulkhead is full. */
export class BulkheadFullError extends Error {
  readonly code = 'BULKHEAD_FULL';
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadFullError';
  }
}

/** Error thrown when a queued operation times out. */
export class BulkheadTimeoutError extends Error {
  readonly code = 'BULKHEAD_TIMEOUT';
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

// ── Timeout ───────────────────────────────────────────────────

/**
 * Enforces a time limit on an async operation.
 */
export class TimeoutExecutor {
  private readonly _config: TimeoutConfig;

  constructor(config: TimeoutConfig) {
    this._config = config;
  }

  /**
   * Execute an operation with a timeout.
   * Throws TimeoutError if the operation exceeds the limit.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        if (this._config.fallback !== undefined) {
          resolve(this._config.fallback);
        } else {
          reject(new TimeoutError(
            `Operation timed out after ${this._config.timeoutMs}ms.`,
          ));
        }
      }, this._config.timeoutMs);

      operation()
        .then((result) => {
          if (!timedOut) {
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!timedOut) {
            clearTimeout(timer);
            reject(error);
          }
        });
    });
  }
}

/** Error thrown when an operation times out. */
export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ── Rate Limiter ──────────────────────────────────────────────

/**
 * Rate limiter supporting fixed-window, sliding-window,
 * and token-bucket strategies.
 */
export class RateLimiter {
  private readonly _config: RateLimiterConfig;

  // Fixed/sliding window state
  private _windowStart = Date.now();
  private _windowCount = 0;
  private _previousWindowCount = 0;

  // Token bucket state
  private _tokens: number;
  private _lastRefill = Date.now();

  // Queue for overflow
  private _waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  }> = [];

  // Metrics
  private _totalAllowed = 0;
  private _totalRejected = 0;

  constructor(config: RateLimiterConfig) {
    this._config = config;
    this._tokens = config.maxOperations;
  }

  /**
   * Try to acquire permission for an operation.
   * Returns true if allowed, false if rejected (or queues if configured).
   */
  async tryAcquire(): Promise<boolean> {
    switch (this._config.strategy) {
      case 'token-bucket':
        return this._tryTokenBucket();
      case 'sliding-window':
        return this._trySlidingWindow();
      case 'fixed-window':
      default:
        return this._tryFixedWindow();
    }
  }

  /**
   * Acquire permission, waiting if necessary (when overflow is 'queue').
   */
  async acquire(): Promise<void> {
    const allowed = await this.tryAcquire();
    if (allowed) return;

    if (this._config.overflowStrategy === 'reject') {
      throw new RateLimitExceededError(
        `Rate limit exceeded: ${this._config.maxOperations} operations per ${this._config.windowMs}ms.`,
      );
    }

    // Queue
    if (this._config.maxQueueSize && this._waitQueue.length >= this._config.maxQueueSize) {
      throw new RateLimitExceededError(
        'Rate limit queue is full.',
      );
    }

    return new Promise<void>((resolve, reject) => {
      const entry: any = { resolve, reject };

      entry.timer = setTimeout(() => {
        const idx = this._waitQueue.indexOf(entry);
        if (idx >= 0) {
          this._waitQueue.splice(idx, 1);
          reject(new RateLimitExceededError('Rate limit queue timeout.'));
        }
      }, this._config.windowMs);

      this._waitQueue.push(entry);
    });
  }

  /** Get rate limiter metrics. */
  get metrics() {
    return {
      strategy: this._config.strategy,
      totalAllowed: this._totalAllowed,
      totalRejected: this._totalRejected,
      queueSize: this._waitQueue.length,
      currentTokens: this._config.strategy === 'token-bucket'
        ? this._tokens
        : this._config.maxOperations - this._windowCount,
    };
  }

  /** Reset the rate limiter. */
  reset(): void {
    this._windowStart = Date.now();
    this._windowCount = 0;
    this._previousWindowCount = 0;
    this._tokens = this._config.maxOperations;
    this._lastRefill = Date.now();

    // Drain the queue
    for (const entry of this._waitQueue) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.resolve();
    }
    this._waitQueue = [];
  }

  private async _tryFixedWindow(): Promise<boolean> {
    const now = Date.now();

    // Reset window if expired
    if (now - this._windowStart >= this._config.windowMs) {
      this._previousWindowCount = this._windowCount;
      this._windowStart = now;
      this._windowCount = 0;
      this._processQueue();
    }

    if (this._windowCount < this._config.maxOperations) {
      this._windowCount++;
      this._totalAllowed++;
      return true;
    }

    this._totalRejected++;
    return false;
  }

  private async _trySlidingWindow(): Promise<boolean> {
    const now = Date.now();
    const elapsed = now - this._windowStart;

    if (elapsed >= this._config.windowMs) {
      this._previousWindowCount = this._windowCount;
      this._windowStart = now;
      this._windowCount = 0;
      this._processQueue();
    }

    // Weighted estimate of current window
    const windowFraction = elapsed / this._config.windowMs;
    const estimatedCount =
      this._previousWindowCount * (1 - windowFraction) + this._windowCount;

    if (estimatedCount < this._config.maxOperations) {
      this._windowCount++;
      this._totalAllowed++;
      return true;
    }

    this._totalRejected++;
    return false;
  }

  private async _tryTokenBucket(): Promise<boolean> {
    this._refillTokens();

    if (this._tokens >= 1) {
      this._tokens--;
      this._totalAllowed++;
      return true;
    }

    this._totalRejected++;
    return false;
  }

  private _refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this._lastRefill;
    const refillRate = this._config.maxOperations / this._config.windowMs;
    const tokensToAdd = elapsed * refillRate;

    this._tokens = Math.min(
      this._config.maxOperations,
      this._tokens + tokensToAdd,
    );
    this._lastRefill = now;
  }

  private _processQueue(): void {
    while (this._waitQueue.length > 0 && this._windowCount < this._config.maxOperations) {
      const entry = this._waitQueue.shift()!;
      if (entry.timer) clearTimeout(entry.timer);
      this._windowCount++;
      this._totalAllowed++;
      entry.resolve();
    }
  }
}

/** Error thrown when rate limit is exceeded. */
export class RateLimitExceededError extends Error {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

// ── Resilience Builder (Composable) ───────────────────────────

/**
 * Composes multiple resilience patterns into a single
 * execution wrapper. Operations flow through:
 * rate limiter → bulkhead → circuit breaker → timeout → retry → operation
 */
export class ResilienceBuilder {
  private _circuitBreaker?: CircuitBreaker;
  private _retry?: RetryExecutor;
  private _bulkhead?: Bulkhead;
  private _timeout?: TimeoutExecutor;
  private _rateLimiter?: RateLimiter;

  /** Add a circuit breaker. */
  withCircuitBreaker(config: CircuitBreakerConfig): ResilienceBuilder {
    this._circuitBreaker = new CircuitBreaker(config);
    return this;
  }

  /** Add retry logic. */
  withRetry(policy: RetryPolicy): ResilienceBuilder {
    this._retry = new RetryExecutor(policy);
    return this;
  }

  /** Add a bulkhead. */
  withBulkhead(config: BulkheadConfig): ResilienceBuilder {
    this._bulkhead = new Bulkhead(config);
    return this;
  }

  /** Add a timeout. */
  withTimeout(config: TimeoutConfig): ResilienceBuilder {
    this._timeout = new TimeoutExecutor(config);
    return this;
  }

  /** Add a rate limiter. */
  withRateLimiter(config: RateLimiterConfig): ResilienceBuilder {
    this._rateLimiter = new RateLimiter(config);
    return this;
  }

  /**
   * Build and return an executor function that wraps an operation
   * with all configured resilience patterns.
   */
  build<T>(): (operation: () => Promise<T>) => Promise<T> {
    return async (operation: () => Promise<T>): Promise<T> => {
      let wrappedOp = operation;

      // Innermost: retry wraps the operation
      if (this._retry) {
        const retry = this._retry;
        const innerOp = wrappedOp;
        wrappedOp = () => retry.execute(innerOp);
      }

      // Timeout wraps retry
      if (this._timeout) {
        const timeout = this._timeout;
        const innerOp = wrappedOp;
        wrappedOp = () => timeout.execute(innerOp);
      }

      // Circuit breaker wraps timeout
      if (this._circuitBreaker) {
        const cb = this._circuitBreaker;
        const innerOp = wrappedOp;
        wrappedOp = () => cb.execute(innerOp);
      }

      // Bulkhead wraps circuit breaker
      if (this._bulkhead) {
        const bh = this._bulkhead;
        const innerOp = wrappedOp;
        wrappedOp = () => bh.execute(innerOp);
      }

      // Rate limiter is outermost
      if (this._rateLimiter) {
        await this._rateLimiter.acquire();
      }

      return wrappedOp();
    };
  }
}
