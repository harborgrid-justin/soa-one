// ============================================================
// SOA One IAM — Credential Manager
// ============================================================
//
// Provides comprehensive credential lifecycle management with
// password policies, API key generation, recovery codes,
// credential rotation, and compromise detection.
//
// Surpasses Oracle credential management with:
// - Fine-grained password policies with strength scoring
// - Password history enforcement to prevent reuse
// - API key generation with scoped validation
// - Recovery code generation and one-time consumption
// - Credential rotation with lineage tracking
// - Compromise detection and forced password change
// - Event callbacks for credential lifecycle
// - Password expiry and age tracking
//
// Zero external dependencies. 100% in-memory.
// ============================================================

import type {
  CredentialRecord,
  CredentialType,
  CredentialValidationResult,
  PasswordPolicy,
  PasswordComplexity,
} from './types';

// ── Utilities ────────────────────────────────────────────────

/** Generate a unique ID. */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 6);
  return `${ts}-${rand}-${rand2}`;
}

/** Generate a random alphanumeric string of the given length. */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Common Passwords ─────────────────────────────────────────

const COMMON_PASSWORDS: string[] = [
  'password',
  '123456',
  '123456789',
  '12345678',
  '12345',
  '1234567',
  'qwerty',
  'abc123',
  'password1',
  'iloveyou',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'login',
  'princess',
  'football',
  'shadow',
  'sunshine',
  'trustno1',
];

// ── Default Password Policy ──────────────────────────────────

const DEFAULT_PASSWORD_COMPLEXITY: PasswordComplexity = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigits: true,
  requireSpecialChars: true,
  disallowCommonPasswords: true,
  disallowUserInfo: false,
  maxConsecutiveRepeats: 3,
  historyCount: 5,
};

const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  id: 'default',
  name: 'Default Password Policy',
  complexity: { ...DEFAULT_PASSWORD_COMPLEXITY },
  maxAgeDays: 90,
  minAgeDays: 1,
  warningDays: 14,
  gracePeriodDays: 7,
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  requireMfaAfterReset: false,
  allowSelfServiceReset: true,
};

// ── Simulated Hashing ────────────────────────────────────────

/** Simulate password hashing (reversed + prefixed). NOT real crypto. */
function simulateHash(password: string): string {
  const reversed = password.split('').reverse().join('');
  return `hashed:${reversed}`;
}

/** Verify a password against a simulated hash. */
function verifyHash(password: string, hash: string): boolean {
  return simulateHash(password) === hash;
}

// ── Credential Manager ──────────────────────────────────────

/**
 * In-memory credential manager with password policies, API key
 * management, recovery codes, rotation, and compromise tracking.
 *
 * Usage:
 * ```ts
 * const mgr = new CredentialManager();
 *
 * mgr.onCredentialCreated((cred) => console.log('created', cred.id));
 *
 * // Set a password with policy enforcement
 * const result = mgr.setPassword('identity-1', 'Str0ng!Pass');
 *
 * // Verify credentials
 * const valid = mgr.verifyPassword('identity-1', 'Str0ng!Pass');
 *
 * // Generate an API key
 * const { credential, apiKey } = mgr.generateAPIKey('identity-1', 'CI Key');
 *
 * // Validate the API key
 * const check = mgr.validateAPIKey(apiKey);
 * // { valid: true, identityId: 'identity-1' }
 * ```
 */
export class CredentialManager {
  /** All credential records by ID. */
  private readonly _credentials: Map<string, CredentialRecord> = new Map();

  /** Password policies by ID. */
  private readonly _policies: Map<string, PasswordPolicy> = new Map();

  /** Simulated password hashes by identity ID. */
  private readonly _passwordHashes: Map<string, string> = new Map();

  /** Password history per identity (list of previous hashes). */
  private readonly _passwordHistory: Map<string, string[]> = new Map();

  /** API key value -> credential ID mapping. */
  private readonly _apiKeys: Map<string, string> = new Map();

  /** API key scopes by credential ID. */
  private readonly _apiKeyScopes: Map<string, string[]> = new Map();

  /** Recovery codes by identity ID -> set of remaining codes. */
  private readonly _recoveryCodes: Map<string, Set<string>> = new Map();

  /** Identities flagged for forced password change. */
  private readonly _forceChangeFlags: Set<string> = new Set();

  /** Timestamp of last password set per identity. */
  private readonly _passwordSetAt: Map<string, string> = new Map();

  // ── Event callbacks ──────────────────────────────────────

  /** Callbacks fired when a credential is created. */
  private readonly _onCredentialCreated: Array<(credential: CredentialRecord) => void> = [];

  /** Callbacks fired when a credential is rotated. */
  private readonly _onCredentialRotated: Array<(credential: CredentialRecord) => void> = [];

  /** Callbacks fired when a credential is marked compromised. */
  private readonly _onCredentialCompromised: Array<(credential: CredentialRecord) => void> = [];

  /** Callbacks fired when a credential expires. */
  private readonly _onCredentialExpired: Array<(credential: CredentialRecord) => void> = [];

  /** Callbacks fired when a password is changed. */
  private readonly _onPasswordChanged: Array<(identityId: string) => void> = [];

  constructor() {
    // Seed the default policy
    this._policies.set(DEFAULT_PASSWORD_POLICY.id, { ...DEFAULT_PASSWORD_POLICY, complexity: { ...DEFAULT_PASSWORD_COMPLEXITY } });
  }

  // ── Password Policy Management ────────────────────────────

  /** Create a new password policy. */
  createPasswordPolicy(policy: Omit<PasswordPolicy, 'id'>): PasswordPolicy {
    const id = generateId();
    const record: PasswordPolicy = { ...policy, id, complexity: { ...policy.complexity } };
    this._policies.set(id, record);
    return { ...record, complexity: { ...record.complexity } };
  }

  /** Get a password policy by ID. */
  getPasswordPolicy(id: string): PasswordPolicy | undefined {
    const policy = this._policies.get(id);
    return policy ? { ...policy, complexity: { ...policy.complexity } } : undefined;
  }

  /** Update a password policy. */
  updatePasswordPolicy(id: string, updates: Partial<Omit<PasswordPolicy, 'id'>>): PasswordPolicy {
    const policy = this._policies.get(id);
    if (!policy) throw new Error(`Password policy not found: ${id}`);

    if (updates.name !== undefined) policy.name = updates.name;
    if (updates.complexity !== undefined) policy.complexity = { ...policy.complexity, ...updates.complexity };
    if (updates.maxAgeDays !== undefined) policy.maxAgeDays = updates.maxAgeDays;
    if (updates.minAgeDays !== undefined) policy.minAgeDays = updates.minAgeDays;
    if (updates.warningDays !== undefined) policy.warningDays = updates.warningDays;
    if (updates.gracePeriodDays !== undefined) policy.gracePeriodDays = updates.gracePeriodDays;
    if (updates.maxFailedAttempts !== undefined) policy.maxFailedAttempts = updates.maxFailedAttempts;
    if (updates.lockoutDurationMinutes !== undefined) policy.lockoutDurationMinutes = updates.lockoutDurationMinutes;
    if (updates.requireMfaAfterReset !== undefined) policy.requireMfaAfterReset = updates.requireMfaAfterReset;
    if (updates.allowSelfServiceReset !== undefined) policy.allowSelfServiceReset = updates.allowSelfServiceReset;

    return { ...policy, complexity: { ...policy.complexity } };
  }

  /** Delete a password policy by ID. */
  deletePasswordPolicy(id: string): void {
    if (id === 'default') throw new Error('Cannot delete the default password policy');
    if (!this._policies.has(id)) throw new Error(`Password policy not found: ${id}`);
    this._policies.delete(id);
  }

  /** List all password policies. */
  listPasswordPolicies(): PasswordPolicy[] {
    return Array.from(this._policies.values()).map((p) => ({
      ...p,
      complexity: { ...p.complexity },
    }));
  }

  /** Get the default password policy. */
  getDefaultPolicy(): PasswordPolicy {
    const policy = this._policies.get('default')!;
    return { ...policy, complexity: { ...policy.complexity } };
  }

  // ── Password Management ───────────────────────────────────

  /**
   * Set (or create) a password for an identity.
   * Validates against the specified or default policy.
   */
  setPassword(identityId: string, password: string, policyId?: string): CredentialValidationResult {
    const validation = this.validatePasswordStrength(password, policyId);
    if (!validation.valid) return validation;

    const policy = this._resolvePolicy(policyId);

    // Check password history
    const history = this._passwordHistory.get(identityId) ?? [];
    const hash = simulateHash(password);
    const historyCount = policy.complexity.historyCount;
    const recentHistory = history.slice(-historyCount);
    if (recentHistory.some((h) => h === hash)) {
      return {
        valid: false,
        expired: false,
        compromised: false,
        policyViolations: ['Password was used recently and cannot be reused'],
        strengthScore: validation.strengthScore,
        strengthLevel: validation.strengthLevel,
      };
    }

    // Store the hash
    this._passwordHashes.set(identityId, hash);
    this._passwordSetAt.set(identityId, new Date().toISOString());

    // Update history
    history.push(hash);
    this._passwordHistory.set(identityId, history);

    // Clear force-change flag
    this._forceChangeFlags.delete(identityId);

    // Create or update the password credential record
    let existingCred: CredentialRecord | undefined;
    for (const cred of this._credentials.values()) {
      if (cred.identityId === identityId && cred.type === 'password' && cred.status === 'active') {
        existingCred = cred;
        break;
      }
    }

    if (existingCred) {
      existingCred.rotatedAt = new Date().toISOString();
      existingCred.metadata._lastChanged = new Date().toISOString();
    } else {
      this.createCredential(identityId, 'password', 'Password', { _lastChanged: new Date().toISOString() });
    }

    // Fire callbacks
    this._firePasswordChanged(identityId);

    return validation;
  }

  /** Verify a password for an identity. Returns true if it matches. */
  verifyPassword(identityId: string, password: string): boolean {
    const storedHash = this._passwordHashes.get(identityId);
    if (!storedHash) return false;
    return verifyHash(password, storedHash);
  }

  /** Validate password strength against a policy without storing it. */
  validatePasswordStrength(password: string, policyId?: string): CredentialValidationResult {
    const policy = this._resolvePolicy(policyId);
    const violations: string[] = [];
    const complexity = policy.complexity;

    // Length checks
    if (password.length < complexity.minLength) {
      violations.push(`Password must be at least ${complexity.minLength} characters`);
    }
    if (password.length > complexity.maxLength) {
      violations.push(`Password must be at most ${complexity.maxLength} characters`);
    }

    // Character class checks
    if (complexity.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter');
    }
    if (complexity.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter');
    }
    if (complexity.requireDigits && !/[0-9]/.test(password)) {
      violations.push('Password must contain at least one digit');
    }
    if (complexity.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      violations.push('Password must contain at least one special character');
    }

    // Disallowed characters
    if (complexity.disallowedCharacters) {
      for (const ch of complexity.disallowedCharacters) {
        if (password.includes(ch)) {
          violations.push(`Password contains disallowed character: '${ch}'`);
          break;
        }
      }
    }

    // Consecutive repeats
    if (complexity.maxConsecutiveRepeats > 0) {
      const repeatRegex = new RegExp(`(.)\\1{${complexity.maxConsecutiveRepeats},}`);
      if (repeatRegex.test(password)) {
        violations.push(`Password contains more than ${complexity.maxConsecutiveRepeats} consecutive repeated characters`);
      }
    }

    // Common passwords
    if (complexity.disallowCommonPasswords && this._checkCommonPasswords(password)) {
      violations.push('Password is too common');
    }

    const strength = this._calculateStrength(password);

    return {
      valid: violations.length === 0,
      expired: false,
      compromised: false,
      policyViolations: violations,
      strengthScore: strength.score,
      strengthLevel: strength.level,
    };
  }

  /**
   * Change password for an identity. Requires the old password
   * to match before setting the new one.
   */
  changePassword(identityId: string, oldPassword: string, newPassword: string): CredentialValidationResult {
    if (!this.verifyPassword(identityId, oldPassword)) {
      return {
        valid: false,
        expired: false,
        compromised: false,
        policyViolations: ['Current password is incorrect'],
        strengthScore: 0,
        strengthLevel: 'weak',
      };
    }

    if (oldPassword === newPassword) {
      return {
        valid: false,
        expired: false,
        compromised: false,
        policyViolations: ['New password must be different from the current password'],
        strengthScore: 0,
        strengthLevel: 'weak',
      };
    }

    return this.setPassword(identityId, newPassword);
  }

  /**
   * Reset password for an identity (administrative action).
   * Does not require the old password.
   */
  resetPassword(identityId: string, newPassword: string): CredentialValidationResult {
    return this.setPassword(identityId, newPassword);
  }

  /** Check if the password for an identity has expired. */
  isPasswordExpired(identityId: string): boolean {
    const setAt = this._passwordSetAt.get(identityId);
    if (!setAt) return false;

    // Find which policy to check (use default)
    const policy = this.getDefaultPolicy();
    if (policy.maxAgeDays <= 0) return false;

    const ageDays = this.getPasswordAge(identityId);
    return ageDays > policy.maxAgeDays;
  }

  /** Get the age of the current password in days. */
  getPasswordAge(identityId: string): number {
    const setAt = this._passwordSetAt.get(identityId);
    if (!setAt) return 0;

    const setDate = new Date(setAt).getTime();
    const now = Date.now();
    return Math.floor((now - setDate) / (1000 * 60 * 60 * 24));
  }

  /** Force a password change on next login. */
  forcePasswordChange(identityId: string): void {
    this._forceChangeFlags.add(identityId);
  }

  /** Check if an identity is flagged for forced password change. */
  isForcePasswordChangeRequired(identityId: string): boolean {
    return this._forceChangeFlags.has(identityId);
  }

  // ── Credential Lifecycle ──────────────────────────────────

  /** Create a credential record. */
  createCredential(
    identityId: string,
    type: CredentialType,
    name?: string,
    metadata?: Record<string, any>,
  ): CredentialRecord {
    const now = new Date().toISOString();
    const credential: CredentialRecord = {
      id: generateId(),
      identityId,
      type,
      status: 'active',
      name,
      fingerprint: generateRandomString(16),
      createdAt: now,
      metadata: metadata ? { ...metadata } : {},
    };

    this._credentials.set(credential.id, credential);

    // Fire callbacks
    this._fireCredentialCreated(credential);

    return { ...credential, metadata: { ...credential.metadata } };
  }

  /** Get a credential by ID. */
  getCredential(id: string): CredentialRecord | undefined {
    const cred = this._credentials.get(id);
    return cred ? { ...cred, metadata: { ...cred.metadata } } : undefined;
  }

  /** Get all credentials for an identity. */
  getCredentialsByIdentity(identityId: string): CredentialRecord[] {
    const results: CredentialRecord[] = [];
    for (const cred of this._credentials.values()) {
      if (cred.identityId === identityId) {
        results.push({ ...cred, metadata: { ...cred.metadata } });
      }
    }
    return results;
  }

  /** Get credentials of a specific type for an identity. */
  getCredentialsByType(identityId: string, type: CredentialType): CredentialRecord[] {
    const results: CredentialRecord[] = [];
    for (const cred of this._credentials.values()) {
      if (cred.identityId === identityId && cred.type === type) {
        results.push({ ...cred, metadata: { ...cred.metadata } });
      }
    }
    return results;
  }

  /** Revoke a credential. */
  revokeCredential(id: string): void {
    const cred = this._credentials.get(id);
    if (!cred) throw new Error(`Credential not found: ${id}`);
    cred.status = 'revoked';
  }

  /** Mark a credential as compromised. */
  markCompromised(id: string): void {
    const cred = this._credentials.get(id);
    if (!cred) throw new Error(`Credential not found: ${id}`);
    cred.status = 'compromised';

    // Fire callbacks
    this._fireCredentialCompromised(cred);
  }

  /**
   * Rotate a credential. Revokes the old one and creates a new
   * credential of the same type for the same identity.
   */
  rotateCredential(id: string): CredentialRecord {
    const old = this._credentials.get(id);
    if (!old) throw new Error(`Credential not found: ${id}`);

    // Revoke the old credential
    old.status = 'revoked';

    // Create a new credential
    const now = new Date().toISOString();
    const newCred: CredentialRecord = {
      id: generateId(),
      identityId: old.identityId,
      type: old.type,
      status: 'active',
      name: old.name,
      fingerprint: generateRandomString(16),
      createdAt: now,
      rotatedAt: now,
      metadata: {
        ...old.metadata,
        _rotatedFrom: old.id,
        _rotatedAt: now,
      },
    };

    this._credentials.set(newCred.id, newCred);

    // Fire callbacks
    this._fireCredentialRotated(newCred);

    return { ...newCred, metadata: { ...newCred.metadata } };
  }

  // ── API Key Management ────────────────────────────────────

  /**
   * Generate a new API key for an identity.
   * Returns the credential record and the raw API key string.
   */
  generateAPIKey(
    identityId: string,
    name: string,
    scope?: string[],
  ): { credential: CredentialRecord; apiKey: string } {
    const apiKey = `soa1_${generateRandomString(32)}`;
    const credential = this.createCredential(identityId, 'api-key', name, {
      _apiKeyPrefix: apiKey.substring(0, 8),
      _scope: scope ?? [],
    });

    // Store the API key mapping
    this._apiKeys.set(apiKey, credential.id);
    if (scope) {
      this._apiKeyScopes.set(credential.id, [...scope]);
    }

    return {
      credential: { ...credential, metadata: { ...credential.metadata } },
      apiKey,
    };
  }

  /**
   * Validate an API key. Returns whether it is valid and the
   * associated identity and scope.
   */
  validateAPIKey(apiKey: string): { valid: boolean; identityId?: string; scope?: string[] } {
    const credentialId = this._apiKeys.get(apiKey);
    if (!credentialId) return { valid: false };

    const credential = this._credentials.get(credentialId);
    if (!credential) return { valid: false };

    if (credential.status !== 'active') return { valid: false };

    // Check expiry
    if (credential.expiresAt && new Date(credential.expiresAt).getTime() < Date.now()) {
      credential.status = 'expired';
      this._fireCredentialExpired(credential);
      return { valid: false };
    }

    // Mark last used
    credential.lastUsedAt = new Date().toISOString();

    const scope = this._apiKeyScopes.get(credentialId);

    return {
      valid: true,
      identityId: credential.identityId,
      scope,
    };
  }

  /** Revoke an API key by its credential ID. */
  revokeAPIKey(credentialId: string): void {
    this.revokeCredential(credentialId);

    // Remove from the API key lookup
    for (const [key, id] of this._apiKeys.entries()) {
      if (id === credentialId) {
        this._apiKeys.delete(key);
        break;
      }
    }

    this._apiKeyScopes.delete(credentialId);
  }

  // ── Recovery Codes ────────────────────────────────────────

  /**
   * Generate recovery codes for an identity.
   * Returns the credential record and the raw codes.
   */
  generateRecoveryCodes(
    identityId: string,
    count: number = 10,
  ): { credential: CredentialRecord; codes: string[] } {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(`${generateRandomString(4)}-${generateRandomString(4)}`.toUpperCase());
    }

    const credential = this.createCredential(identityId, 'recovery-codes', 'Recovery Codes', {
      _totalCodes: count,
      _remainingCodes: count,
    });

    // Store the recovery codes
    this._recoveryCodes.set(identityId, new Set(codes));

    return {
      credential: { ...credential, metadata: { ...credential.metadata } },
      codes: [...codes],
    };
  }

  /**
   * Validate and consume a recovery code.
   * Returns true if the code was valid (and consumes it).
   */
  validateRecoveryCode(identityId: string, code: string): boolean {
    const codes = this._recoveryCodes.get(identityId);
    if (!codes) return false;

    const normalised = code.toUpperCase();
    if (!codes.has(normalised)) return false;

    // Consume the code (one-time use)
    codes.delete(normalised);

    // Update the credential metadata
    for (const cred of this._credentials.values()) {
      if (cred.identityId === identityId && cred.type === 'recovery-codes' && cred.status === 'active') {
        cred.metadata._remainingCodes = codes.size;
        cred.lastUsedAt = new Date().toISOString();
        break;
      }
    }

    return true;
  }

  // ── Password Strength (private) ───────────────────────────

  /**
   * Calculate password strength score and level.
   * Score ranges from 0 to 100.
   */
  private _calculateStrength(password: string): { score: number; level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent' } {
    let score = 0;

    // Length contribution (up to 30 points)
    score += Math.min(password.length * 2, 30);

    // Character variety (up to 40 points)
    if (/[a-z]/.test(password)) score += 8;
    if (/[A-Z]/.test(password)) score += 8;
    if (/[0-9]/.test(password)) score += 8;
    if (/[^A-Za-z0-9]/.test(password)) score += 10;

    // Unique character ratio (up to 6 points)
    const uniqueChars = new Set(password).size;
    const uniqueRatio = uniqueChars / password.length;
    score += Math.round(uniqueRatio * 6);

    // Bonus for length over 12 (up to 10 points)
    if (password.length > 12) {
      score += Math.min((password.length - 12) * 2, 10);
    }

    // Bonus for mixed special characters (up to 6 points)
    const specials = password.replace(/[A-Za-z0-9]/g, '');
    const uniqueSpecials = new Set(specials).size;
    score += Math.min(uniqueSpecials * 3, 6);

    // Penalty for common password
    if (this._checkCommonPasswords(password)) {
      score = Math.max(score - 40, 0);
    }

    // Penalty for sequential patterns
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
      score = Math.max(score - 10, 0);
    }

    // Cap at 100
    score = Math.min(score, 100);

    let level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
    if (score < 20) level = 'weak';
    else if (score < 40) level = 'fair';
    else if (score < 60) level = 'good';
    else if (score < 80) level = 'strong';
    else level = 'excellent';

    return { score, level };
  }

  /**
   * Check if a password appears in the common passwords list.
   * Case-insensitive comparison.
   */
  private _checkCommonPasswords(password: string): boolean {
    const lower = password.toLowerCase();
    return COMMON_PASSWORDS.includes(lower);
  }

  // ── Event Subscriptions ───────────────────────────────────

  /**
   * Register a callback to be invoked when a credential is created.
   *
   * @param cb - Callback receiving the created {@link CredentialRecord}.
   */
  onCredentialCreated(cb: (credential: CredentialRecord) => void): void {
    this._onCredentialCreated.push(cb);
  }

  /**
   * Register a callback to be invoked when a credential is rotated.
   *
   * @param cb - Callback receiving the new {@link CredentialRecord}.
   */
  onCredentialRotated(cb: (credential: CredentialRecord) => void): void {
    this._onCredentialRotated.push(cb);
  }

  /**
   * Register a callback to be invoked when a credential is marked compromised.
   *
   * @param cb - Callback receiving the compromised {@link CredentialRecord}.
   */
  onCredentialCompromised(cb: (credential: CredentialRecord) => void): void {
    this._onCredentialCompromised.push(cb);
  }

  /**
   * Register a callback to be invoked when a credential expires.
   *
   * @param cb - Callback receiving the expired {@link CredentialRecord}.
   */
  onCredentialExpired(cb: (credential: CredentialRecord) => void): void {
    this._onCredentialExpired.push(cb);
  }

  /**
   * Register a callback to be invoked when a password is changed.
   *
   * @param cb - Callback receiving the identity ID.
   */
  onPasswordChanged(cb: (identityId: string) => void): void {
    this._onPasswordChanged.push(cb);
  }

  // ── Getters ───────────────────────────────────────────────

  /** Total number of credential records. */
  get totalCredentials(): number {
    return this._credentials.size;
  }

  /** Number of active credentials. */
  get activeCredentials(): number {
    let count = 0;
    for (const cred of this._credentials.values()) {
      if (cred.status === 'active') count++;
    }
    return count;
  }

  /** Number of compromised credentials. */
  get compromisedCredentials(): number {
    let count = 0;
    for (const cred of this._credentials.values()) {
      if (cred.status === 'compromised') count++;
    }
    return count;
  }

  /** Number of password policies. */
  get policyCount(): number {
    return this._policies.size;
  }

  /** Number of expired credentials. */
  get expiredCredentialCount(): number {
    let count = 0;
    for (const cred of this._credentials.values()) {
      if (cred.status === 'expired') count++;
    }
    return count;
  }

  // ── Private Helpers ───────────────────────────────────────

  /** Resolve a policy by ID, falling back to the default. */
  private _resolvePolicy(policyId?: string): PasswordPolicy {
    if (policyId) {
      const policy = this._policies.get(policyId);
      if (!policy) throw new Error(`Password policy not found: ${policyId}`);
      return policy;
    }
    return this._policies.get('default')!;
  }

  private _fireCredentialCreated(credential: CredentialRecord): void {
    for (const cb of this._onCredentialCreated) {
      try { cb({ ...credential, metadata: { ...credential.metadata } }); } catch { /* swallow listener errors */ }
    }
  }

  private _fireCredentialRotated(credential: CredentialRecord): void {
    for (const cb of this._onCredentialRotated) {
      try { cb({ ...credential, metadata: { ...credential.metadata } }); } catch { /* swallow listener errors */ }
    }
  }

  private _fireCredentialCompromised(credential: CredentialRecord): void {
    for (const cb of this._onCredentialCompromised) {
      try { cb({ ...credential, metadata: { ...credential.metadata } }); } catch { /* swallow listener errors */ }
    }
  }

  private _fireCredentialExpired(credential: CredentialRecord): void {
    for (const cb of this._onCredentialExpired) {
      try { cb({ ...credential, metadata: { ...credential.metadata } }); } catch { /* swallow listener errors */ }
    }
  }

  private _firePasswordChanged(identityId: string): void {
    for (const cb of this._onPasswordChanged) {
      try { cb(identityId); } catch { /* swallow listener errors */ }
    }
  }
}
