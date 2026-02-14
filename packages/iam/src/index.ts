// ============================================================
// SOA One IAM — Public API
// ============================================================
//
// Identity and Access Management module for SOA One.
// Zero-dependency, 100% compatible with @soa-one/engine SDK.
//
// Surpasses Oracle Identity and Access Manager with:
// - Identity lifecycle (provisioning, deprovisioning, self-service)
// - Authentication (MFA, adaptive, passwordless, SSO)
// - Authorization (RBAC, ABAC, PBAC, dynamic)
// - Directory services (LDAP-compatible, virtual directory)
// - Federation (SAML 2.0, OAuth 2.0, OIDC, WS-Federation, SCIM)
// - Session management (distributed, SSO, binding)
// - Token service (JWT, SAML tokens, token exchange, RFC 8693)
// - Identity governance (certifications, SoD, compliance)
// - Privileged access management (vault, session recording)
// - Risk engine (adaptive scoring, behavioral analytics)
// - Credential management (password policies, rotation, MFA)
// - Monitoring, metrics, and alerting
// - Security: access control, masking, audit logging
// - Full @soa-one/engine integration via plugin
// ============================================================

// ── Core Types ──────────────────────────────────────────────

export type {
  // Identity types
  IdentityStatus,
  IdentityType,
  VerificationLevel,
  Identity,
  IdentityCreateRequest,
  IdentityUpdateRequest,
  IdentitySearchQuery,
  Organization,
  IdentityGroup,
  GroupDynamicRule,
  ProvisioningAction,
  ProvisioningRecord,

  // Authentication types
  AuthMethod,
  AuthFactorType,
  AuthenticationStatus,
  AuthenticationRequest,
  AuthenticationResult,
  MFAChallenge,
  MFAEnrollment,
  AuthenticationPolicy,
  AuthPolicyCondition,
  MFAExemptionRule,
  GeoLocation,
  TimeWindow,
  SSOConfiguration,

  // Authorization types
  AuthorizationModel,
  PermissionEffect,
  Role,
  Permission,
  PermissionCondition,
  RoleConstraint,
  RoleAssignment,
  AuthorizationRequest,
  AuthorizationDecision,
  AuthorizationObligation,
  AccessPolicy,
  PolicySubject,
  PolicyResource,

  // Directory types
  DirectoryEntryType,
  DirectoryEntry,
  DirectorySearchFilter,
  DirectorySearchOptions,
  DirectorySchema,
  DirectoryObjectClass,
  DirectoryAttributeType,
  VirtualDirectoryConfig,
  VirtualDirectorySource,

  // Federation types
  FederationProtocol,
  ProviderStatus,
  SAMLBinding,
  SAMLNameIdFormat,
  IdentityProviderConfig,
  ServiceProviderConfig,
  FederationTrust,
  AttributeFilter,
  SCIMResource,
  SCIMMeta,
  SCIMProvisioningConfig,

  // Session types
  SessionStatus,
  SessionType,
  Session,
  SessionConfig,
  SessionQuery,

  // Token types
  TokenType,
  TokenStatus,
  TokenRecord,
  TokenIssuanceRequest,
  TokenValidationResult,
  TokenExchangeRequest,
  TokenExchangeResult,
  JWTSigningConfig,

  // Governance types
  CertificationCampaign,
  CertificationScope,
  CertificationReviewer,
  CertificationSchedule,
  RemediationPolicy,
  CertificationDecision,
  SoDPolicy,
  SoDRoleConflict,
  SoDPermissionConflict,
  SoDExemption,
  SoDViolation,
  AccessRequest,
  AccessApproval,

  // PAM types
  PrivilegedAccountType,
  PrivilegedAccount,
  CredentialVault,
  CredentialRotationPolicy,
  CommandRestriction,
  PAMCheckout,
  PAMCommand,
  PAMSessionRecording,
  PAMKeystroke,
  PAMSessionEvent,

  // Risk types
  RiskLevel,
  RiskFactorCategory,
  RiskAssessment,
  RiskFactor,
  RiskScoringRule,
  RiskCondition,
  BehavioralProfile,
  AnomalyDetectionResult,
  ThreatIntelIndicator,

  // Credential types
  CredentialType,
  PasswordComplexity,
  PasswordPolicy,
  CredentialRecord,
  CredentialValidationResult,

  // Monitoring types
  IAMMetricType,
  IAMAlertSeverity,
  IAMAlertStatus,
  IAMAlertRuleDefinition,
  IAMAlertInstance,
  IAMMetricDataPoint,

  // Security types
  IAMSecurityAction,
  IAMAccessPolicy,
  IAMMaskingStrategy,
  IAMMaskingRule,
  IAMAuditEntry,

  // Metrics
  IAMMetrics,

  // Event types
  IAMEventType,
  IAMEvent,
  IAMEventListener,

  // Configuration
  IAMConfig,
} from './types';

// ── IdentityAccessManager (Main Entry Point) ────────────────

export { IdentityAccessManager } from './iam';

// ── Identity Management ─────────────────────────────────────

export {
  IdentityManager,
  generateId,
} from './identity';

// ── Authentication Engine ───────────────────────────────────

export { AuthenticationEngine } from './authentication';

// ── Authorization Engine ────────────────────────────────────

export { AuthorizationEngine } from './authorization';

// ── Directory Services ──────────────────────────────────────

export { DirectoryService } from './directory';

// ── Federation Manager ──────────────────────────────────────

export { FederationManager } from './federation';

// ── Session Manager ─────────────────────────────────────────

export { SessionManager } from './session';

// ── Token Service ───────────────────────────────────────────

export { TokenService } from './token';

// ── Identity Governance ─────────────────────────────────────

export { GovernanceEngine } from './governance';

// ── Privileged Access Management ────────────────────────────

export { PrivilegedAccessManager } from './pam';

// ── Risk Engine ─────────────────────────────────────────────

export { RiskEngine } from './risk';

// ── Credential Manager ──────────────────────────────────────

export { CredentialManager } from './credential';

// ── Monitoring & Metrics ────────────────────────────────────

export {
  IAMMonitoringManager,
  IAMMetricCollector,
  IAMAlertEngine,
} from './monitoring';

// ── Security ────────────────────────────────────────────────

export {
  IAMSecurityManager,
  IAMAccessControl,
  IAMDataMasker,
  IAMAuditLogger,
} from './security';

// ── Engine Plugin ───────────────────────────────────────────

export {
  createIAMPlugin,
  type EnginePlugin,
} from './plugin';
