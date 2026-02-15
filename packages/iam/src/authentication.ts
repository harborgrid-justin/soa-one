// ============================================================
// SOA One IAM — Authentication Engine
// ============================================================
//
// Core authentication subsystem providing multi-factor
// authentication, adaptive policy evaluation, SSO
// configuration, login history, and account lockout.
//
// Surpasses Oracle Identity Manager's authentication with:
// - Pluggable authentication policies with priority ordering
// - MFA enrollment and verification (TOTP, SMS, email,
//   WebAuthn, push, biometric)
// - SSO configuration management (SAML, OIDC, WS-Federation)
// - Failed attempt tracking with automatic lockout
// - Login history with full audit context
// - Risk-aware authentication flow (placeholder for risk engine)
// - Simulated in-memory credential verification
// - Event callbacks for login, MFA, and lockout lifecycle
//
// Zero external dependencies.
// ============================================================

import type {
  AuthMethod,
  AuthFactorType,
  AuthenticationRequest,
  AuthenticationResult,
  MFAChallenge,
  MFAEnrollment,
  AuthenticationPolicy,
  AuthPolicyCondition,
  SSOConfiguration,
  RiskLevel,
} from './types';

// ── Helpers ─────────────────────────────────────────────────

/** Generate a unique ID (timestamp + random). */
function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}`;
}

/** Generate a simulated token string. */
function generateToken(): string {
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    segments.push(Math.random().toString(36).substring(2, 14));
  }
  return segments.join('.');
}

/**
 * Simulated password hash.
 *
 * In production this would use bcrypt / argon2 / scrypt. For
 * a zero-dependency in-memory engine we use a simple
 * deterministic transform that is sufficient for testing and
 * demonstration purposes.
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `simhash:${Math.abs(hash).toString(36)}`;
}

// ── Internal Types ──────────────────────────────────────────

/** Internal login history entry. */
interface LoginHistoryEntry {
  id: string;
  identityId: string;
  timestamp: string;
  method: AuthMethod;
  status: 'success' | 'failed';
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
  mfaUsed: boolean;
  riskScore?: number;
  sessionId?: string;
}

/** Internal failed-attempts tracking. */
interface FailedAttemptsRecord {
  count: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  lockedUntil?: string;
}

/** Internal stored credential (password hash placeholder). */
interface StoredCredential {
  identityId: string;
  username: string;
  passwordHash: string;
}

// ── Authentication Engine ───────────────────────────────────

/**
 * Manages the full authentication lifecycle: credential
 * verification, MFA enrollment and challenge, policy
 * evaluation, SSO configuration, login history, and account
 * lockout tracking.
 *
 * Usage:
 * ```ts
 * const engine = new AuthenticationEngine();
 *
 * // Set up a policy
 * engine.createAuthPolicy({
 *   id: 'default',
 *   name: 'Default Policy',
 *   priority: 1,
 *   enabled: true,
 *   conditions: {},
 *   requiredFactors: 1,
 *   allowedMethods: ['password'],
 *   mfaRequired: false,
 *   sessionDurationMinutes: 60,
 *   maxFailedAttempts: 5,
 *   lockoutDurationMinutes: 30,
 *   metadata: {},
 * });
 *
 * // Store a credential
 * engine.storeCredential('user-1', 'alice', 'secret123');
 *
 * // Authenticate
 * const result = engine.authenticate({
 *   username: 'alice',
 *   password: 'secret123',
 *   method: 'password',
 * });
 * ```
 */
export class AuthenticationEngine {
  // ── Private State ───────────────────────────────────────

  private readonly _policies = new Map<string, AuthenticationPolicy>();
  private readonly _mfaEnrollments = new Map<string, MFAEnrollment[]>(); // identityId -> enrollments
  private readonly _ssoConfigs = new Map<string, SSOConfiguration>();
  private readonly _loginHistory = new Map<string, LoginHistoryEntry[]>(); // identityId -> entries
  private readonly _failedAttempts = new Map<string, FailedAttemptsRecord>(); // identityId -> record
  private readonly _credentials = new Map<string, StoredCredential>(); // username -> credential
  private readonly _pendingMfaChallenges = new Map<string, { challenge: MFAChallenge; identityId: string; methods: AuthMethod[] }>(); // challengeId -> challenge context

  // Metrics counters
  private _totalAuthentications = 0;
  private _successfulAuthentications = 0;
  private _failedAuthentications = 0;
  private _mfaChallengesIssued = 0;
  private _mfaChallengesCompleted = 0;

  // ── Event Callbacks ─────────────────────────────────────

  private _onLoginSuccess?: (identityId: string, result: AuthenticationResult) => void;
  private _onLoginFailed?: (identityId: string | undefined, result: AuthenticationResult) => void;
  private _onMFAChallenge?: (identityId: string, challenge: MFAChallenge) => void;
  private _onMFASuccess?: (identityId: string, method: AuthMethod) => void;
  private _onMFAFailed?: (identityId: string, method: AuthMethod) => void;
  private _onAccountLocked?: (identityId: string) => void;

  /** Register a callback for successful login. */
  set onLoginSuccess(cb: (identityId: string, result: AuthenticationResult) => void) {
    this._onLoginSuccess = cb;
  }

  /** Register a callback for failed login. */
  set onLoginFailed(cb: (identityId: string | undefined, result: AuthenticationResult) => void) {
    this._onLoginFailed = cb;
  }

  /** Register a callback for MFA challenge issuance. */
  set onMFAChallenge(cb: (identityId: string, challenge: MFAChallenge) => void) {
    this._onMFAChallenge = cb;
  }

  /** Register a callback for successful MFA verification. */
  set onMFASuccess(cb: (identityId: string, method: AuthMethod) => void) {
    this._onMFASuccess = cb;
  }

  /** Register a callback for failed MFA verification. */
  set onMFAFailed(cb: (identityId: string, method: AuthMethod) => void) {
    this._onMFAFailed = cb;
  }

  /** Register a callback for account lockout. */
  set onAccountLocked(cb: (identityId: string) => void) {
    this._onAccountLocked = cb;
  }

  // ── Metric Getters ──────────────────────────────────────

  /** Total authentication attempts. */
  get totalAuthentications(): number {
    return this._totalAuthentications;
  }

  /** Successful authentication count. */
  get successfulAuthentications(): number {
    return this._successfulAuthentications;
  }

  /** Failed authentication count. */
  get failedAuthentications(): number {
    return this._failedAuthentications;
  }

  /** Total MFA challenges issued. */
  get mfaChallengesIssued(): number {
    return this._mfaChallengesIssued;
  }

  /** Total MFA challenges completed successfully. */
  get mfaChallengesCompleted(): number {
    return this._mfaChallengesCompleted;
  }

  /** Number of active (enabled) SSO configurations. */
  get activeSSOConfigs(): number {
    let count = 0;
    for (const config of this._ssoConfigs.values()) {
      if (config.enabled) count++;
    }
    return count;
  }

  /** Total authentication policies. */
  get policyCount(): number {
    return this._policies.size;
  }

  // ── Credential Storage (Simulated) ──────────────────────

  /**
   * Store a credential for testing/simulation.
   *
   * In production, credential storage would be handled by a
   * dedicated credential management subsystem with proper
   * key derivation. This simulated version enables the
   * engine to work standalone.
   */
  storeCredential(identityId: string, username: string, password: string): void {
    this._credentials.set(username, {
      identityId,
      username,
      passwordHash: simpleHash(password),
    });
  }

  /** Remove a stored credential. */
  removeCredential(username: string): void {
    this._credentials.delete(username);
  }

  // ── Core Authentication ─────────────────────────────────

  /**
   * Authenticate a request.
   *
   * Flow:
   * 1. Resolve identity from username/email
   * 2. Check if account is locked
   * 3. Find matching authentication policy
   * 4. Validate credentials
   * 5. Check if MFA is required
   * 6. If MFA required and no code provided, return mfa-required
   * 7. Evaluate risk (placeholder)
   * 8. Create successful result with tokens
   */
  authenticate(request: AuthenticationRequest): AuthenticationResult {
    this._totalAuthentications++;
    const now = new Date().toISOString();

    // Step 1: Resolve identity
    const identifier = request.username ?? request.email;
    if (!identifier) {
      return this._failResult(undefined, 'No username or email provided', request.method);
    }

    const credential = this._credentials.get(identifier);
    if (!credential) {
      return this._failResult(undefined, 'Invalid credentials', request.method);
    }

    const identityId = credential.identityId;

    // Step 2: Check if account is locked
    if (this.isLocked(identityId)) {
      const result: AuthenticationResult = {
        status: 'locked',
        identityId,
        failureReason: 'Account is locked due to too many failed attempts',
        failureCount: this.getFailedAttemptCount(identityId),
        methods: [request.method],
      };
      this._totalAuthentications; // already incremented
      this._failedAuthentications++;

      this._recordLogin(identityId, request.method, 'failed', request, 'Account locked');

      if (this._onLoginFailed) {
        try { this._onLoginFailed(identityId, result); } catch { /* swallow */ }
      }

      return result;
    }

    // Step 3: Find matching authentication policy
    const policy = this.evaluateAuthPolicy(request);

    // Check if method is allowed by policy
    if (policy && !policy.allowedMethods.includes(request.method)) {
      return this._failResult(identityId, `Authentication method '${request.method}' is not allowed by policy`, request.method);
    }

    // Step 4: Validate credentials
    if (request.method === 'password') {
      if (!request.password) {
        return this._failResult(identityId, 'Password is required', request.method);
      }

      const expectedHash = simpleHash(request.password);
      if (credential.passwordHash !== expectedHash) {
        this._recordFailedAttempt(identityId, policy);
        const failCount = this.getFailedAttemptCount(identityId);

        const result = this._failResult(identityId, 'Invalid credentials', request.method);
        result.failureCount = failCount;

        // Check if we should lock the account now
        if (this.isLocked(identityId)) {
          if (this._onAccountLocked) {
            try { this._onAccountLocked(identityId); } catch { /* swallow */ }
          }
        }

        return result;
      }
    }

    // Step 5: Check if MFA is required
    const mfaRequired = policy?.mfaRequired ?? false;
    const enrollments = this.getMFAEnrollments(identityId);
    const activeEnrollments = enrollments.filter((e) => e.status === 'active' && e.verified);

    if (mfaRequired && activeEnrollments.length > 0) {
      // If there is a pending MFA token, attempt verification inline
      if (request.mfaCode && request.mfaToken) {
        const mfaResult = this._verifyMfaChallenge(request.mfaToken, request.mfaCode);
        if (mfaResult) {
          // MFA verified inline, continue to success
          this._mfaChallengesCompleted++;
          if (this._onMFASuccess) {
            try { this._onMFASuccess(identityId, activeEnrollments[0].method); } catch { /* swallow */ }
          }
          // Fall through to success
        } else {
          // MFA code was wrong
          if (this._onMFAFailed) {
            try { this._onMFAFailed(identityId, activeEnrollments[0].method); } catch { /* swallow */ }
          }
          return {
            status: 'failed',
            identityId,
            failureReason: 'Invalid MFA code',
            methods: [request.method],
          };
        }
      } else {
        // Issue MFA challenge
        const preferredEnrollment = activeEnrollments[0];
        const challenge = this._issueMfaChallenge(identityId, preferredEnrollment, request);

        const result: AuthenticationResult = {
          status: 'mfa-required',
          identityId,
          mfaChallenge: challenge,
          methods: [request.method],
        };

        return result;
      }
    }

    // Step 6: Evaluate risk (placeholder - returns low risk)
    const riskScore = this._evaluateRisk(identityId, request);
    const riskLevel = this._riskScoreToLevel(riskScore);

    if (policy?.riskThreshold !== undefined && riskScore > policy.riskThreshold) {
      const result: AuthenticationResult = {
        status: 'risk-denied',
        identityId,
        riskScore,
        riskLevel,
        failureReason: `Risk score ${riskScore} exceeds threshold ${policy.riskThreshold}`,
        methods: [request.method],
      };
      this._failedAuthentications++;

      this._recordLogin(identityId, request.method, 'failed', request, 'Risk threshold exceeded');

      if (this._onLoginFailed) {
        try { this._onLoginFailed(identityId, result); } catch { /* swallow */ }
      }

      return result;
    }

    // Step 7: Create successful result with tokens
    const sessionId = generateId();
    const sessionDuration = policy?.sessionDurationMinutes ?? 60;

    const result: AuthenticationResult = {
      status: 'success',
      identityId,
      sessionId,
      accessToken: generateToken(),
      refreshToken: generateToken(),
      idToken: generateToken(),
      tokenType: 'Bearer',
      expiresIn: sessionDuration * 60,
      scope: request.scope,
      riskScore,
      riskLevel,
      authenticatedAt: now,
      methods: [request.method],
    };

    // Reset failed attempts on success
    this.resetFailedAttempts(identityId);

    this._successfulAuthentications++;

    this._recordLogin(identityId, request.method, 'success', request, undefined, sessionId);

    if (this._onLoginSuccess) {
      try { this._onLoginSuccess(identityId, result); } catch { /* swallow */ }
    }

    return result;
  }

  // ── MFA Verification ────────────────────────────────────

  /**
   * Verify an MFA challenge code.
   *
   * Called after `authenticate()` returned `mfa-required`
   * with a challenge. The caller supplies the challenge's
   * identity ID, the MFA method, and the code.
   */
  verifyMFA(identityId: string, method: AuthMethod, code: string): AuthenticationResult {
    // Find a pending challenge for this identity
    let matchedChallengeId: string | undefined;
    let matchedContext: { challenge: MFAChallenge; identityId: string; methods: AuthMethod[] } | undefined;

    for (const [cid, ctx] of this._pendingMfaChallenges) {
      if (ctx.identityId === identityId && ctx.challenge.method === method) {
        matchedChallengeId = cid;
        matchedContext = ctx;
        break;
      }
    }

    if (!matchedChallengeId || !matchedContext) {
      if (this._onMFAFailed) {
        try { this._onMFAFailed(identityId, method); } catch { /* swallow */ }
      }
      return {
        status: 'failed',
        identityId,
        failureReason: 'No pending MFA challenge found',
        methods: [method],
      };
    }

    // Check expiration
    if (new Date(matchedContext.challenge.expiresAt) <= new Date()) {
      this._pendingMfaChallenges.delete(matchedChallengeId);
      if (this._onMFAFailed) {
        try { this._onMFAFailed(identityId, method); } catch { /* swallow */ }
      }
      return {
        status: 'failed',
        identityId,
        failureReason: 'MFA challenge has expired',
        methods: [method],
      };
    }

    // Simulated verification: accept any 6-digit code or the
    // challenge ID as the valid code (for testing).
    const validCode = this._simulateMfaVerification(code, matchedChallengeId);

    if (!validCode) {
      if (this._onMFAFailed) {
        try { this._onMFAFailed(identityId, method); } catch { /* swallow */ }
      }
      return {
        status: 'failed',
        identityId,
        failureReason: 'Invalid MFA code',
        methods: [method],
      };
    }

    // Success
    this._pendingMfaChallenges.delete(matchedChallengeId);
    this._mfaChallengesCompleted++;

    // Update enrollment last-used timestamp
    const enrollments = this._mfaEnrollments.get(identityId) ?? [];
    for (const enrollment of enrollments) {
      if (enrollment.method === method && enrollment.status === 'active') {
        enrollment.lastUsedAt = new Date().toISOString();
        break;
      }
    }

    // Reset failed attempts on successful MFA
    this.resetFailedAttempts(identityId);

    const sessionId = generateId();
    const now = new Date().toISOString();

    const result: AuthenticationResult = {
      status: 'success',
      identityId,
      sessionId,
      accessToken: generateToken(),
      refreshToken: generateToken(),
      idToken: generateToken(),
      tokenType: 'Bearer',
      expiresIn: 3600,
      riskScore: 0,
      riskLevel: 'minimal',
      authenticatedAt: now,
      methods: [...matchedContext.methods, method],
    };

    this._successfulAuthentications++;

    this._recordLogin(identityId, method, 'success', undefined, undefined, sessionId);

    if (this._onMFASuccess) {
      try { this._onMFASuccess(identityId, method); } catch { /* swallow */ }
    }

    if (this._onLoginSuccess) {
      try { this._onLoginSuccess(identityId, result); } catch { /* swallow */ }
    }

    return result;
  }

  // ── MFA Enrollment Management ───────────────────────────

  /** Enroll an identity in an MFA method. */
  enrollMFA(
    identityId: string,
    method: AuthMethod,
    config?: Record<string, any>,
  ): MFAEnrollment {
    const now = new Date().toISOString();
    const factorType = this._methodToFactorType(method);

    const enrollment: MFAEnrollment = {
      id: generateId(),
      identityId,
      method,
      factorType,
      status: 'pending',
      verified: false,
      phoneNumber: config?.phoneNumber,
      email: config?.email,
      deviceName: config?.deviceName,
      registeredAt: now,
    };

    if (!this._mfaEnrollments.has(identityId)) {
      this._mfaEnrollments.set(identityId, []);
    }
    this._mfaEnrollments.get(identityId)!.push(enrollment);

    // Auto-verify for simulated environment (in production
    // this would require a verification flow).
    if (config?.autoVerify) {
      enrollment.status = 'active';
      enrollment.verified = true;
    }

    return { ...enrollment };
  }

  /** Unenroll an MFA enrollment by enrollment ID. */
  unenrollMFA(identityId: string, enrollmentId: string): void {
    const enrollments = this._mfaEnrollments.get(identityId);
    if (!enrollments) return;

    const idx = enrollments.findIndex((e) => e.id === enrollmentId);
    if (idx >= 0) {
      enrollments.splice(idx, 1);
    }
  }

  /** Get all MFA enrollments for an identity. */
  getMFAEnrollments(identityId: string): MFAEnrollment[] {
    return (this._mfaEnrollments.get(identityId) ?? []).map((e) => ({ ...e }));
  }

  // ── Authentication Policy Management ────────────────────

  /** Create an authentication policy. */
  createAuthPolicy(policy: AuthenticationPolicy): AuthenticationPolicy {
    const stored: AuthenticationPolicy = { ...policy };
    this._policies.set(stored.id, stored);
    return { ...stored };
  }

  /** Get an authentication policy by ID. */
  getAuthPolicy(id: string): AuthenticationPolicy | undefined {
    const policy = this._policies.get(id);
    return policy ? { ...policy } : undefined;
  }

  /** List all authentication policies. */
  listAuthPolicies(): AuthenticationPolicy[] {
    return Array.from(this._policies.values())
      .map((p) => ({ ...p }))
      .sort((a, b) => a.priority - b.priority);
  }

  /** Delete an authentication policy. */
  deleteAuthPolicy(id: string): void {
    this._policies.delete(id);
  }

  /**
   * Evaluate which authentication policy matches a given
   * request. Returns the highest-priority enabled policy
   * whose conditions match the request context, or undefined
   * if no policy matches.
   */
  evaluateAuthPolicy(request: AuthenticationRequest): AuthenticationPolicy | undefined {
    const sorted = Array.from(this._policies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const policy of sorted) {
      if (this._matchesPolicyConditions(policy.conditions, request)) {
        return policy;
      }
    }

    return undefined;
  }

  // ── SSO Configuration Management ────────────────────────

  /** Add or update an SSO configuration. */
  configureSSOConfig(config: SSOConfiguration): SSOConfiguration {
    const stored: SSOConfiguration = { ...config };
    this._ssoConfigs.set(stored.id, stored);
    return { ...stored };
  }

  /** Get an SSO configuration by ID. */
  getSSOConfig(id: string): SSOConfiguration | undefined {
    const config = this._ssoConfigs.get(id);
    return config ? { ...config } : undefined;
  }

  /** List all SSO configurations. */
  listSSOConfigs(): SSOConfiguration[] {
    return Array.from(this._ssoConfigs.values()).map((c) => ({ ...c }));
  }

  // ── Login History ───────────────────────────────────────

  /**
   * Get login history for an identity.
   * Entries are sorted most-recent-first.
   */
  getLoginHistory(identityId: string, limit?: number): LoginHistoryEntry[] {
    const entries = (this._loginHistory.get(identityId) ?? [])
      .map((e) => ({ ...e }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (limit !== undefined && limit > 0) {
      return entries.slice(0, limit);
    }
    return entries;
  }

  // ── Failed Attempts & Lockout ───────────────────────────

  /** Get the current failed-attempt count for an identity. */
  getFailedAttemptCount(identityId: string): number {
    return this._failedAttempts.get(identityId)?.count ?? 0;
  }

  /** Reset failed attempts for an identity (unlock). */
  resetFailedAttempts(identityId: string): void {
    this._failedAttempts.delete(identityId);
  }

  /**
   * Check whether an identity is currently locked out.
   *
   * An account is locked when:
   * - The failed attempt count exceeds the maximum defined by
   *   the applicable policy (default 5).
   * - The lockout duration has not yet elapsed.
   *
   * If the lockout window has passed, the record is cleared
   * and the account is considered unlocked.
   */
  isLocked(identityId: string): boolean {
    const record = this._failedAttempts.get(identityId);
    if (!record) return false;

    // Determine applicable threshold
    const threshold = this._getLockoutThreshold();

    if (record.count < threshold) return false;

    // Check lockout duration
    if (record.lockedUntil) {
      if (new Date(record.lockedUntil) > new Date()) {
        return true;
      }
      // Lockout expired — clear the record
      this._failedAttempts.delete(identityId);
      return false;
    }

    return true;
  }

  // ── Private: Authentication Helpers ─────────────────────

  /** Create and return a failure result, updating metrics and history. */
  private _failResult(
    identityId: string | undefined,
    reason: string,
    method: AuthMethod,
  ): AuthenticationResult {
    this._failedAuthentications++;

    const result: AuthenticationResult = {
      status: 'failed',
      identityId,
      failureReason: reason,
      methods: [method],
    };

    if (identityId) {
      this._recordLogin(identityId, method, 'failed', undefined, reason);
    }

    if (this._onLoginFailed) {
      try { this._onLoginFailed(identityId, result); } catch { /* swallow */ }
    }

    return result;
  }

  /** Record a login attempt in history. */
  private _recordLogin(
    identityId: string,
    method: AuthMethod,
    status: 'success' | 'failed',
    request?: AuthenticationRequest,
    failureReason?: string,
    sessionId?: string,
  ): void {
    const entry: LoginHistoryEntry = {
      id: generateId(),
      identityId,
      timestamp: new Date().toISOString(),
      method,
      status,
      ipAddress: request?.ipAddress,
      userAgent: request?.userAgent,
      failureReason,
      mfaUsed: false,
      sessionId,
    };

    if (!this._loginHistory.has(identityId)) {
      this._loginHistory.set(identityId, []);
    }
    this._loginHistory.get(identityId)!.push(entry);
  }

  /** Record a failed attempt and potentially lock the account. */
  private _recordFailedAttempt(
    identityId: string,
    policy?: AuthenticationPolicy,
  ): void {
    const now = new Date().toISOString();
    let record = this._failedAttempts.get(identityId);

    if (!record) {
      record = {
        count: 0,
        firstAttemptAt: now,
        lastAttemptAt: now,
      };
      this._failedAttempts.set(identityId, record);
    }

    record.count++;
    record.lastAttemptAt = now;

    // Determine lockout threshold from policy or default
    const maxAttempts = policy?.maxFailedAttempts ?? 5;
    const lockoutMinutes = policy?.lockoutDurationMinutes ?? 30;

    if (record.count >= maxAttempts) {
      const lockedUntil = new Date(
        Date.now() + lockoutMinutes * 60 * 1000,
      ).toISOString();
      record.lockedUntil = lockedUntil;
    }
  }

  /** Get the lockout threshold from the highest-priority policy, or a default. */
  private _getLockoutThreshold(): number {
    const sorted = Array.from(this._policies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (sorted.length > 0) {
      return sorted[0].maxFailedAttempts;
    }

    return 5; // default threshold
  }

  // ── Private: MFA Helpers ────────────────────────────────

  /** Issue an MFA challenge and store it. */
  private _issueMfaChallenge(
    identityId: string,
    enrollment: MFAEnrollment,
    request: AuthenticationRequest,
  ): MFAChallenge {
    const challengeId = generateId();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    const challenge: MFAChallenge = {
      challengeId,
      method: enrollment.method,
      expiresAt,
      destination: enrollment.phoneNumber ?? enrollment.email,
    };

    // If TOTP, include a simulated QR URI
    if (enrollment.method === 'mfa-totp') {
      challenge.qrCodeUri = `otpauth://totp/SOAOne:${identityId}?secret=SIMULATED&issuer=SOAOne`;
    }

    this._pendingMfaChallenges.set(challengeId, {
      challenge,
      identityId,
      methods: [request.method],
    });

    this._mfaChallengesIssued++;

    if (this._onMFAChallenge) {
      try { this._onMFAChallenge(identityId, challenge); } catch { /* swallow */ }
    }

    return challenge;
  }

  /** Attempt to verify a pending MFA challenge by token. Returns true if valid. */
  private _verifyMfaChallenge(mfaToken: string, code: string): boolean {
    const ctx = this._pendingMfaChallenges.get(mfaToken);
    if (!ctx) return false;

    if (new Date(ctx.challenge.expiresAt) <= new Date()) {
      this._pendingMfaChallenges.delete(mfaToken);
      return false;
    }

    const valid = this._simulateMfaVerification(code, mfaToken);
    if (valid) {
      this._pendingMfaChallenges.delete(mfaToken);
    }
    return valid;
  }

  /**
   * Simulated MFA code verification.
   *
   * Accepts:
   * - Any 6-digit numeric code (simulated TOTP).
   * - The challenge ID itself (for deterministic testing).
   */
  private _simulateMfaVerification(code: string, challengeId: string): boolean {
    if (code === challengeId) return true;
    if (/^\d{6}$/.test(code)) return true;
    return false;
  }

  /** Map an AuthMethod to its factor type. */
  private _methodToFactorType(method: AuthMethod): AuthFactorType {
    switch (method) {
      case 'password':
        return 'knowledge';
      case 'mfa-totp':
      case 'mfa-sms':
      case 'mfa-email':
      case 'mfa-push':
        return 'possession';
      case 'mfa-webauthn':
      case 'mfa-biometric':
      case 'passwordless-webauthn':
      case 'passwordless-passkey':
        return 'inherence';
      default:
        return 'possession';
    }
  }

  // ── Private: Policy Condition Matching ──────────────────

  /**
   * Check whether the conditions of an authentication policy
   * match the given request context. If the condition block
   * is empty, the policy always matches.
   */
  private _matchesPolicyConditions(
    conditions: AuthPolicyCondition,
    request: AuthenticationRequest,
  ): boolean {
    const checks: boolean[] = [];

    // IP range check
    if (conditions.ipRanges && conditions.ipRanges.length > 0 && request.ipAddress) {
      checks.push(conditions.ipRanges.includes(request.ipAddress));
    }

    // Geo location check
    if (conditions.geoLocations && conditions.geoLocations.length > 0 && request.geoLocation?.country) {
      checks.push(conditions.geoLocations.includes(request.geoLocation.country));
    }

    // Device type check
    if (conditions.deviceTypes && conditions.deviceTypes.length > 0 && request.userAgent) {
      checks.push(
        conditions.deviceTypes.some((dt) =>
          request.userAgent!.toLowerCase().includes(dt.toLowerCase()),
        ),
      );
    }

    // Application / client ID check
    if (conditions.applications && conditions.applications.length > 0 && request.clientId) {
      checks.push(conditions.applications.includes(request.clientId));
    }

    // If no condition fields were applicable, the policy matches by default
    if (checks.length === 0) return true;

    const logic = conditions.logic ?? 'AND';

    if (logic === 'OR') {
      return checks.some(Boolean);
    }

    return checks.every(Boolean);
  }

  // ── Private: Risk Evaluation (Placeholder) ──────────────

  /**
   * Placeholder risk evaluation.
   *
   * Returns a score between 0 and 100. In production this
   * would delegate to the Risk Engine subsystem for
   * behavioral analytics and threat intelligence.
   */
  private _evaluateRisk(identityId: string, request: AuthenticationRequest): number {
    let score = 0;

    // Small bump if no device fingerprint provided
    if (!request.deviceFingerprint) score += 5;

    // Small bump if no IP address
    if (!request.ipAddress) score += 5;

    // Check recent failed attempts
    const failedCount = this.getFailedAttemptCount(identityId);
    score += Math.min(failedCount * 5, 30);

    return Math.min(score, 100);
  }

  /** Map a numeric risk score to a risk level. */
  private _riskScoreToLevel(score: number): RiskLevel {
    if (score <= 10) return 'minimal';
    if (score <= 30) return 'low';
    if (score <= 60) return 'medium';
    if (score <= 80) return 'high';
    return 'critical';
  }
}
