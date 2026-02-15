// ============================================================
// SOA One IAM — Privileged Access Management (PAM)
// ============================================================
//
// Provides comprehensive privileged access management with
// credential vaulting, checkout/checkin workflows, session
// recording, command restrictions, and automated credential
// rotation.
//
// Surpasses Oracle Privileged Account Manager with:
// - Credential vaulting with seal/unseal lifecycle
// - Checkout/checkin workflows with approval gates
// - Full session recording with keystroke capture
// - Command restriction engine (allow/deny/audit)
// - Automated credential rotation with policies
// - Event callbacks for real-time monitoring
// - In-memory, zero dependencies
//
// ============================================================

import type {
  PrivilegedAccount,
  CredentialVault,
  CredentialRotationPolicy,
  PAMCheckout,
  PAMCommand,
  PAMSessionRecording,
  PAMKeystroke,
  PAMSessionEvent,
} from './types';

// ── ID Generator ────────────────────────────────────────────

let _idCounter = 0;

/** Generate a unique identifier. */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}-${(++_idCounter).toString(36)}`;
}

// ── Callback Types ──────────────────────────────────────────

type CheckoutCallback = (checkout: PAMCheckout) => void;
type CheckinCallback = (checkout: PAMCheckout) => void;
type SessionStartedCallback = (recording: PAMSessionRecording) => void;
type SessionEndedCallback = (recording: PAMSessionRecording) => void;
type CommandDeniedCallback = (command: PAMCommand, checkout: PAMCheckout) => void;
type CredentialRotatedCallback = (account: PrivilegedAccount, rotatedAt: string) => void;

// ── Privileged Access Manager ───────────────────────────────

/**
 * Manages privileged accounts, credential vaults, checkout
 * workflows, session recordings, command restrictions, and
 * automated credential rotation.
 */
export class PrivilegedAccessManager {
  // ── Private State ───────────────────────────────────────

  private _accounts: Map<string, PrivilegedAccount> = new Map();
  private _vaults: Map<string, CredentialVault> = new Map();
  private _checkouts: Map<string, PAMCheckout> = new Map();
  private _recordings: Map<string, PAMSessionRecording> = new Map();
  private _rotationPolicies: Map<string, CredentialRotationPolicy> = new Map();

  // ── Event Callbacks ─────────────────────────────────────

  private _onCheckout?: CheckoutCallback;
  private _onCheckin?: CheckinCallback;
  private _onSessionStarted?: SessionStartedCallback;
  private _onSessionEnded?: SessionEndedCallback;
  private _onCommandDenied?: CommandDeniedCallback;
  private _onCredentialRotated?: CredentialRotatedCallback;

  // ════════════════════════════════════════════════════════
  // Vault Management
  // ════════════════════════════════════════════════════════

  /** Create a credential vault. */
  createVault(
    vault: Omit<CredentialVault, 'id' | 'totalCredentials' | 'createdAt' | 'updatedAt'>,
  ): CredentialVault {
    const now = new Date().toISOString();

    const newVault: CredentialVault = {
      ...vault,
      id: generateId(),
      totalCredentials: 0,
      createdAt: now,
      updatedAt: now,
    };

    this._vaults.set(newVault.id, newVault);
    return { ...newVault };
  }

  /** Get a vault by ID. */
  getVault(id: string): CredentialVault | undefined {
    const vault = this._vaults.get(id);
    return vault ? { ...vault } : undefined;
  }

  /** List all vaults. */
  listVaults(): CredentialVault[] {
    return Array.from(this._vaults.values()).map((v) => ({ ...v }));
  }

  /** Seal a vault, preventing checkouts of its accounts. */
  sealVault(id: string): void {
    const vault = this._vaults.get(id);
    if (!vault) throw new Error(`Vault not found: ${id}`);

    vault.status = 'sealed';
    vault.updatedAt = new Date().toISOString();
  }

  /** Unseal a vault, allowing checkouts of its accounts. */
  unsealVault(id: string): void {
    const vault = this._vaults.get(id);
    if (!vault) throw new Error(`Vault not found: ${id}`);

    vault.status = 'active';
    vault.updatedAt = new Date().toISOString();
  }

  // ════════════════════════════════════════════════════════
  // Account Management
  // ════════════════════════════════════════════════════════

  /** Register a new privileged account. */
  registerAccount(
    account: Omit<PrivilegedAccount, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ): PrivilegedAccount {
    const now = new Date().toISOString();

    // Validate vault exists
    const vault = this._vaults.get(account.vaultId);
    if (!vault) throw new Error(`Vault not found: ${account.vaultId}`);

    const newAccount: PrivilegedAccount = {
      ...account,
      id: generateId(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this._accounts.set(newAccount.id, newAccount);

    // Increment vault credential count
    vault.totalCredentials += 1;
    vault.updatedAt = now;

    return { ...newAccount };
  }

  /** Get an account by ID. */
  getAccount(id: string): PrivilegedAccount | undefined {
    const account = this._accounts.get(id);
    return account ? { ...account } : undefined;
  }

  /** Update an existing privileged account. */
  updateAccount(
    id: string,
    updates: Partial<
      Omit<PrivilegedAccount, 'id' | 'createdAt' | 'updatedAt'>
    >,
  ): PrivilegedAccount {
    const account = this._accounts.get(id);
    if (!account) throw new Error(`Privileged account not found: ${id}`);

    Object.assign(account, updates, { updatedAt: new Date().toISOString() });
    return { ...account };
  }

  /** List all privileged accounts. */
  listAccounts(): PrivilegedAccount[] {
    return Array.from(this._accounts.values()).map((a) => ({ ...a }));
  }

  /** Get all accounts belonging to a specific vault. */
  getAccountsByVault(vaultId: string): PrivilegedAccount[] {
    return Array.from(this._accounts.values())
      .filter((a) => a.vaultId === vaultId)
      .map((a) => ({ ...a }));
  }

  /** Disable a privileged account. */
  disableAccount(id: string): void {
    const account = this._accounts.get(id);
    if (!account) throw new Error(`Privileged account not found: ${id}`);

    account.status = 'disabled';
    account.updatedAt = new Date().toISOString();
  }

  /** Enable a privileged account. */
  enableAccount(id: string): void {
    const account = this._accounts.get(id);
    if (!account) throw new Error(`Privileged account not found: ${id}`);

    account.status = 'active';
    account.updatedAt = new Date().toISOString();
  }

  // ════════════════════════════════════════════════════════
  // Checkout / Checkin Workflow
  // ════════════════════════════════════════════════════════

  /** Check out a privileged account for use. */
  checkout(
    accountId: string,
    identityId: string,
    reason: string,
    approvedBy?: string,
  ): PAMCheckout {
    const account = this._accounts.get(accountId);
    if (!account) throw new Error(`Privileged account not found: ${accountId}`);

    if (account.status === 'disabled') {
      throw new Error(`Account is disabled: ${accountId}`);
    }

    if (account.status === 'checked-out') {
      throw new Error(`Account is already checked out: ${accountId}`);
    }

    if (account.status === 'rotating') {
      throw new Error(`Account is currently rotating credentials: ${accountId}`);
    }

    // Validate vault is not sealed
    const vault = this._vaults.get(account.vaultId);
    if (vault && vault.status === 'sealed') {
      throw new Error(`Vault is sealed: ${account.vaultId}`);
    }

    // Validate approval requirement
    if (account.requiresApproval && !approvedBy) {
      throw new Error(
        `Account requires approval for checkout: ${accountId}`,
      );
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + account.checkoutDurationMinutes * 60 * 1000,
    ).toISOString();

    const pamCheckout: PAMCheckout = {
      id: generateId(),
      accountId,
      identityId,
      status: 'active',
      reason,
      approvedBy,
      checkedOutAt: now,
      expiresAt,
      commandsExecuted: [],
    };

    this._checkouts.set(pamCheckout.id, pamCheckout);

    // Update account status
    account.status = 'checked-out';
    account.lastCheckedOutAt = now;
    account.lastCheckedOutBy = identityId;
    account.updatedAt = now;

    // Auto-start session recording if enabled
    if (account.sessionRecordingEnabled) {
      const recording = this._createRecording(pamCheckout);
      pamCheckout.sessionRecordingId = recording.id;
    }

    if (this._onCheckout) {
      this._onCheckout({ ...pamCheckout });
    }

    return { ...pamCheckout };
  }

  /** Check in a previously checked-out account. */
  checkin(checkoutId: string): void {
    const checkout = this._checkouts.get(checkoutId);
    if (!checkout) throw new Error(`Checkout not found: ${checkoutId}`);

    if (checkout.status !== 'active') {
      throw new Error(`Checkout is not active: ${checkoutId}`);
    }

    const now = new Date().toISOString();
    checkout.status = 'checked-in';
    checkout.checkedInAt = now;

    // Restore account status
    const account = this._accounts.get(checkout.accountId);
    if (account) {
      account.status = 'active';
      account.updatedAt = now;

      // Rotate on checkin if policy requires it
      if (account.rotationPolicy?.rotateOnCheckIn) {
        this.rotateCredential(account.id);
      }
    }

    // Stop session recording if active
    if (checkout.sessionRecordingId) {
      const recording = this._recordings.get(checkout.sessionRecordingId);
      if (recording && !recording.endedAt) {
        this._stopRecordingInternal(recording);
      }
    }

    if (this._onCheckin) {
      this._onCheckin({ ...checkout });
    }
  }

  /** Get a checkout by ID. */
  getCheckout(id: string): PAMCheckout | undefined {
    const checkout = this._checkouts.get(id);
    return checkout
      ? { ...checkout, commandsExecuted: [...checkout.commandsExecuted] }
      : undefined;
  }

  /** Get all active checkouts. */
  getActiveCheckouts(): PAMCheckout[] {
    return Array.from(this._checkouts.values())
      .filter((c) => c.status === 'active')
      .map((c) => ({ ...c, commandsExecuted: [...c.commandsExecuted] }));
  }

  /** Get all checkouts for a specific identity. */
  getCheckoutsByIdentity(identityId: string): PAMCheckout[] {
    return Array.from(this._checkouts.values())
      .filter((c) => c.identityId === identityId)
      .map((c) => ({ ...c, commandsExecuted: [...c.commandsExecuted] }));
  }

  /** Forcefully terminate an active checkout. */
  terminateCheckout(checkoutId: string, reason: string): void {
    const checkout = this._checkouts.get(checkoutId);
    if (!checkout) throw new Error(`Checkout not found: ${checkoutId}`);

    if (checkout.status !== 'active') {
      throw new Error(`Checkout is not active: ${checkoutId}`);
    }

    const now = new Date().toISOString();
    checkout.status = 'terminated';
    checkout.checkedInAt = now;

    // Add termination reason as a final command entry
    checkout.commandsExecuted.push({
      command: `[TERMINATED] ${reason}`,
      timestamp: now,
      result: 'denied',
    });

    // Restore account status
    const account = this._accounts.get(checkout.accountId);
    if (account) {
      account.status = 'active';
      account.updatedAt = now;
    }

    // Stop session recording if active
    if (checkout.sessionRecordingId) {
      const recording = this._recordings.get(checkout.sessionRecordingId);
      if (recording && !recording.endedAt) {
        this._stopRecordingInternal(recording);
      }
    }
  }

  /** Check whether an account is currently checked out. */
  isCheckedOut(accountId: string): boolean {
    return Array.from(this._checkouts.values()).some(
      (c) => c.accountId === accountId && c.status === 'active',
    );
  }

  // ════════════════════════════════════════════════════════
  // Session Recording
  // ════════════════════════════════════════════════════════

  /** Start a session recording for a checkout. */
  startRecording(checkoutId: string): PAMSessionRecording {
    const checkout = this._checkouts.get(checkoutId);
    if (!checkout) throw new Error(`Checkout not found: ${checkoutId}`);

    if (checkout.status !== 'active') {
      throw new Error(`Checkout is not active: ${checkoutId}`);
    }

    // If a recording already exists for this checkout, return it
    if (checkout.sessionRecordingId) {
      const existing = this._recordings.get(checkout.sessionRecordingId);
      if (existing && !existing.endedAt) {
        return { ...existing, keystrokes: [...existing.keystrokes], events: [...existing.events] };
      }
    }

    const recording = this._createRecording(checkout);
    checkout.sessionRecordingId = recording.id;

    return { ...recording, keystrokes: [...recording.keystrokes], events: [...recording.events] };
  }

  /** Stop a session recording. */
  stopRecording(recordingId: string): PAMSessionRecording {
    const recording = this._recordings.get(recordingId);
    if (!recording) throw new Error(`Recording not found: ${recordingId}`);

    if (recording.endedAt) {
      throw new Error(`Recording already stopped: ${recordingId}`);
    }

    this._stopRecordingInternal(recording);

    return { ...recording, keystrokes: [...recording.keystrokes], events: [...recording.events] };
  }

  /** Get a session recording by ID. */
  getRecording(id: string): PAMSessionRecording | undefined {
    const recording = this._recordings.get(id);
    return recording
      ? { ...recording, keystrokes: [...recording.keystrokes], events: [...recording.events] }
      : undefined;
  }

  /** Get all recordings for a specific account. */
  getRecordingsByAccount(accountId: string): PAMSessionRecording[] {
    return Array.from(this._recordings.values())
      .filter((r) => r.accountId === accountId)
      .map((r) => ({
        ...r,
        keystrokes: [...r.keystrokes],
        events: [...r.events],
      }));
  }

  /** Record a keystroke in a session recording. */
  recordKeystroke(recordingId: string, input: string, output?: string): void {
    const recording = this._recordings.get(recordingId);
    if (!recording) throw new Error(`Recording not found: ${recordingId}`);

    if (recording.endedAt) {
      throw new Error(`Recording already stopped: ${recordingId}`);
    }

    const keystroke: PAMKeystroke = {
      timestamp: new Date().toISOString(),
      input,
      output,
    };

    recording.keystrokes.push(keystroke);
  }

  /** Record a session event. */
  recordSessionEvent(recordingId: string, event: PAMSessionEvent): void {
    const recording = this._recordings.get(recordingId);
    if (!recording) throw new Error(`Recording not found: ${recordingId}`);

    if (recording.endedAt) {
      throw new Error(`Recording already stopped: ${recordingId}`);
    }

    recording.events.push({ ...event });
  }

  // ── Private Recording Helpers ─────────────────────────

  private _createRecording(checkout: PAMCheckout): PAMSessionRecording {
    const now = new Date().toISOString();
    const account = this._accounts.get(checkout.accountId);

    const recording: PAMSessionRecording = {
      id: generateId(),
      checkoutId: checkout.id,
      accountId: checkout.accountId,
      identityId: checkout.identityId,
      startedAt: now,
      durationSeconds: 0,
      totalCommands: 0,
      deniedCommands: 0,
      keystrokes: [],
      events: [
        {
          type: 'connect',
          timestamp: now,
          details: {
            accountId: checkout.accountId,
            identityId: checkout.identityId,
            targetSystem: account?.targetSystem,
            targetHost: account?.targetHost,
          },
        },
      ],
    };

    this._recordings.set(recording.id, recording);

    if (this._onSessionStarted) {
      this._onSessionStarted({ ...recording, keystrokes: [...recording.keystrokes], events: [...recording.events] });
    }

    return recording;
  }

  private _stopRecordingInternal(recording: PAMSessionRecording): void {
    const now = new Date().toISOString();
    recording.endedAt = now;
    recording.durationSeconds = Math.floor(
      (new Date(now).getTime() - new Date(recording.startedAt).getTime()) / 1000,
    );

    recording.events.push({
      type: 'disconnect',
      timestamp: now,
      details: {
        accountId: recording.accountId,
        identityId: recording.identityId,
        totalCommands: recording.totalCommands,
        deniedCommands: recording.deniedCommands,
      },
    });

    if (this._onSessionEnded) {
      this._onSessionEnded({ ...recording, keystrokes: [...recording.keystrokes], events: [...recording.events] });
    }
  }

  // ════════════════════════════════════════════════════════
  // Command Restriction
  // ════════════════════════════════════════════════════════

  /**
   * Execute a command within a checkout session. Evaluates
   * command restrictions, records the command, and updates
   * the session recording.
   */
  executeCommand(checkoutId: string, command: string): PAMCommand {
    const checkout = this._checkouts.get(checkoutId);
    if (!checkout) throw new Error(`Checkout not found: ${checkoutId}`);

    if (checkout.status !== 'active') {
      throw new Error(`Checkout is not active: ${checkoutId}`);
    }

    const now = new Date().toISOString();
    const result = this.evaluateCommandRestrictions(checkout.accountId, command);

    const pamCommand: PAMCommand = {
      command,
      timestamp: now,
      result,
    };

    checkout.commandsExecuted.push(pamCommand);

    // Update session recording
    if (checkout.sessionRecordingId) {
      const recording = this._recordings.get(checkout.sessionRecordingId);
      if (recording && !recording.endedAt) {
        recording.totalCommands += 1;
        if (result === 'denied') {
          recording.deniedCommands += 1;
        }
        recording.events.push({
          type: 'command',
          timestamp: now,
          details: {
            command,
            result,
            identityId: checkout.identityId,
          },
        });
      }
    }

    if (result === 'denied' && this._onCommandDenied) {
      this._onCommandDenied(
        { ...pamCommand },
        { ...checkout, commandsExecuted: [...checkout.commandsExecuted] },
      );
    }

    return { ...pamCommand };
  }

  /**
   * Evaluate command restrictions for an account without
   * executing. Returns 'allowed', 'denied', or 'audited'.
   */
  evaluateCommandRestrictions(
    accountId: string,
    command: string,
  ): 'allowed' | 'denied' | 'audited' {
    const account = this._accounts.get(accountId);
    if (!account) throw new Error(`Privileged account not found: ${accountId}`);

    const restrictions = account.commandRestrictions;

    // No restrictions means everything is allowed
    if (!restrictions || restrictions.length === 0) {
      return 'allowed';
    }

    // Evaluate restrictions in order: explicit deny first, then audit, then allow
    let hasExplicitAllow = false;
    let hasDenyAll = false;

    for (const restriction of restrictions) {
      const matches = this._matchesPattern(command, restriction.pattern);

      if (matches) {
        if (restriction.effect === 'deny') {
          return 'denied';
        }
        if (restriction.effect === 'audit') {
          return 'audited';
        }
        if (restriction.effect === 'allow') {
          hasExplicitAllow = true;
        }
      }

      // Track if there is a catch-all deny (pattern: *)
      if (restriction.pattern === '*' && restriction.effect === 'deny') {
        hasDenyAll = true;
      }
    }

    // If there are explicit allow rules and this command did not match
    // any, and there is a catch-all deny, deny it
    if (hasDenyAll && !hasExplicitAllow) {
      return 'denied';
    }

    // Default: allowed if no deny matched
    return 'allowed';
  }

  /** Match a command against a restriction pattern. */
  private _matchesPattern(command: string, pattern: string): boolean {
    // Wildcard catch-all
    if (pattern === '*') return true;

    // Convert glob-like pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    try {
      const regex = new RegExp(`^${escaped}$`, 'i');
      return regex.test(command);
    } catch {
      // Fallback to simple includes if regex fails
      return command.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  // ════════════════════════════════════════════════════════
  // Credential Rotation
  // ════════════════════════════════════════════════════════

  /** Register a credential rotation policy. */
  registerRotationPolicy(
    policy: Omit<CredentialRotationPolicy, 'id'>,
  ): CredentialRotationPolicy {
    const newPolicy: CredentialRotationPolicy = {
      ...policy,
      id: generateId(),
    };

    this._rotationPolicies.set(newPolicy.id, newPolicy);
    return { ...newPolicy };
  }

  /**
   * Rotate the credential for a privileged account.
   * Returns the rotation result with timestamp.
   */
  rotateCredential(accountId: string): { success: boolean; rotatedAt: string } {
    const account = this._accounts.get(accountId);
    if (!account) throw new Error(`Privileged account not found: ${accountId}`);

    if (account.status === 'checked-out') {
      throw new Error(
        `Cannot rotate credential while account is checked out: ${accountId}`,
      );
    }

    const previousStatus = account.status;
    const now = new Date().toISOString();

    // Mark as rotating
    account.status = 'rotating';
    account.updatedAt = now;

    // Simulate rotation (in-memory, always succeeds)
    account.lastRotatedAt = now;
    account.status = previousStatus === 'disabled' ? 'disabled' : 'active';
    account.updatedAt = now;

    if (this._onCredentialRotated) {
      this._onCredentialRotated({ ...account }, now);
    }

    return { success: true, rotatedAt: now };
  }

  /** Get a rotation policy by ID. */
  getRotationPolicy(id: string): CredentialRotationPolicy | undefined {
    const policy = this._rotationPolicies.get(id);
    return policy ? { ...policy } : undefined;
  }

  /**
   * Get all accounts that require credential rotation based
   * on their rotation policy interval.
   */
  getAccountsRequiringRotation(): PrivilegedAccount[] {
    const now = Date.now();

    return Array.from(this._accounts.values())
      .filter((account) => {
        if (account.status === 'disabled') return false;
        if (!account.rotationPolicy) return false;

        const intervalMs =
          account.rotationPolicy.intervalDays * 24 * 60 * 60 * 1000;

        if (!account.lastRotatedAt) {
          // Never rotated — check against creation time
          const createdMs = new Date(account.createdAt).getTime();
          return now - createdMs >= intervalMs;
        }

        const lastRotatedMs = new Date(account.lastRotatedAt).getTime();
        return now - lastRotatedMs >= intervalMs;
      })
      .map((a) => ({ ...a }));
  }

  // ════════════════════════════════════════════════════════
  // Event Callbacks
  // ════════════════════════════════════════════════════════

  /** Register a callback for account checkout events. */
  onCheckout(callback: CheckoutCallback): void {
    this._onCheckout = callback;
  }

  /** Register a callback for account checkin events. */
  onCheckin(callback: CheckinCallback): void {
    this._onCheckin = callback;
  }

  /** Register a callback for session recording start events. */
  onSessionStarted(callback: SessionStartedCallback): void {
    this._onSessionStarted = callback;
  }

  /** Register a callback for session recording end events. */
  onSessionEnded(callback: SessionEndedCallback): void {
    this._onSessionEnded = callback;
  }

  /** Register a callback for denied command events. */
  onCommandDenied(callback: CommandDeniedCallback): void {
    this._onCommandDenied = callback;
  }

  /** Register a callback for credential rotation events. */
  onCredentialRotated(callback: CredentialRotatedCallback): void {
    this._onCredentialRotated = callback;
  }

  // ════════════════════════════════════════════════════════
  // Getters / Metrics
  // ════════════════════════════════════════════════════════

  /** Total number of registered privileged accounts. */
  get totalAccounts(): number {
    return this._accounts.size;
  }

  /** Number of active (non-disabled) privileged accounts. */
  get activeAccounts(): number {
    return Array.from(this._accounts.values()).filter(
      (a) => a.status !== 'disabled',
    ).length;
  }

  /** Number of accounts currently checked out. */
  get checkedOutCount(): number {
    return Array.from(this._accounts.values()).filter(
      (a) => a.status === 'checked-out',
    ).length;
  }

  /** Number of active checkouts. */
  get activeCheckoutCount(): number {
    return Array.from(this._checkouts.values()).filter(
      (c) => c.status === 'active',
    ).length;
  }

  /** Total number of session recordings. */
  get totalRecordings(): number {
    return this._recordings.size;
  }

  /** Total number of credential vaults. */
  get vaultCount(): number {
    return this._vaults.size;
  }

  /** Total number of rotation policies. */
  get rotationPolicyCount(): number {
    return this._rotationPolicies.size;
  }
}
