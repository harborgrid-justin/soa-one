// ============================================================
// SOA One IAM — Engine Plugin
// ============================================================
//
// Provides a plugin that integrates the IAM module with the
// @soa-one/engine rule engine. This ensures 100% compatibility
// with the existing SDK.
//
// The plugin:
// - Registers IAM-specific operators for identity/auth rules
// - Registers IAM action handlers for identity operations
// - Provides execution hooks for IAM-aware rule processing
// - Exposes IAM functions callable from rules
//
// This follows the exact same pattern as the ESB, CMS, DI,
// DQM, and SOA plugins, making all modules aware of each other
// when activated.
// ============================================================

import type { IdentityAccessManager } from './iam';
import { generateId } from './identity';

// ── SDK-Compatible Types ────────────────────────────────────

// These types mirror the @soa-one/engine plugin interfaces
// to maintain 100% compatibility without a direct dependency.

/** Operator handler compatible with @soa-one/engine. */
type OperatorHandler = (fieldValue: any, compareValue: any) => boolean;

/** Action handler compatible with @soa-one/engine. */
type ActionHandler = (
  output: Record<string, any>,
  action: { type: string; field: string; value: any },
  input: Record<string, any>,
) => void;

/** Execution hook compatible with @soa-one/engine. */
type ExecutionHook = (context: {
  ruleSet: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  metadata: Record<string, any>;
}) => any;

/** Rule hook compatible with @soa-one/engine. */
type RuleHook = (context: {
  rule: any;
  input: Record<string, any>;
  output: Record<string, any>;
  result?: any;
  skip?: boolean;
  metadata: Record<string, any>;
}) => any;

/** Custom function compatible with @soa-one/engine. */
type CustomFunction = (...args: any[]) => any;

/**
 * EnginePlugin interface compatible with @soa-one/engine.
 * Defined here to avoid a circular dependency.
 */
export interface EnginePlugin {
  name: string;
  version?: string;
  operators?: Record<string, OperatorHandler>;
  actionHandlers?: Record<string, ActionHandler>;
  hooks?: {
    beforeExecute?: ExecutionHook[];
    afterExecute?: ExecutionHook[];
    beforeRule?: RuleHook[];
    afterRule?: RuleHook[];
  };
  functions?: Record<string, CustomFunction>;
  onRegister?: () => void;
  onDestroy?: () => void;
}

// ── IAM Engine Plugin Factory ───────────────────────────────

/**
 * Create an @soa-one/engine plugin that integrates the IAM module.
 *
 * Usage with @soa-one/engine:
 * ```ts
 * import { RuleEngine } from '@soa-one/engine';
 * import { IdentityAccessManager, createIAMPlugin } from '@soa-one/iam';
 *
 * const iam = new IdentityAccessManager({ name: 'my-iam' });
 * await iam.init();
 *
 * const engine = new RuleEngine({
 *   plugins: [createIAMPlugin(iam)],
 * });
 *
 * // Rules can now use IAM operators and actions
 * const result = await engine.execute(ruleSet, input);
 * ```
 *
 * Combine with ESB, CMS, DI, DQM, and SOA plugins for full cross-module awareness:
 * ```ts
 * const engine = new RuleEngine({
 *   plugins: [
 *     createESBPlugin(bus),
 *     createCMSPlugin(cms),
 *     createDIPlugin(di),
 *     createDQMPlugin(dqm),
 *     createSOAPlugin(soa),
 *     createIAMPlugin(iam),
 *   ],
 * });
 * ```
 */
export function createIAMPlugin(iam: IdentityAccessManager): EnginePlugin {
  return {
    name: 'soa-one-iam',
    version: '1.0.0',

    // ── Custom Operators ──────────────────────────────────
    operators: {
      /**
       * Check if an identity exists.
       * Usage: field="identityId", operator="identityExists", value=true
       */
      identityExists: (fieldValue: any, _compareValue: any): boolean => {
        return iam.identities.getIdentity(String(fieldValue)) !== undefined;
      },

      /**
       * Check if an identity is active.
       * Usage: field="identityId", operator="identityIsActive", value=true
       */
      identityIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const identity = iam.identities.getIdentity(String(fieldValue));
        return identity?.status === 'active';
      },

      /**
       * Check if an identity has a specific role.
       * Usage: field="identityId", operator="hasRole", value="admin"
       */
      hasRole: (fieldValue: any, compareValue: any): boolean => {
        return iam.authorization.isRoleAssigned(String(fieldValue), String(compareValue));
      },

      /**
       * Check if an identity is authorized for an action.
       * Usage: field="identityId:resource:action", operator="isAuthorized", value=true
       */
      isAuthorized: (fieldValue: any, _compareValue: any): boolean => {
        const parts = String(fieldValue).split(':');
        if (parts.length < 3) return false;
        const decision = iam.authorization.authorize({
          subjectId: parts[0],
          resource: parts[1],
          action: parts[2],
        });
        return decision.allowed;
      },

      /**
       * Check if an identity is locked.
       * Usage: field="identityId", operator="identityIsLocked", value=true
       */
      identityIsLocked: (fieldValue: any, _compareValue: any): boolean => {
        const identity = iam.identities.getIdentity(String(fieldValue));
        return identity?.status === 'locked';
      },

      /**
       * Check if a session is valid.
       * Usage: field="sessionId", operator="sessionIsValid", value=true
       */
      sessionIsValid: (fieldValue: any, _compareValue: any): boolean => {
        const result = iam.sessions.validateSession(String(fieldValue));
        return result.valid;
      },

      /**
       * Check if risk level exceeds a threshold.
       * Usage: field="identityId", operator="riskLevelExceeds", value="medium"
       */
      riskLevelExceeds: (fieldValue: any, compareValue: any): boolean => {
        const assessment = iam.risk.getLatestAssessment(String(fieldValue));
        if (!assessment) return false;
        const levels = ['minimal', 'low', 'medium', 'high', 'critical'];
        const assessedLevel = levels.indexOf(assessment.riskLevel);
        const thresholdLevel = levels.indexOf(String(compareValue));
        return assessedLevel > thresholdLevel;
      },

      /**
       * Check if a token is valid.
       * Usage: field="tokenId", operator="tokenIsValid", value=true
       */
      tokenIsValid: (fieldValue: any, _compareValue: any): boolean => {
        const result = iam.tokens.validateToken(String(fieldValue));
        return result.valid;
      },

      /**
       * Check if an identity has MFA enrolled.
       * Usage: field="identityId", operator="hasMFAEnrolled", value=true
       */
      hasMFAEnrolled: (fieldValue: any, _compareValue: any): boolean => {
        const enrollments = iam.authentication.getMFAEnrollments(String(fieldValue));
        return enrollments.some((e) => e.status === 'active');
      },

      /**
       * Check if there are active SoD violations for an identity.
       * Usage: field="identityId", operator="hasSoDViolations", value=true
       */
      hasSoDViolations: (fieldValue: any, _compareValue: any): boolean => {
        const violations = iam.governance.getViolationsByIdentity(String(fieldValue));
        return violations.some((v) => v.status === 'detected' || v.status === 'acknowledged');
      },

      /**
       * Check if a privileged account is checked out.
       * Usage: field="accountId", operator="pamIsCheckedOut", value=true
       */
      pamIsCheckedOut: (fieldValue: any, _compareValue: any): boolean => {
        return iam.pam.isCheckedOut(String(fieldValue));
      },

      /**
       * Check if an identity has pending access requests.
       * Usage: field="identityId", operator="hasPendingAccessRequests", value=true
       */
      hasPendingAccessRequests: (fieldValue: any, _compareValue: any): boolean => {
        const requests = iam.governance.getAccessRequestsByIdentity(String(fieldValue));
        return requests.some((r) => r.status === 'pending');
      },

      /**
       * Check if a federation identity provider exists and is active.
       * Usage: field="idpId", operator="idpIsActive", value=true
       */
      idpIsActive: (fieldValue: any, _compareValue: any): boolean => {
        const idp = iam.federation.getIdentityProvider(String(fieldValue));
        return idp?.status === 'active';
      },
    },

    // ── Custom Action Handlers ────────────────────────────
    actionHandlers: {
      /**
       * Create an identity from a rule.
       * Usage: type="IAM_CREATE_IDENTITY", field="username", value={ email, displayName, ... }
       */
      IAM_CREATE_IDENTITY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const identity = iam.identities.createIdentity({
            username: action.field,
            email: config.email ?? `${action.field}@example.com`,
            displayName: config.displayName ?? action.field,
            ...config,
          });

          if (!output._iamIdentities) output._iamIdentities = [];
          output._iamIdentities.push({
            id: identity.id,
            username: identity.username,
            status: identity.status,
            createdAt: identity.createdAt,
          });
        } catch {
          // Swallow errors in action handlers
        }
      },

      /**
       * Assign a role to an identity from a rule.
       * Usage: type="IAM_ASSIGN_ROLE", field="identityId", value={ roleId, grantedBy }
       */
      IAM_ASSIGN_ROLE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const assignment = iam.authorization.assignRole(
            action.field,
            config.roleId,
            config.grantedBy ?? 'rule-engine',
          );

          if (!output._iamRoleAssignments) output._iamRoleAssignments = [];
          output._iamRoleAssignments.push({
            assignmentId: assignment.id,
            identityId: action.field,
            roleId: config.roleId,
            grantedAt: assignment.grantedAt,
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Authorize an action and record the decision.
       * Usage: type="IAM_AUTHORIZE", field="subjectId", value={ resource, action }
       */
      IAM_AUTHORIZE: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const decision = iam.authorization.authorize({
            subjectId: action.field,
            resource: config.resource ?? input.resource,
            action: config.action ?? 'access',
            environment: config.environment,
            context: config.context,
          });

          if (!output._iamAuthzDecisions) output._iamAuthzDecisions = [];
          output._iamAuthzDecisions.push({
            subjectId: action.field,
            resource: config.resource,
            action: config.action,
            allowed: decision.allowed,
            matchedRoles: decision.matchedRoles,
            evaluatedAt: decision.evaluatedAt,
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Assess risk for an identity from a rule.
       * Usage: type="IAM_ASSESS_RISK", field="identityId", value={ ipAddress, userAgent }
       */
      IAM_ASSESS_RISK: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const assessment = iam.risk.assessRisk(action.field, config);

          if (!output._iamRiskAssessments) output._iamRiskAssessments = [];
          output._iamRiskAssessments.push({
            assessmentId: assessment.id,
            identityId: action.field,
            overallScore: assessment.overallScore,
            riskLevel: assessment.riskLevel,
            recommendation: assessment.recommendation,
            assessedAt: assessment.assessedAt,
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Suspend an identity from a rule.
       * Usage: type="IAM_SUSPEND_IDENTITY", field="identityId", value={ reason }
       */
      IAM_SUSPEND_IDENTITY: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          iam.identities.suspend(action.field, 'rule-engine');

          if (!output._iamActions) output._iamActions = [];
          output._iamActions.push({
            action: 'suspend',
            identityId: action.field,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Revoke all sessions for an identity from a rule.
       * Usage: type="IAM_REVOKE_SESSIONS", field="identityId", value={}
       */
      IAM_REVOKE_SESSIONS: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        try {
          const count = iam.sessions.revokeAllSessions(action.field);

          if (!output._iamActions) output._iamActions = [];
          output._iamActions.push({
            action: 'revoke-sessions',
            identityId: action.field,
            sessionsRevoked: count,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Swallow errors
        }
      },

      /**
       * Issue a token from a rule.
       * Usage: type="IAM_ISSUE_TOKEN", field="identityId", value={ type, scope, ttlSeconds }
       */
      IAM_ISSUE_TOKEN: (
        output: Record<string, any>,
        action: { type: string; field: string; value: any },
        _input: Record<string, any>,
      ): void => {
        const config = typeof action.value === 'object' ? action.value : {};
        try {
          const token = iam.tokens.issueToken({
            type: config.type ?? 'access',
            identityId: action.field,
            scope: config.scope,
            ttlSeconds: config.ttlSeconds,
          });

          if (!output._iamTokens) output._iamTokens = [];
          output._iamTokens.push({
            tokenId: token.id,
            type: token.type,
            identityId: action.field,
            expiresAt: token.expiresAt,
          });
        } catch {
          // Swallow errors
        }
      },
    },

    // ── Execution Hooks ───────────────────────────────────
    hooks: {
      beforeExecute: [
        (context) => {
          // Add IAM metadata to execution context
          const metrics = iam.getMetrics();
          context.metadata.iam = {
            name: iam.name,
            totalIdentities: metrics.totalIdentities,
            activeIdentities: metrics.activeIdentities,
            totalRoles: metrics.totalRoles,
            totalPolicies: metrics.totalPolicies,
            activeSessions: metrics.activeSessions,
            authenticationsTotal: metrics.authenticationsTotal,
            authorizationDecisions: metrics.authorizationDecisions,
            totalIdentityProviders: metrics.totalIdentityProviders,
            totalServiceProviders: metrics.totalServiceProviders,
            activeCertificationCampaigns: metrics.activeCertificationCampaigns,
            activeSoDViolations: metrics.activeSoDViolations,
            totalPrivilegedAccounts: metrics.totalPrivilegedAccounts,
            averageRiskScore: metrics.averageRiskScore,
            anomaliesDetected: metrics.anomaliesDetected,
            activeAlerts: metrics.activeAlerts,
          };
          return context;
        },
      ],

      afterExecute: [
        (context) => {
          // Record rule execution in IAM audit
          if (context.result) {
            iam.security.recordAudit({
              action: 'rule-engine.execute',
              actor: 'rule-engine',
              resource: context.ruleSet.name ?? context.ruleSet.id,
              resourceType: 'ruleSet',
              details: {
                rulesFired: context.result.rulesFired?.length ?? 0,
                executionTimeMs: context.result.executionTimeMs ?? 0,
              },
              success: true,
            });

            // Record metrics
            iam.monitoring.metrics.incrementCounter('rules.executed', 1, {
              ruleSet: context.ruleSet.name ?? context.ruleSet.id,
            });

            if (context.result.executionTimeMs) {
              iam.monitoring.metrics.recordHistogram(
                'rules.execution.latency',
                context.result.executionTimeMs,
                { ruleSet: context.ruleSet.name ?? context.ruleSet.id },
              );
            }
          }
          return context;
        },
      ],
    },

    // ── Custom Functions ──────────────────────────────────
    functions: {
      // ── Identity Functions ────────────────────────
      /** Get an identity by ID. */
      iam_getIdentity: (identityId: string): any => {
        return iam.identities.getIdentity(identityId);
      },

      /** Get total identity count. */
      iam_identityCount: (): number => {
        return iam.identities.count;
      },

      /** Get active identity count. */
      iam_activeIdentityCount: (): number => {
        return iam.identities.activeCount;
      },

      /** Check if an identity exists. */
      iam_identityExists: (identityId: string): boolean => {
        return iam.identities.getIdentity(identityId) !== undefined;
      },

      // ── Authentication Functions ──────────────────
      /** Get total authentication count. */
      iam_authenticationCount: (): number => {
        return iam.authentication.totalAuthentications;
      },

      /** Get failed authentication count. */
      iam_failedAuthCount: (): number => {
        return iam.authentication.failedAuthentications;
      },

      /** Check if an identity has MFA enrolled. */
      iam_hasMFA: (identityId: string): boolean => {
        return iam.authentication.getMFAEnrollments(identityId)
          .some((e) => e.status === 'active');
      },

      // ── Authorization Functions ───────────────────
      /** Get role count. */
      iam_roleCount: (): number => {
        return iam.authorization.roleCount;
      },

      /** Get policy count. */
      iam_policyCount: (): number => {
        return iam.authorization.policyCount;
      },

      /** Check if identity has a role. */
      iam_hasRole: (identityId: string, roleId: string): boolean => {
        return iam.authorization.isRoleAssigned(identityId, roleId);
      },

      /** Authorize an action. */
      iam_authorize: (subjectId: string, resource: string, action: string): boolean => {
        const decision = iam.authorization.authorize({
          subjectId,
          resource,
          action,
        });
        return decision.allowed;
      },

      /** Get authorization denial count. */
      iam_denyCount: (): number => {
        return iam.authorization.denyCount;
      },

      // ── Session Functions ─────────────────────────
      /** Get active session count. */
      iam_activeSessionCount: (): number => {
        return iam.sessions.activeSessionCount;
      },

      /** Validate a session. */
      iam_validateSession: (sessionId: string): boolean => {
        return iam.sessions.validateSession(sessionId).valid;
      },

      // ── Token Functions ───────────────────────────
      /** Get active token count. */
      iam_activeTokenCount: (): number => {
        return iam.tokens.activeTokenCount;
      },

      /** Validate a token. */
      iam_validateToken: (tokenId: string): boolean => {
        return iam.tokens.validateToken(tokenId).valid;
      },

      // ── Federation Functions ──────────────────────
      /** Get identity provider count. */
      iam_idpCount: (): number => {
        return iam.federation.identityProviderCount;
      },

      /** Get service provider count. */
      iam_spCount: (): number => {
        return iam.federation.serviceProviderCount;
      },

      /** Get federated auth count. */
      iam_federatedAuthCount: (): number => {
        return iam.federation.federatedAuthTotal;
      },

      // ── Governance Functions ──────────────────────
      /** Get active certification campaign count. */
      iam_activeCampaignCount: (): number => {
        return iam.governance.activeCampaignCount;
      },

      /** Get SoD policy count. */
      iam_sodPolicyCount: (): number => {
        return iam.governance.totalSoDPolicies;
      },

      /** Get active SoD violation count. */
      iam_activeSoDViolationCount: (): number => {
        return iam.governance.activeSoDViolationCount;
      },

      /** Get pending access request count. */
      iam_pendingAccessRequestCount: (): number => {
        return iam.governance.pendingAccessRequestCount;
      },

      // ── PAM Functions ─────────────────────────────
      /** Get privileged account count. */
      iam_privilegedAccountCount: (): number => {
        return iam.pam.totalAccounts;
      },

      /** Get active checkout count. */
      iam_activeCheckoutCount: (): number => {
        return iam.pam.activeCheckoutCount;
      },

      /** Check if a privileged account is checked out. */
      iam_isCheckedOut: (accountId: string): boolean => {
        return iam.pam.isCheckedOut(accountId);
      },

      // ── Risk Functions ────────────────────────────
      /** Get the average risk score. */
      iam_averageRiskScore: (): number => {
        return iam.risk.averageRiskScore;
      },

      /** Get the risk level for an identity. */
      iam_riskLevel: (identityId: string): string => {
        const assessment = iam.risk.getLatestAssessment(identityId);
        return assessment?.riskLevel ?? 'unknown';
      },

      /** Get anomaly count. */
      iam_anomalyCount: (): number => {
        return iam.risk.anomalyCount;
      },

      /** Get active threat indicator count. */
      iam_threatIndicatorCount: (): number => {
        return iam.risk.activeThreatIndicatorCount;
      },

      // ── Credential Functions ──────────────────────
      /** Get total credential count. */
      iam_credentialCount: (): number => {
        return iam.credentials.totalCredentials;
      },

      /** Get compromised credential count. */
      iam_compromisedCredentialCount: (): number => {
        return iam.credentials.compromisedCredentials;
      },

      // ── General Functions ─────────────────────────
      /** Get IAM metrics. */
      iam_getMetrics: (): any => {
        return iam.getMetrics();
      },

      /** Generate a unique ID. */
      iam_generateId: (): string => {
        return generateId();
      },
    },

    // ── Lifecycle ─────────────────────────────────────────
    onRegister: () => {
      iam.security.recordAudit({
        action: 'plugin.registered',
        actor: 'rule-engine',
        resource: 'soa-one-iam',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-iam' },
        success: true,
      });
      iam.monitoring.metrics.incrementCounter('plugin.registered');
    },

    onDestroy: () => {
      iam.security.recordAudit({
        action: 'plugin.destroyed',
        actor: 'rule-engine',
        resource: 'soa-one-iam',
        resourceType: 'plugin',
        details: { plugin: 'soa-one-iam' },
        success: true,
      });
      iam.monitoring.metrics.incrementCounter('plugin.destroyed');
    },
  };
}
