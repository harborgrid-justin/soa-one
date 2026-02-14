// ============================================================
// SOA One IAM — IdentityAccessManager (Main Orchestrator)
// ============================================================
//
// The IdentityAccessManager is the central orchestrator that
// ties together all IAM subsystems: identity management,
// authentication, authorization, directory services,
// federation, session management, token service, identity
// governance, privileged access management, risk engine,
// credential management, monitoring, and security.
//
// Provides a unified API for:
// - Identity lifecycle (provisioning, deprovisioning)
// - Authentication (MFA, adaptive, passwordless, SSO)
// - Authorization (RBAC, ABAC, PBAC, dynamic)
// - Directory services (LDAP-compatible, virtual directory)
// - Federation (SAML 2.0, OAuth 2.0, OIDC, SCIM)
// - Session management (distributed, SSO, binding)
// - Token service (JWT, SAML tokens, token exchange)
// - Identity governance (certifications, SoD, compliance)
// - Privileged access management (vault, recording)
// - Risk engine (adaptive scoring, anomaly detection)
// - Credential management (password policies, rotation)
// - Monitoring, metrics, and alerting
// - Security: access control, masking, audit logging
//
// Surpasses Oracle Identity and Access Manager. 100%
// compatible with @soa-one/engine SDK via the IAM plugin.
// ============================================================

import type {
  IAMConfig,
  IAMMetrics,
  IAMEvent,
  IAMEventType,
  IAMEventListener,
  IdentityCreateRequest,
  Role,
  AccessPolicy,
  AuthenticationPolicy,
  PasswordPolicy,
  IdentityProviderConfig,
  ServiceProviderConfig,
  SSOConfiguration,
  RiskScoringRule,
  SoDPolicy,
  PrivilegedAccount,
  CredentialVault,
  ThreatIntelIndicator,
  IAMAlertRuleDefinition,
  IAMAccessPolicy,
  IAMMaskingRule,
  Organization,
  IdentityGroup,
} from './types';

import { IdentityManager } from './identity';
import { AuthenticationEngine } from './authentication';
import { AuthorizationEngine } from './authorization';
import { DirectoryService } from './directory';
import { FederationManager } from './federation';
import { SessionManager } from './session';
import { TokenService } from './token';
import { GovernanceEngine } from './governance';
import { PrivilegedAccessManager } from './pam';
import { RiskEngine } from './risk';
import { CredentialManager } from './credential';
import { IAMMonitoringManager } from './monitoring';
import { IAMSecurityManager } from './security';

// ── IdentityAccessManager ─────────────────────────────────────

/**
 * Central Identity and Access Management orchestrator.
 *
 * Usage:
 * ```ts
 * const iam = new IdentityAccessManager({
 *   name: 'enterprise-iam',
 *   auditEnabled: true,
 * });
 *
 * await iam.init();
 *
 * // Create an identity
 * const identity = iam.identities.createIdentity({
 *   username: 'jdoe',
 *   email: 'jdoe@example.com',
 *   displayName: 'John Doe',
 * });
 *
 * // Authenticate
 * const result = iam.authentication.authenticate({
 *   username: 'jdoe',
 *   password: 'secret',
 *   method: 'password',
 * });
 *
 * // Authorize
 * const decision = iam.authorization.authorize({
 *   subjectId: identity.id,
 *   resource: 'orders',
 *   action: 'read',
 * });
 *
 * // Integrate with rule engine
 * import { RuleEngine } from '@soa-one/engine';
 * import { createIAMPlugin } from '@soa-one/iam';
 *
 * const engine = new RuleEngine({
 *   plugins: [createIAMPlugin(iam)],
 * });
 *
 * await iam.shutdown();
 * ```
 */
export class IdentityAccessManager {
  readonly name: string;
  private readonly _config: IAMConfig;

  // Subsystems
  private readonly _identities: IdentityManager;
  private readonly _authentication: AuthenticationEngine;
  private readonly _authorization: AuthorizationEngine;
  private readonly _directory: DirectoryService;
  private readonly _federation: FederationManager;
  private readonly _sessions: SessionManager;
  private readonly _tokens: TokenService;
  private readonly _governance: GovernanceEngine;
  private readonly _pam: PrivilegedAccessManager;
  private readonly _risk: RiskEngine;
  private readonly _credentials: CredentialManager;
  private readonly _monitoring: IAMMonitoringManager;
  private readonly _security: IAMSecurityManager;

  // Event listeners
  private _eventListeners: Map<string, IAMEventListener[]> = new Map();

  // State
  private _initialized = false;
  private _destroyed = false;
  private _startTime = Date.now();

  constructor(config: IAMConfig) {
    this.name = config.name;
    this._config = config;

    // Initialize subsystems
    this._identities = new IdentityManager();
    this._authentication = new AuthenticationEngine();
    this._authorization = new AuthorizationEngine();
    this._directory = new DirectoryService();
    this._federation = new FederationManager();
    this._sessions = new SessionManager(config.sessionConfig);
    this._tokens = new TokenService(config.tokenSigningConfig);
    this._governance = new GovernanceEngine();
    this._pam = new PrivilegedAccessManager();
    this._risk = new RiskEngine();
    this._credentials = new CredentialManager();
    this._monitoring = new IAMMonitoringManager();
    this._security = new IAMSecurityManager();

    // Register configured organizations
    for (const org of config.organizations ?? []) {
      this._identities.createOrganization(org);
    }

    // Register configured groups
    for (const group of config.groups ?? []) {
      this._identities.createGroup(group);
    }

    // Register configured identities
    for (const identity of config.identities ?? []) {
      this._identities.createIdentity(identity);
    }

    // Register configured roles
    for (const role of config.roles ?? []) {
      this._authorization.createRole(role);
    }

    // Register configured access policies
    for (const policy of config.policies ?? []) {
      this._authorization.createPolicy(policy);
    }

    // Register configured authentication policies
    for (const policy of config.authenticationPolicies ?? []) {
      this._authentication.createAuthPolicy(policy);
    }

    // Register configured password policies
    for (const policy of config.passwordPolicies ?? []) {
      this._credentials.createPasswordPolicy(policy);
    }

    // Register configured identity providers
    for (const idp of config.identityProviders ?? []) {
      this._federation.registerIdentityProvider(idp);
    }

    // Register configured service providers
    for (const sp of config.serviceProviders ?? []) {
      this._federation.registerServiceProvider(sp);
    }

    // Register configured SSO configurations
    for (const sso of config.ssoConfigurations ?? []) {
      this._authentication.configureSSOConfig(sso);
    }

    // Register configured risk scoring rules
    for (const rule of config.riskScoringRules ?? []) {
      this._risk.createRule(rule);
    }

    // Register configured SoD policies
    for (const policy of config.sodPolicies ?? []) {
      this._governance.createSoDPolicy(policy);
    }

    // Register configured privileged accounts
    for (const account of config.privilegedAccounts ?? []) {
      this._pam.registerAccount(account);
    }

    // Register configured credential vaults
    for (const vault of config.credentialVaults ?? []) {
      this._pam.createVault(vault);
    }

    // Register configured threat indicators
    for (const indicator of config.threatIndicators ?? []) {
      this._risk.addThreatIndicator(indicator);
    }

    // Register configured alert rules
    for (const rule of config.alertRules ?? []) {
      this._monitoring.alerts.registerRule(rule);
    }

    // Register configured IAM access policies
    for (const policy of config.accessPolicies ?? []) {
      this._security.accessControl.registerPolicy(policy);
    }

    // Register configured masking rules
    for (const rule of config.maskingRules ?? []) {
      this._security.masker.registerRule(rule);
    }

    // ── Wire up subsystem lifecycle events ──────────────────

    // Identity events
    this._identities.onCreated((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.created');
      this._emitEvent('identity:created', 'IdentityManager');
    });

    this._identities.onActivated((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.activated');
      this._emitEvent('identity:activated', 'IdentityManager');
    });

    this._identities.onSuspended((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.suspended');
      this._emitEvent('identity:suspended', 'IdentityManager');
    });

    this._identities.onLocked((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.locked');
      this._emitEvent('identity:locked', 'IdentityManager');
    });

    this._identities.onUnlocked((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.unlocked');
      this._emitEvent('identity:unlocked', 'IdentityManager');
    });

    this._identities.onDeprovisioned((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.deprovisioned');
      this._emitEvent('identity:deprovisioned', 'IdentityManager');
    });

    this._identities.onDeleted((_identity) => {
      this._monitoring.metrics.incrementCounter('identity.deleted');
      this._emitEvent('identity:deleted', 'IdentityManager');
    });

    // Authentication events (setter-based callbacks)
    this._authentication.onLoginSuccess = (_identityId: string, _result: any) => {
      this._monitoring.metrics.incrementCounter('auth.login.success');
      this._emitEvent('auth:login-success', 'AuthenticationEngine');
    };

    this._authentication.onLoginFailed = (_identityId: string | undefined, _result: any) => {
      this._monitoring.metrics.incrementCounter('auth.login.failed');
      this._emitEvent('auth:login-failed', 'AuthenticationEngine');
    };

    this._authentication.onMFAChallenge = (_identityId: string, _challenge: any) => {
      this._monitoring.metrics.incrementCounter('auth.mfa.challenge');
      this._emitEvent('auth:mfa-challenge', 'AuthenticationEngine');
    };

    this._authentication.onMFASuccess = (_identityId: string, _method: any) => {
      this._monitoring.metrics.incrementCounter('auth.mfa.success');
      this._emitEvent('auth:mfa-success', 'AuthenticationEngine');
    };

    this._authentication.onMFAFailed = (_identityId: string, _method: any) => {
      this._monitoring.metrics.incrementCounter('auth.mfa.failed');
      this._emitEvent('auth:mfa-failed', 'AuthenticationEngine');
    };

    this._authentication.onAccountLocked = (_identityId: string) => {
      this._monitoring.metrics.incrementCounter('auth.account.locked');
      this._emitEvent('auth:account-locked', 'AuthenticationEngine');
    };

    // Authorization events
    this._authorization.onAccessGranted((_decision) => {
      this._monitoring.metrics.incrementCounter('authz.access.granted');
      this._emitEvent('authz:access-granted', 'AuthorizationEngine');
    });

    this._authorization.onAccessDenied((_decision) => {
      this._monitoring.metrics.incrementCounter('authz.access.denied');
      this._emitEvent('authz:access-denied', 'AuthorizationEngine');
    });

    this._authorization.onRoleAssigned((_assignment) => {
      this._monitoring.metrics.incrementCounter('authz.role.assigned');
      this._emitEvent('authz:role-assigned', 'AuthorizationEngine');
    });

    this._authorization.onRoleRevoked((_info) => {
      this._monitoring.metrics.incrementCounter('authz.role.revoked');
      this._emitEvent('authz:role-revoked', 'AuthorizationEngine');
    });

    // Session events
    this._sessions.onSessionCreated((_session) => {
      this._monitoring.metrics.incrementCounter('session.created');
      this._emitEvent('session:created', 'SessionManager');
    });

    this._sessions.onSessionExpired((_session) => {
      this._monitoring.metrics.incrementCounter('session.expired');
      this._emitEvent('session:expired', 'SessionManager');
    });

    this._sessions.onSessionRevoked((_session) => {
      this._monitoring.metrics.incrementCounter('session.revoked');
      this._emitEvent('session:revoked', 'SessionManager');
    });

    // Token events (property-based callbacks)
    this._tokens.onTokenIssued = (_token: any) => {
      this._monitoring.metrics.incrementCounter('token.issued');
      this._emitEvent('token:issued', 'TokenService');
    };

    this._tokens.onTokenRevoked = (_tokenId: string) => {
      this._monitoring.metrics.incrementCounter('token.revoked');
      this._emitEvent('token:revoked', 'TokenService');
    };

    this._tokens.onTokenRefreshed = (_oldTokenId: string, _newToken: any) => {
      this._monitoring.metrics.incrementCounter('token.refreshed');
      this._emitEvent('token:refreshed', 'TokenService');
    };

    // Federation events
    this._federation.onSSOLogin((_data) => {
      this._monitoring.metrics.incrementCounter('federation.sso.login');
      this._emitEvent('federation:sso-login', 'FederationManager');
    });

    this._federation.onSSOLogout((_data) => {
      this._monitoring.metrics.incrementCounter('federation.sso.logout');
      this._emitEvent('federation:sso-logout', 'FederationManager');
    });

    this._federation.onProvisionedViaFederation((_data) => {
      this._monitoring.metrics.incrementCounter('federation.provisioned');
      this._emitEvent('federation:provisioned', 'FederationManager');
    });

    this._federation.onDeprovisionedViaFederation((_data) => {
      this._monitoring.metrics.incrementCounter('federation.deprovisioned');
      this._emitEvent('federation:deprovisioned', 'FederationManager');
    });

    // Governance events
    this._governance.onCertificationStarted((_campaign) => {
      this._monitoring.metrics.incrementCounter('governance.certification.started');
      this._emitEvent('governance:certification-started', 'GovernanceEngine');
    });

    this._governance.onCertificationCompleted((_campaign) => {
      this._monitoring.metrics.incrementCounter('governance.certification.completed');
      this._emitEvent('governance:certification-completed', 'GovernanceEngine');
    });

    this._governance.onSoDViolationDetected((_violation) => {
      this._monitoring.metrics.incrementCounter('governance.sod.violation');
      this._emitEvent('governance:sod-violation-detected', 'GovernanceEngine');
    });

    this._governance.onAccessRequestCreated((_request) => {
      this._monitoring.metrics.incrementCounter('governance.access.request');
      this._emitEvent('governance:access-request-created', 'GovernanceEngine');
    });

    this._governance.onAccessRequestApproved((_request) => {
      this._monitoring.metrics.incrementCounter('governance.access.approved');
      this._emitEvent('governance:access-request-approved', 'GovernanceEngine');
    });

    this._governance.onAccessRequestRejected((_request) => {
      this._monitoring.metrics.incrementCounter('governance.access.rejected');
      this._emitEvent('governance:access-request-rejected', 'GovernanceEngine');
    });

    // PAM events
    this._pam.onCheckout((_checkout) => {
      this._monitoring.metrics.incrementCounter('pam.checkout');
      this._emitEvent('pam:checkout', 'PrivilegedAccessManager');
    });

    this._pam.onCheckin((_checkout) => {
      this._monitoring.metrics.incrementCounter('pam.checkin');
      this._emitEvent('pam:checkin', 'PrivilegedAccessManager');
    });

    this._pam.onSessionStarted((_recording) => {
      this._monitoring.metrics.incrementCounter('pam.session.started');
      this._emitEvent('pam:session-started', 'PrivilegedAccessManager');
    });

    this._pam.onSessionEnded((_recording) => {
      this._monitoring.metrics.incrementCounter('pam.session.ended');
      this._emitEvent('pam:session-ended', 'PrivilegedAccessManager');
    });

    this._pam.onCommandDenied((_command) => {
      this._monitoring.metrics.incrementCounter('pam.command.denied');
      this._emitEvent('pam:command-denied', 'PrivilegedAccessManager');
    });

    this._pam.onCredentialRotated((_info) => {
      this._monitoring.metrics.incrementCounter('pam.credential.rotated');
      this._emitEvent('pam:credential-rotated', 'PrivilegedAccessManager');
    });

    // Risk events
    this._risk.onRiskAssessed((_assessment) => {
      this._monitoring.metrics.incrementCounter('risk.assessed');
      this._emitEvent('risk:assessment-completed', 'RiskEngine');
    });

    this._risk.onAnomalyDetected((_anomaly) => {
      this._monitoring.metrics.incrementCounter('risk.anomaly.detected');
      this._emitEvent('risk:anomaly-detected', 'RiskEngine');
    });

    this._risk.onThreatIndicatorMatched((_indicator) => {
      this._monitoring.metrics.incrementCounter('risk.threat.matched');
      this._emitEvent('risk:threat-indicator-matched', 'RiskEngine');
    });

    // Credential events
    this._credentials.onCredentialCreated((_credential) => {
      this._monitoring.metrics.incrementCounter('credential.created');
      this._emitEvent('credential:created', 'CredentialManager');
    });

    this._credentials.onCredentialRotated((_credential) => {
      this._monitoring.metrics.incrementCounter('credential.rotated');
      this._emitEvent('credential:rotated', 'CredentialManager');
    });

    this._credentials.onCredentialCompromised((_credential) => {
      this._monitoring.metrics.incrementCounter('credential.compromised');
      this._emitEvent('credential:compromised', 'CredentialManager');
    });

    this._credentials.onPasswordChanged((_identityId) => {
      this._monitoring.metrics.incrementCounter('credential.password.changed');
      this._emitEvent('auth:password-changed', 'CredentialManager');
    });

    // Monitoring alerts
    this._monitoring.alerts.onAlert((_alert) => {
      this._emitEvent('alert:fired', 'IAMMonitoring');
    });

    this._monitoring.alerts.onResolved((_alert) => {
      this._emitEvent('alert:resolved', 'IAMMonitoring');
    });
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Initialize the IdentityAccessManager. */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (this._destroyed) {
      throw new Error('Cannot init a destroyed IdentityAccessManager. Create a new instance.');
    }

    this._initialized = true;
    this._startTime = Date.now();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'iam.started',
        actor: 'system',
        resource: this.name,
        resourceType: 'IdentityAccessManager',
        details: {
          identities: this._identities.count,
          roles: this._authorization.roleCount,
          policies: this._authorization.policyCount,
          identityProviders: this._federation.identityProviderCount,
          serviceProviders: this._federation.serviceProviderCount,
          sodPolicies: this._governance.totalSoDPolicies,
          privilegedAccounts: this._pam.totalAccounts,
          riskRules: this._risk.ruleCount,
        },
        success: true,
      });
    }

    this._emitEvent('iam:started', 'IdentityAccessManager');
  }

  /** Shut down the IdentityAccessManager. */
  async shutdown(): Promise<void> {
    if (this._destroyed) return;

    // Shut down monitoring
    this._monitoring.shutdown();

    // Audit
    if (this._config.auditEnabled !== false) {
      this._security.recordAudit({
        action: 'iam.stopped',
        actor: 'system',
        resource: this.name,
        resourceType: 'IdentityAccessManager',
        details: {},
        success: true,
      });
    }

    this._emitEvent('iam:stopped', 'IdentityAccessManager');

    this._initialized = false;
    this._destroyed = true;
  }

  /** Whether the module is initialized. */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /** Whether the module has been shut down. */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ── Subsystem Access ────────────────────────────────────

  /** Access the identity manager. */
  get identities(): IdentityManager {
    return this._identities;
  }

  /** Access the authentication engine. */
  get authentication(): AuthenticationEngine {
    return this._authentication;
  }

  /** Access the authorization engine. */
  get authorization(): AuthorizationEngine {
    return this._authorization;
  }

  /** Access the directory service. */
  get directory(): DirectoryService {
    return this._directory;
  }

  /** Access the federation manager. */
  get federation(): FederationManager {
    return this._federation;
  }

  /** Access the session manager. */
  get sessions(): SessionManager {
    return this._sessions;
  }

  /** Access the token service. */
  get tokens(): TokenService {
    return this._tokens;
  }

  /** Access the governance engine. */
  get governance(): GovernanceEngine {
    return this._governance;
  }

  /** Access the privileged access manager. */
  get pam(): PrivilegedAccessManager {
    return this._pam;
  }

  /** Access the risk engine. */
  get risk(): RiskEngine {
    return this._risk;
  }

  /** Access the credential manager. */
  get credentials(): CredentialManager {
    return this._credentials;
  }

  /** Access the monitoring manager. */
  get monitoring(): IAMMonitoringManager {
    return this._monitoring;
  }

  /** Access the security manager. */
  get security(): IAMSecurityManager {
    return this._security;
  }

  // ── Metrics ─────────────────────────────────────────────

  /** Get a snapshot of IAM metrics. */
  getMetrics(): IAMMetrics {
    return {
      // Identity
      totalIdentities: this._identities.count,
      activeIdentities: this._identities.activeCount,
      suspendedIdentities: this._identities.suspendedCount,
      lockedIdentities: this._identities.lockedCount,
      totalOrganizations: this._identities.organizationCount,
      totalGroups: this._identities.groupCount,

      // Authentication
      authenticationsTotal: this._authentication.totalAuthentications,
      authenticationsSuccessful: this._authentication.successfulAuthentications,
      authenticationsFailed: this._authentication.failedAuthentications,
      mfaChallengesIssued: this._authentication.mfaChallengesIssued,
      mfaChallengesCompleted: this._authentication.mfaChallengesCompleted,
      activeSessions: this._sessions.activeSessionCount,

      // Authorization
      totalRoles: this._authorization.roleCount,
      totalPermissions: this._authorization.permissionCount,
      totalPolicies: this._authorization.policyCount,
      authorizationDecisions: this._authorization.totalDecisions,
      authorizationDenials: this._authorization.denyCount,

      // Directory
      totalDirectoryEntries: this._directory.entryCount,

      // Federation
      totalIdentityProviders: this._federation.identityProviderCount,
      totalServiceProviders: this._federation.serviceProviderCount,
      federatedAuthenticationsTotal: this._federation.federatedAuthTotal,

      // Tokens
      tokensIssued: this._tokens.totalTokensIssued,
      tokensRevoked: this._tokens.totalTokensRevoked,
      activeTokens: this._tokens.activeTokenCount,

      // Governance
      activeCertificationCampaigns: this._governance.activeCampaignCount,
      totalSoDPolicies: this._governance.totalSoDPolicies,
      activeSoDViolations: this._governance.activeSoDViolationCount,
      pendingAccessRequests: this._governance.pendingAccessRequestCount,

      // PAM
      totalPrivilegedAccounts: this._pam.totalAccounts,
      activeCheckouts: this._pam.activeCheckoutCount,
      totalSessionRecordings: this._pam.totalRecordings,

      // Risk
      averageRiskScore: this._risk.averageRiskScore,
      highRiskSessions: this._risk.highRiskSessionCount,
      anomaliesDetected: this._risk.anomalyCount,
      activeThreatIndicators: this._risk.activeThreatIndicatorCount,

      // General
      activeAlerts: this._monitoring.alerts.activeCount,
      uptimeMs: Date.now() - this._startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Events ──────────────────────────────────────────────

  /** Subscribe to IAM events. */
  on(eventType: IAMEventType, listener: IAMEventListener): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, []);
    }
    this._eventListeners.get(eventType)!.push(listener);
  }

  /** Unsubscribe from IAM events. */
  off(eventType: IAMEventType, listener: IAMEventListener): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  // ── Private ─────────────────────────────────────────────

  private _emitEvent(
    type: IAMEventType,
    source: string,
    data?: Record<string, any>,
    identityId?: string,
    sessionId?: string,
  ): void {
    const event: IAMEvent = {
      type,
      timestamp: new Date().toISOString(),
      source,
      data,
      identityId,
      sessionId,
    };

    const listeners = this._eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    }
  }
}
