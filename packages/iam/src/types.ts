// ============================================================
// SOA One IAM — Type Definitions
// ============================================================
//
// Comprehensive type system for the Identity and Access
// Management module. Surpasses Oracle Identity and Access
// Manager with:
//
// - Identity lifecycle management (provisioning, deprovisioning)
// - Authentication engine (MFA, adaptive, passwordless, SSO)
// - Authorization engine (RBAC, ABAC, PBAC, dynamic)
// - Directory services (LDAP-compatible, virtual directory)
// - Federation (SAML 2.0, OAuth 2.0, OIDC, WS-Federation, SCIM)
// - Session management (distributed, SSO, binding)
// - Token service (JWT, SAML tokens, token exchange)
// - Identity governance (access certifications, SoD, compliance)
// - Privileged access management (vault, session recording)
// - Risk engine (adaptive scoring, behavioral analytics)
// - Credential management (password policies, rotation, MFA)
// - Monitoring, metrics, and alerting
// - Security: access control, data masking, audit logging
//
// Zero-dependency. 100% compatible with @soa-one/engine SDK.
// ============================================================

// ── Identity Types ──────────────────────────────────────────

/** Identity status in the lifecycle. */
export type IdentityStatus =
  | 'staged'
  | 'provisioned'
  | 'active'
  | 'suspended'
  | 'locked'
  | 'password-expired'
  | 'deprovisioned'
  | 'deleted';

/** Type of identity. */
export type IdentityType =
  | 'user'
  | 'service-account'
  | 'machine'
  | 'external'
  | 'federated'
  | 'bot';

/** Identity verification level. */
export type VerificationLevel =
  | 'unverified'
  | 'email-verified'
  | 'phone-verified'
  | 'document-verified'
  | 'biometric-verified'
  | 'fully-verified';

/** Core identity representation. */
export interface Identity {
  id: string;
  externalId?: string;
  username: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  displayName: string;
  firstName?: string;
  lastName?: string;
  type: IdentityType;
  status: IdentityStatus;
  verificationLevel: VerificationLevel;
  organizationId?: string;
  departmentId?: string;
  managerId?: string;
  title?: string;
  locale?: string;
  timezone?: string;
  profileImageUrl?: string;
  attributes: Record<string, any>;
  roles: string[];
  groups: string[];
  tags: string[];
  metadata: Record<string, any>;
  lastLoginAt?: string;
  lastActivityAt?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/** Identity creation request. */
export interface IdentityCreateRequest {
  username: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  type?: IdentityType;
  phone?: string;
  organizationId?: string;
  departmentId?: string;
  managerId?: string;
  title?: string;
  locale?: string;
  timezone?: string;
  attributes?: Record<string, any>;
  roles?: string[];
  groups?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
  password?: string;
  sendWelcomeEmail?: boolean;
}

/** Identity update request. */
export interface IdentityUpdateRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organizationId?: string;
  departmentId?: string;
  managerId?: string;
  title?: string;
  locale?: string;
  timezone?: string;
  attributes?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

/** Identity search query. */
export interface IdentitySearchQuery {
  status?: IdentityStatus;
  type?: IdentityType;
  organizationId?: string;
  departmentId?: string;
  role?: string;
  group?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Organization within the identity system. */
export interface Organization {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  parentId?: string;
  status: 'active' | 'suspended' | 'inactive';
  domains: string[];
  attributes: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Group within the identity system. */
export interface IdentityGroup {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: 'static' | 'dynamic' | 'organizational';
  organizationId?: string;
  parentGroupId?: string;
  memberCount: number;
  dynamicRule?: GroupDynamicRule;
  attributes: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Dynamic group membership rule. */
export interface GroupDynamicRule {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'in';
  value: any;
  logic?: 'AND' | 'OR';
  children?: GroupDynamicRule[];
}

/** Identity provisioning action. */
export type ProvisioningAction =
  | 'create'
  | 'activate'
  | 'suspend'
  | 'unsuspend'
  | 'lock'
  | 'unlock'
  | 'deactivate'
  | 'delete'
  | 'reset-password'
  | 'assign-role'
  | 'revoke-role'
  | 'assign-group'
  | 'remove-group';

/** Provisioning workflow record. */
export interface ProvisioningRecord {
  id: string;
  identityId: string;
  action: ProvisioningAction;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  requestedBy: string;
  approvedBy?: string;
  reason?: string;
  details: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}

// ── Authentication Types ────────────────────────────────────

/** Authentication method type. */
export type AuthMethod =
  | 'password'
  | 'mfa-totp'
  | 'mfa-sms'
  | 'mfa-email'
  | 'mfa-push'
  | 'mfa-webauthn'
  | 'mfa-biometric'
  | 'passwordless-magic-link'
  | 'passwordless-webauthn'
  | 'passwordless-passkey'
  | 'social-google'
  | 'social-github'
  | 'social-microsoft'
  | 'social-apple'
  | 'certificate'
  | 'kerberos'
  | 'api-key'
  | 'bearer-token'
  | 'saml'
  | 'oidc'
  | 'oauth2';

/** Authentication factor type. */
export type AuthFactorType =
  | 'knowledge'
  | 'possession'
  | 'inherence'
  | 'location'
  | 'time';

/** Authentication status. */
export type AuthenticationStatus =
  | 'success'
  | 'failed'
  | 'mfa-required'
  | 'mfa-challenge'
  | 'locked'
  | 'expired'
  | 'risk-denied'
  | 'consent-required'
  | 'step-up-required';

/** Authentication request. */
export interface AuthenticationRequest {
  username?: string;
  email?: string;
  password?: string;
  method: AuthMethod;
  mfaCode?: string;
  mfaToken?: string;
  certificate?: string;
  assertionResponse?: any;
  clientId?: string;
  redirectUri?: string;
  scope?: string[];
  nonce?: string;
  state?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geoLocation?: GeoLocation;
}

/** Authentication result. */
export interface AuthenticationResult {
  status: AuthenticationStatus;
  identityId?: string;
  sessionId?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string[];
  mfaChallenge?: MFAChallenge;
  riskScore?: number;
  riskLevel?: RiskLevel;
  failureReason?: string;
  failureCount?: number;
  authenticatedAt?: string;
  methods: AuthMethod[];
}

/** MFA challenge details. */
export interface MFAChallenge {
  challengeId: string;
  method: AuthMethod;
  expiresAt: string;
  destination?: string;
  qrCodeUri?: string;
  assertionOptions?: any;
}

/** MFA enrollment configuration. */
export interface MFAEnrollment {
  id: string;
  identityId: string;
  method: AuthMethod;
  factorType: AuthFactorType;
  status: 'pending' | 'active' | 'disabled';
  verified: boolean;
  phoneNumber?: string;
  email?: string;
  deviceName?: string;
  registeredAt: string;
  lastUsedAt?: string;
}

/** Authentication policy. */
export interface AuthenticationPolicy {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditions: AuthPolicyCondition;
  requiredFactors: number;
  allowedMethods: AuthMethod[];
  mfaRequired: boolean;
  mfaExemptionRules?: MFAExemptionRule[];
  sessionDurationMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  riskThreshold?: number;
  stepUpAuthRequired?: boolean;
  metadata: Record<string, any>;
}

/** Authentication policy condition. */
export interface AuthPolicyCondition {
  roles?: string[];
  groups?: string[];
  identityTypes?: IdentityType[];
  ipRanges?: string[];
  geoLocations?: string[];
  deviceTypes?: string[];
  riskLevels?: RiskLevel[];
  timeWindows?: TimeWindow[];
  applications?: string[];
  logic?: 'AND' | 'OR';
}

/** MFA exemption rule. */
export interface MFAExemptionRule {
  condition: 'trusted-device' | 'trusted-network' | 'low-risk' | 'recent-mfa';
  parameters: Record<string, any>;
}

/** Geographic location. */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  city?: string;
}

/** Time window constraint. */
export interface TimeWindow {
  dayOfWeek: number[];
  startHour: number;
  endHour: number;
  timezone: string;
}

/** SSO configuration. */
export interface SSOConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  protocol: 'saml' | 'oidc' | 'ws-federation';
  identityProviderId?: string;
  serviceProviderEntityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificateFingerprint?: string;
  attributeMapping: Record<string, string>;
  defaultRelayState?: string;
  forceAuthn?: boolean;
  nameIdFormat?: string;
  metadata: Record<string, any>;
}

// ── Authorization Types ─────────────────────────────────────

/** Authorization model type. */
export type AuthorizationModel = 'rbac' | 'abac' | 'pbac' | 'relationship';

/** Permission effect. */
export type PermissionEffect = 'allow' | 'deny';

/** Role definition. */
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: 'system' | 'organization' | 'application' | 'custom';
  scope?: string;
  permissions: Permission[];
  inheritsFrom: string[];
  constraints?: RoleConstraint[];
  maxAssignees?: number;
  requiresApproval: boolean;
  expirationPolicy?: 'none' | 'fixed' | 'review-required';
  reviewIntervalDays?: number;
  organizationId?: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Permission definition. */
export interface Permission {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  resource: string;
  actions: string[];
  effect: PermissionEffect;
  conditions?: PermissionCondition[];
}

/** Permission condition for ABAC. */
export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'in' | 'greaterThan' | 'lessThan' | 'between' | 'matches' | 'exists';
  value: any;
  source: 'subject' | 'resource' | 'environment' | 'context';
}

/** Role constraint (mutual exclusion, cardinality). */
export interface RoleConstraint {
  type: 'mutual-exclusion' | 'prerequisite' | 'cardinality' | 'temporal';
  targetRoleId?: string;
  maxCount?: number;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

/** Role assignment. */
export interface RoleAssignment {
  id: string;
  identityId: string;
  roleId: string;
  scope?: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  justification?: string;
  status: 'active' | 'expired' | 'revoked' | 'pending-review';
}

/** Authorization request. */
export interface AuthorizationRequest {
  subjectId: string;
  subjectType?: 'user' | 'service' | 'group';
  resource: string;
  resourceType?: string;
  action: string;
  environment?: Record<string, any>;
  context?: Record<string, any>;
}

/** Authorization decision. */
export interface AuthorizationDecision {
  allowed: boolean;
  effect: PermissionEffect;
  matchedPolicies: string[];
  matchedRoles: string[];
  matchedPermissions: string[];
  obligations?: AuthorizationObligation[];
  advice?: string[];
  evaluatedAt: string;
  evaluationTimeMs: number;
  cached: boolean;
}

/** Authorization obligation (post-decision action). */
export interface AuthorizationObligation {
  type: 'log' | 'notify' | 'encrypt' | 'mask' | 'audit' | 'custom';
  parameters: Record<string, any>;
}

/** Policy-based access control policy. */
export interface AccessPolicy {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  effect: PermissionEffect;
  subjects: PolicySubject[];
  resources: PolicyResource[];
  actions: string[];
  conditions?: PermissionCondition[];
  obligations?: AuthorizationObligation[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Policy subject specification. */
export interface PolicySubject {
  type: 'user' | 'group' | 'role' | 'service' | 'any';
  identifier: string;
}

/** Policy resource specification. */
export interface PolicyResource {
  type: string;
  identifier: string;
  attributes?: Record<string, any>;
}

// ── Directory Types ─────────────────────────────────────────

/** Directory entry type. */
export type DirectoryEntryType =
  | 'user'
  | 'group'
  | 'organizational-unit'
  | 'organization'
  | 'domain'
  | 'application'
  | 'device'
  | 'service-principal';

/** Directory entry. */
export interface DirectoryEntry {
  dn: string;
  objectClass: string[];
  entryType: DirectoryEntryType;
  cn: string;
  attributes: Record<string, any>;
  parentDn?: string;
  children: string[];
  createdAt: string;
  modifiedAt: string;
  modifiedBy: string;
}

/** Directory search filter. */
export interface DirectorySearchFilter {
  attribute?: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'present' | 'approximate' | 'greaterOrEqual' | 'lessOrEqual';
  value?: any;
  logic?: 'AND' | 'OR' | 'NOT';
  children?: DirectorySearchFilter[];
}

/** Directory search options. */
export interface DirectorySearchOptions {
  baseDn: string;
  scope: 'base' | 'one-level' | 'subtree';
  filter: DirectorySearchFilter;
  attributes?: string[];
  sizeLimit?: number;
  timeLimit?: number;
  sortBy?: string;
}

/** Directory schema definition. */
export interface DirectorySchema {
  id: string;
  name: string;
  objectClasses: DirectoryObjectClass[];
  attributeTypes: DirectoryAttributeType[];
}

/** Directory object class definition. */
export interface DirectoryObjectClass {
  name: string;
  superClass?: string;
  type: 'structural' | 'auxiliary' | 'abstract';
  requiredAttributes: string[];
  optionalAttributes: string[];
  description?: string;
}

/** Directory attribute type definition. */
export interface DirectoryAttributeType {
  name: string;
  syntax: 'string' | 'integer' | 'boolean' | 'binary' | 'timestamp' | 'dn';
  singleValue: boolean;
  indexed: boolean;
  description?: string;
}

/** Virtual directory configuration. */
export interface VirtualDirectoryConfig {
  id: string;
  name: string;
  sources: VirtualDirectorySource[];
  mergeStrategy: 'first-wins' | 'last-wins' | 'merge-all';
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
}

/** Virtual directory source. */
export interface VirtualDirectorySource {
  id: string;
  name: string;
  type: 'internal' | 'ldap' | 'active-directory' | 'database' | 'api';
  baseDn: string;
  priority: number;
  connectionConfig: Record<string, any>;
  attributeMapping: Record<string, string>;
  readOnly: boolean;
}

// ── Federation Types ────────────────────────────────────────

/** Federation protocol. */
export type FederationProtocol = 'saml2' | 'oauth2' | 'oidc' | 'ws-federation' | 'scim';

/** Identity provider status. */
export type ProviderStatus = 'active' | 'inactive' | 'testing' | 'error';

/** SAML binding type. */
export type SAMLBinding = 'http-post' | 'http-redirect' | 'http-artifact' | 'soap';

/** SAML name ID format. */
export type SAMLNameIdFormat =
  | 'unspecified'
  | 'email'
  | 'persistent'
  | 'transient'
  | 'x509-subject'
  | 'windows-domain'
  | 'kerberos'
  | 'entity';

/** Identity provider configuration. */
export interface IdentityProviderConfig {
  id: string;
  name: string;
  displayName: string;
  protocol: FederationProtocol;
  status: ProviderStatus;
  issuer: string;
  // SAML-specific
  ssoUrl?: string;
  sloUrl?: string;
  ssoBinding?: SAMLBinding;
  sloBinding?: SAMLBinding;
  nameIdFormat?: SAMLNameIdFormat;
  signingCertificate?: string;
  encryptionCertificate?: string;
  wantAuthnRequestsSigned?: boolean;
  wantAssertionsSigned?: boolean;
  wantAssertionsEncrypted?: boolean;
  // OIDC/OAuth2-specific
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  responseType?: string;
  grantTypes?: string[];
  pkceRequired?: boolean;
  // Common
  attributeMapping: Record<string, string>;
  groupMapping?: Record<string, string>;
  roleMapping?: Record<string, string>;
  jitProvisioningEnabled: boolean;
  jitProvisioningDefaults?: Record<string, any>;
  trustedDomains?: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Service provider configuration. */
export interface ServiceProviderConfig {
  id: string;
  name: string;
  displayName: string;
  protocol: FederationProtocol;
  status: ProviderStatus;
  entityId: string;
  // SAML-specific
  assertionConsumerServiceUrl?: string;
  singleLogoutServiceUrl?: string;
  acsBinding?: SAMLBinding;
  sloBinding?: SAMLBinding;
  nameIdFormat?: SAMLNameIdFormat;
  wantAuthnRequestsSigned?: boolean;
  signingCertificate?: string;
  encryptionCertificate?: string;
  signAssertions?: boolean;
  encryptAssertions?: boolean;
  signResponses?: boolean;
  // OIDC/OAuth2-specific
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  allowedGrantTypes?: string[];
  allowedScopes?: string[];
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt' | 'none';
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  idTokenTtlSeconds?: number;
  pkceRequired?: boolean;
  // Common
  attributeRelease: string[];
  consentRequired: boolean;
  trustedScopes?: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Federation trust relationship. */
export interface FederationTrust {
  id: string;
  identityProviderId: string;
  serviceProviderId: string;
  status: 'active' | 'inactive' | 'pending';
  trustDirection: 'one-way' | 'mutual';
  trustLevel: 'full' | 'limited' | 'transitive';
  attributeFilters?: AttributeFilter[];
  createdAt: string;
  updatedAt: string;
}

/** Attribute filter for federation. */
export interface AttributeFilter {
  attribute: string;
  policy: 'release' | 'deny' | 'transform';
  transformExpression?: string;
}

/** SCIM resource. */
export interface SCIMResource {
  schemas: string[];
  id: string;
  externalId?: string;
  meta: SCIMMeta;
  [key: string]: any;
}

/** SCIM metadata. */
export interface SCIMMeta {
  resourceType: string;
  created: string;
  lastModified: string;
  location: string;
  version?: string;
}

/** SCIM provisioning configuration. */
export interface SCIMProvisioningConfig {
  id: string;
  name: string;
  enabled: boolean;
  endpointUrl: string;
  authType: 'bearer' | 'basic' | 'oauth2';
  credentials: Record<string, any>;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncScheduleCron?: string;
  resourceTypes: string[];
  attributeMapping: Record<string, string>;
  conflictResolution: 'source-wins' | 'target-wins' | 'manual';
  createdAt: string;
  updatedAt: string;
}

// ── Session Types ───────────────────────────────────────────

/** Session status. */
export type SessionStatus = 'active' | 'expired' | 'revoked' | 'idle-timeout';

/** Session type. */
export type SessionType = 'user' | 'api' | 'sso' | 'impersonation' | 'service';

/** Session information. */
export interface Session {
  id: string;
  identityId: string;
  type: SessionType;
  status: SessionStatus;
  authMethods: AuthMethod[];
  authLevel: number;
  ipAddress: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geoLocation?: GeoLocation;
  ssoSessionId?: string;
  impersonatorId?: string;
  scope?: string[];
  attributes: Record<string, any>;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  idleTimeoutAt: string;
}

/** Session configuration. */
export interface SessionConfig {
  maxSessionDurationMinutes: number;
  idleTimeoutMinutes: number;
  maxConcurrentSessions: number;
  bindToIp: boolean;
  bindToDevice: boolean;
  extendOnActivity: boolean;
  ssoEnabled: boolean;
  ssoMaxSessionDurationMinutes: number;
  sessionFixationProtection: boolean;
}

/** Session query. */
export interface SessionQuery {
  identityId?: string;
  status?: SessionStatus;
  type?: SessionType;
  ipAddress?: string;
  activeAfter?: string;
  activeBefore?: string;
  limit?: number;
  offset?: number;
}

// ── Token Types ─────────────────────────────────────────────

/** Token type. */
export type TokenType =
  | 'access'
  | 'refresh'
  | 'id'
  | 'authorization-code'
  | 'device-code'
  | 'saml-assertion'
  | 'api-key'
  | 'personal-access-token'
  | 'service-token';

/** Token status. */
export type TokenStatus = 'active' | 'expired' | 'revoked' | 'consumed';

/** Token record. */
export interface TokenRecord {
  id: string;
  type: TokenType;
  status: TokenStatus;
  identityId?: string;
  clientId?: string;
  scope?: string[];
  audience?: string[];
  issuer: string;
  claims: Record<string, any>;
  issuedAt: string;
  expiresAt: string;
  notBefore?: string;
  revokedAt?: string;
  parentTokenId?: string;
  fingerprint: string;
}

/** Token issuance request. */
export interface TokenIssuanceRequest {
  type: TokenType;
  identityId?: string;
  clientId?: string;
  scope?: string[];
  audience?: string[];
  claims?: Record<string, any>;
  ttlSeconds?: number;
  bindToSession?: string;
}

/** Token validation result. */
export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  revoked: boolean;
  claims?: Record<string, any>;
  identityId?: string;
  scope?: string[];
  error?: string;
}

/** Token exchange request (RFC 8693). */
export interface TokenExchangeRequest {
  grantType: 'urn:ietf:params:oauth:grant-type:token-exchange';
  subjectToken: string;
  subjectTokenType: string;
  actorToken?: string;
  actorTokenType?: string;
  resource?: string;
  audience?: string[];
  scope?: string[];
  requestedTokenType?: string;
}

/** Token exchange result. */
export interface TokenExchangeResult {
  accessToken: string;
  issuedTokenType: string;
  tokenType: string;
  expiresIn: number;
  scope?: string[];
  refreshToken?: string;
}

/** JWT signing configuration. */
export interface JWTSigningConfig {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512' | 'PS256' | 'PS384' | 'PS512';
  keyId: string;
  issuer: string;
  audience?: string[];
  defaultTtlSeconds: number;
}

// ── Governance Types ────────────────────────────────────────

/** Access certification campaign. */
export interface CertificationCampaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'in-review' | 'completed' | 'expired';
  type: 'user-access' | 'role-membership' | 'entitlement' | 'application-access';
  scope: CertificationScope;
  reviewers: CertificationReviewer[];
  schedule: CertificationSchedule;
  remediationPolicy: RemediationPolicy;
  totalItems: number;
  certifiedItems: number;
  revokedItems: number;
  pendingItems: number;
  completionPercentage: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  dueDate: string;
}

/** Certification scope. */
export interface CertificationScope {
  identityIds?: string[];
  roleIds?: string[];
  applicationIds?: string[];
  organizationIds?: string[];
  includeInactive: boolean;
}

/** Certification reviewer. */
export interface CertificationReviewer {
  identityId: string;
  type: 'manager' | 'role-owner' | 'application-owner' | 'designated';
  scope?: string;
}

/** Certification schedule. */
export interface CertificationSchedule {
  frequency: 'one-time' | 'weekly' | 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  startDate: string;
  durationDays: number;
  reminderDays: number[];
  escalationDays: number;
  autoRevokeOnExpiry: boolean;
}

/** Remediation policy. */
export interface RemediationPolicy {
  autoRevoke: boolean;
  requireJustification: boolean;
  escalationChain: string[];
  notifyOnRevocation: boolean;
  gracePeriodDays: number;
}

/** Certification decision record. */
export interface CertificationDecision {
  id: string;
  campaignId: string;
  identityId: string;
  accessItemType: 'role' | 'permission' | 'group' | 'entitlement';
  accessItemId: string;
  reviewerId: string;
  decision: 'certify' | 'revoke' | 'delegate' | 'abstain';
  justification?: string;
  delegateTo?: string;
  decidedAt: string;
  riskScore?: number;
}

/** Separation of Duties policy. */
export interface SoDPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  type: 'static' | 'dynamic' | 'transactional';
  severity: 'low' | 'medium' | 'high' | 'critical';
  conflictingRoles: SoDRoleConflict[];
  conflictingPermissions?: SoDPermissionConflict[];
  exemptions?: SoDExemption[];
  violationAction: 'block' | 'warn' | 'audit' | 'require-approval';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** SoD role conflict. */
export interface SoDRoleConflict {
  roleIdA: string;
  roleIdB: string;
  description?: string;
}

/** SoD permission conflict. */
export interface SoDPermissionConflict {
  permissionA: string;
  permissionB: string;
  description?: string;
}

/** SoD exemption. */
export interface SoDExemption {
  id: string;
  identityId: string;
  policyId: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
}

/** SoD violation record. */
export interface SoDViolation {
  id: string;
  policyId: string;
  identityId: string;
  conflictType: 'role' | 'permission';
  conflictDetails: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'acknowledged' | 'exempted' | 'remediated';
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

/** Access request. */
export interface AccessRequest {
  id: string;
  requesterId: string;
  beneficiaryId: string;
  type: 'role-assignment' | 'group-membership' | 'permission-grant' | 'application-access';
  itemId: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'fulfilled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  approvals: AccessApproval[];
  riskScore?: number;
  sodViolations?: SoDViolation[];
  requestedAt: string;
  fulfilledAt?: string;
  expiresAt?: string;
}

/** Access approval record. */
export interface AccessApproval {
  approverId: string;
  level: number;
  decision: 'approved' | 'rejected' | 'pending';
  justification?: string;
  decidedAt?: string;
}

// ── Privileged Access Management (PAM) Types ─────────────────

/** Privileged account type. */
export type PrivilegedAccountType =
  | 'root'
  | 'administrator'
  | 'database-admin'
  | 'network-admin'
  | 'application-admin'
  | 'service-account'
  | 'shared-account'
  | 'emergency-account'
  | 'break-glass';

/** Privileged account. */
export interface PrivilegedAccount {
  id: string;
  name: string;
  type: PrivilegedAccountType;
  targetSystem: string;
  targetHost?: string;
  username: string;
  status: 'active' | 'checked-out' | 'locked' | 'disabled' | 'rotating';
  vaultId: string;
  rotationPolicy?: CredentialRotationPolicy;
  lastRotatedAt?: string;
  lastCheckedOutAt?: string;
  lastCheckedOutBy?: string;
  checkoutDurationMinutes: number;
  requiresApproval: boolean;
  approvalPolicy?: string;
  sessionRecordingEnabled: boolean;
  commandRestrictions?: CommandRestriction[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/** Credential vault. */
export interface CredentialVault {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'sealed' | 'maintenance';
  encryptionAlgorithm: string;
  totalCredentials: number;
  accessPolicies: string[];
  auditEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Credential rotation policy. */
export interface CredentialRotationPolicy {
  id: string;
  name: string;
  intervalDays: number;
  rotateOnCheckIn: boolean;
  complexityRequirements: PasswordComplexity;
  verifyAfterRotation: boolean;
  notifyOnRotation: boolean;
  notificationRecipients: string[];
}

/** Command restriction for privileged sessions. */
export interface CommandRestriction {
  pattern: string;
  effect: 'allow' | 'deny' | 'audit';
  description?: string;
}

/** Privileged session checkout. */
export interface PAMCheckout {
  id: string;
  accountId: string;
  identityId: string;
  status: 'active' | 'expired' | 'checked-in' | 'terminated';
  reason: string;
  approvedBy?: string;
  checkedOutAt: string;
  expiresAt: string;
  checkedInAt?: string;
  sessionRecordingId?: string;
  commandsExecuted: PAMCommand[];
}

/** Recorded privileged command. */
export interface PAMCommand {
  command: string;
  timestamp: string;
  result: 'allowed' | 'denied' | 'audited';
  output?: string;
}

/** Privileged session recording. */
export interface PAMSessionRecording {
  id: string;
  checkoutId: string;
  accountId: string;
  identityId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  totalCommands: number;
  deniedCommands: number;
  keystrokes: PAMKeystroke[];
  events: PAMSessionEvent[];
}

/** Keystroke record for session recording. */
export interface PAMKeystroke {
  timestamp: string;
  input: string;
  output?: string;
}

/** PAM session event. */
export interface PAMSessionEvent {
  type: 'connect' | 'disconnect' | 'command' | 'file-transfer' | 'alert';
  timestamp: string;
  details: Record<string, any>;
}

// ── Risk Engine Types ───────────────────────────────────────

/** Risk level. */
export type RiskLevel = 'minimal' | 'low' | 'medium' | 'high' | 'critical';

/** Risk factor category. */
export type RiskFactorCategory =
  | 'authentication'
  | 'behavior'
  | 'device'
  | 'location'
  | 'network'
  | 'time'
  | 'velocity'
  | 'context'
  | 'reputation';

/** Risk assessment. */
export interface RiskAssessment {
  id: string;
  identityId: string;
  sessionId?: string;
  overallScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  recommendation: 'allow' | 'step-up' | 'challenge' | 'deny' | 'monitor';
  triggers: string[];
  assessedAt: string;
  expiresAt: string;
}

/** Individual risk factor. */
export interface RiskFactor {
  category: RiskFactorCategory;
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  details: Record<string, any>;
  anomalous: boolean;
}

/** Risk scoring rule. */
export interface RiskScoringRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category: RiskFactorCategory;
  priority: number;
  condition: RiskCondition;
  scoreAdjustment: number;
  severity: RiskLevel;
  action?: 'add-score' | 'multiply-score' | 'set-level' | 'trigger-alert';
  metadata: Record<string, any>;
}

/** Risk condition. */
export interface RiskCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'in' | 'notIn' | 'contains' | 'matches' | 'between' | 'isNew' | 'changed';
  value: any;
  logic?: 'AND' | 'OR';
  children?: RiskCondition[];
}

/** Behavioral profile for anomaly detection. */
export interface BehavioralProfile {
  identityId: string;
  typicalLoginHours: number[];
  typicalLocations: GeoLocation[];
  typicalDevices: string[];
  typicalIpRanges: string[];
  averageSessionDurationMinutes: number;
  averageActionsPerSession: number;
  knownDeviceFingerprints: string[];
  loginFrequencyPerWeek: number;
  sensitiveResourceAccessPattern: Record<string, number>;
  lastUpdatedAt: string;
  dataPointCount: number;
}

/** Anomaly detection result. */
export interface AnomalyDetectionResult {
  identityId: string;
  anomalyType: 'impossible-travel' | 'unusual-time' | 'new-device' | 'unusual-location' | 'velocity-anomaly' | 'behavior-change' | 'privilege-escalation';
  severity: RiskLevel;
  confidence: number;
  description: string;
  details: Record<string, any>;
  detectedAt: string;
}

/** Threat intelligence indicator. */
export interface ThreatIntelIndicator {
  id: string;
  type: 'ip' | 'domain' | 'email' | 'hash' | 'url' | 'user-agent';
  value: string;
  threatType: 'malware' | 'phishing' | 'credential-stuffing' | 'brute-force' | 'bot' | 'tor-exit';
  severity: RiskLevel;
  source: string;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string;
  tags: string[];
}

// ── Credential Types ────────────────────────────────────────

/** Credential type. */
export type CredentialType =
  | 'password'
  | 'totp-secret'
  | 'webauthn-credential'
  | 'recovery-codes'
  | 'api-key'
  | 'ssh-key'
  | 'x509-certificate'
  | 'passkey';

/** Password complexity requirements. */
export interface PasswordComplexity {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigits: boolean;
  requireSpecialChars: boolean;
  disallowedCharacters?: string;
  disallowCommonPasswords: boolean;
  disallowUserInfo: boolean;
  maxConsecutiveRepeats: number;
  historyCount: number;
}

/** Password policy. */
export interface PasswordPolicy {
  id: string;
  name: string;
  complexity: PasswordComplexity;
  maxAgeDays: number;
  minAgeDays: number;
  warningDays: number;
  gracePeriodDays: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireMfaAfterReset: boolean;
  allowSelfServiceReset: boolean;
}

/** Credential record. */
export interface CredentialRecord {
  id: string;
  identityId: string;
  type: CredentialType;
  status: 'active' | 'expired' | 'revoked' | 'compromised';
  name?: string;
  fingerprint?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  rotatedAt?: string;
  metadata: Record<string, any>;
}

/** Credential validation result. */
export interface CredentialValidationResult {
  valid: boolean;
  expired: boolean;
  compromised: boolean;
  policyViolations: string[];
  strengthScore: number;
  strengthLevel: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
}

// ── Monitoring Types ────────────────────────────────────────

/** IAM metric type. */
export type IAMMetricType = 'counter' | 'gauge' | 'histogram';

/** IAM alert severity. */
export type IAMAlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/** IAM alert status. */
export type IAMAlertStatus = 'active' | 'acknowledged' | 'resolved';

/** IAM alert rule definition. */
export interface IAMAlertRuleDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: IAMAlertSeverity;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'change' | 'absence';
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  notificationChannels: string[];
  metadata: Record<string, any>;
}

/** IAM alert instance. */
export interface IAMAlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: IAMAlertSeverity;
  status: IAMAlertStatus;
  message: string;
  value: number;
  threshold: number;
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata: Record<string, any>;
}

/** IAM metric data point. */
export interface IAMMetricDataPoint {
  name: string;
  type: IAMMetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

// ── Security Types ──────────────────────────────────────────

/** IAM security action. */
export type IAMSecurityAction =
  | 'identity.create' | 'identity.update' | 'identity.delete' | 'identity.activate'
  | 'identity.suspend' | 'identity.lock' | 'identity.unlock'
  | 'auth.login' | 'auth.logout' | 'auth.failed' | 'auth.mfa-challenge'
  | 'auth.mfa-success' | 'auth.mfa-failed' | 'auth.password-reset'
  | 'authz.grant' | 'authz.deny' | 'authz.policy-change'
  | 'role.assign' | 'role.revoke' | 'role.create' | 'role.delete'
  | 'session.create' | 'session.destroy' | 'session.revoke'
  | 'token.issue' | 'token.revoke' | 'token.refresh'
  | 'pam.checkout' | 'pam.checkin' | 'pam.command'
  | 'governance.certify' | 'governance.revoke' | 'governance.sod-violation'
  | 'federation.sso' | 'federation.provision' | 'federation.deprovision'
  | 'risk.alert' | 'risk.anomaly'
  | 'credential.create' | 'credential.rotate' | 'credential.compromise'
  | 'admin.config-change' | 'admin.policy-change';

/** IAM access control policy. */
export interface IAMAccessPolicy {
  id: string;
  name: string;
  effect: PermissionEffect;
  resources: string[];
  actions: IAMSecurityAction[];
  subjects: string[];
  conditions?: Record<string, any>;
}

/** IAM data masking strategy. */
export type IAMMaskingStrategy = 'full' | 'partial' | 'hash' | 'tokenize' | 'redact' | 'encrypt';

/** IAM data masking rule. */
export interface IAMMaskingRule {
  id: string;
  name: string;
  fieldPattern: string;
  strategy: IAMMaskingStrategy;
  parameters?: Record<string, any>;
}

/** IAM audit entry. */
export interface IAMAuditEntry {
  id: string;
  timestamp: string;
  action: IAMSecurityAction | string;
  actor: string;
  actorType?: 'user' | 'service' | 'system' | 'api';
  resource?: string;
  resourceType?: string;
  target?: string;
  targetType?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  riskScore?: number;
  geoLocation?: GeoLocation;
}

// ── Metrics ─────────────────────────────────────────────────

/** IAM module metrics snapshot. */
export interface IAMMetrics {
  // Identity
  totalIdentities: number;
  activeIdentities: number;
  suspendedIdentities: number;
  lockedIdentities: number;
  totalOrganizations: number;
  totalGroups: number;

  // Authentication
  authenticationsTotal: number;
  authenticationsSuccessful: number;
  authenticationsFailed: number;
  mfaChallengesIssued: number;
  mfaChallengesCompleted: number;
  activeSessions: number;

  // Authorization
  totalRoles: number;
  totalPermissions: number;
  totalPolicies: number;
  authorizationDecisions: number;
  authorizationDenials: number;

  // Directory
  totalDirectoryEntries: number;

  // Federation
  totalIdentityProviders: number;
  totalServiceProviders: number;
  federatedAuthenticationsTotal: number;

  // Tokens
  tokensIssued: number;
  tokensRevoked: number;
  activeTokens: number;

  // Governance
  activeCertificationCampaigns: number;
  totalSoDPolicies: number;
  activeSoDViolations: number;
  pendingAccessRequests: number;

  // PAM
  totalPrivilegedAccounts: number;
  activeCheckouts: number;
  totalSessionRecordings: number;

  // Risk
  averageRiskScore: number;
  highRiskSessions: number;
  anomaliesDetected: number;
  activeThreatIndicators: number;

  // General
  activeAlerts: number;
  uptimeMs: number;
  timestamp: string;
}

// ── Event Types ─────────────────────────────────────────────

/** IAM event types. */
export type IAMEventType =
  // Identity events
  | 'identity:created' | 'identity:updated' | 'identity:activated'
  | 'identity:suspended' | 'identity:locked' | 'identity:unlocked'
  | 'identity:deprovisioned' | 'identity:deleted'
  // Authentication events
  | 'auth:login-success' | 'auth:login-failed' | 'auth:logout'
  | 'auth:mfa-challenge' | 'auth:mfa-success' | 'auth:mfa-failed'
  | 'auth:password-changed' | 'auth:password-reset'
  | 'auth:account-locked' | 'auth:account-unlocked'
  // Authorization events
  | 'authz:access-granted' | 'authz:access-denied'
  | 'authz:role-assigned' | 'authz:role-revoked'
  | 'authz:policy-created' | 'authz:policy-updated' | 'authz:policy-deleted'
  // Session events
  | 'session:created' | 'session:expired' | 'session:revoked'
  // Token events
  | 'token:issued' | 'token:revoked' | 'token:refreshed'
  // Federation events
  | 'federation:sso-login' | 'federation:sso-logout'
  | 'federation:provisioned' | 'federation:deprovisioned'
  // Governance events
  | 'governance:certification-started' | 'governance:certification-completed'
  | 'governance:access-certified' | 'governance:access-revoked'
  | 'governance:sod-violation-detected' | 'governance:sod-violation-resolved'
  | 'governance:access-request-created' | 'governance:access-request-approved'
  | 'governance:access-request-rejected'
  // PAM events
  | 'pam:checkout' | 'pam:checkin' | 'pam:session-started'
  | 'pam:session-ended' | 'pam:command-denied'
  | 'pam:credential-rotated'
  // Risk events
  | 'risk:assessment-completed' | 'risk:anomaly-detected'
  | 'risk:threat-indicator-matched' | 'risk:level-changed'
  // Credential events
  | 'credential:created' | 'credential:rotated'
  | 'credential:compromised' | 'credential:expired'
  // Lifecycle events
  | 'iam:started' | 'iam:stopped'
  | 'alert:fired' | 'alert:resolved';

/** IAM event. */
export interface IAMEvent {
  type: IAMEventType;
  timestamp: string;
  source: string;
  data?: Record<string, any>;
  identityId?: string;
  sessionId?: string;
  riskScore?: number;
}

/** IAM event listener. */
export type IAMEventListener = (event: IAMEvent) => void;

// ── Configuration ───────────────────────────────────────────

/** IAM module configuration. */
export interface IAMConfig {
  name: string;
  auditEnabled?: boolean;

  // Pre-configured items
  organizations?: Organization[];
  groups?: IdentityGroup[];
  identities?: IdentityCreateRequest[];
  roles?: Role[];
  policies?: AccessPolicy[];
  authenticationPolicies?: AuthenticationPolicy[];
  passwordPolicies?: PasswordPolicy[];
  identityProviders?: IdentityProviderConfig[];
  serviceProviders?: ServiceProviderConfig[];
  ssoConfigurations?: SSOConfiguration[];
  riskScoringRules?: RiskScoringRule[];
  sodPolicies?: SoDPolicy[];
  privilegedAccounts?: PrivilegedAccount[];
  credentialVaults?: CredentialVault[];
  threatIndicators?: ThreatIntelIndicator[];
  alertRules?: IAMAlertRuleDefinition[];
  sessionConfig?: Partial<SessionConfig>;
  tokenSigningConfig?: Partial<JWTSigningConfig>;
  accessPolicies?: IAMAccessPolicy[];
  maskingRules?: IAMMaskingRule[];

  metadata?: Record<string, any>;
}
