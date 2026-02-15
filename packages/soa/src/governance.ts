// ============================================================
// SOA One — SOA Governance (Oracle SOA Governance Equivalent)
// ============================================================
//
// Service lifecycle management, versioning, approval workflows,
// compliance policies, and impact analysis. Equivalent to
// Oracle Enterprise Repository / SOA Governance Framework.
// ============================================================

import { generateId } from './registry';

// ── Types ────────────────────────────────────────────────────

export type ServiceLifecycleState = 'proposed' | 'under-review' | 'approved' | 'deployed' | 'active' | 'deprecated' | 'retired' | 'archived';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'waived' | 'not-assessed';

export interface ServiceVersion {
  id: string;
  serviceId: string;
  version: string;
  state: ServiceLifecycleState;
  description?: string;
  changelog?: string;
  breakingChanges: boolean;
  deployedAt?: string;
  retiredAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleTransition {
  id: string;
  serviceId: string;
  versionId?: string;
  fromState: ServiceLifecycleState;
  toState: ServiceLifecycleState;
  performedBy: string;
  reason?: string;
  approvalId?: string;
  timestamp: string;
}

export interface ApprovalRequest {
  id: string;
  serviceId: string;
  versionId?: string;
  requestType: 'deploy' | 'deprecate' | 'retire' | 'promote' | 'change';
  requestedBy: string;
  status: ApprovalStatus;
  approvers: string[];
  decisions: ApprovalDecision[];
  requiredApprovals: number;
  reason?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ApprovalDecision {
  approver: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decidedAt: string;
}

export interface CompliancePolicy {
  id: string;
  name: string;
  description?: string;
  category: string;
  rules: ComplianceRule[];
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceRule {
  id: string;
  check: string;
  description?: string;
  expression: string;
}

export interface ComplianceAssessment {
  id: string;
  serviceId: string;
  policyId: string;
  status: ComplianceStatus;
  violations: string[];
  assessedBy: string;
  assessedAt: string;
  waiverReason?: string;
  expiresAt?: string;
}

export interface ImpactAnalysis {
  id: string;
  serviceId: string;
  changeDescription: string;
  impactedServices: string[];
  impactedConsumers: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  analyzedBy: string;
  analyzedAt: string;
}

export interface ServiceOwnership {
  serviceId: string;
  owner: string;
  team?: string;
  department?: string;
  contactEmail?: string;
  assignedAt: string;
}

// ── GovernanceManager ────────────────────────────────────────

export class GovernanceManager {
  private _versions = new Map<string, ServiceVersion>();
  private _transitions: LifecycleTransition[] = [];
  private _approvals = new Map<string, ApprovalRequest>();
  private _compliancePolicies = new Map<string, CompliancePolicy>();
  private _assessments = new Map<string, ComplianceAssessment>();
  private _impactAnalyses = new Map<string, ImpactAnalysis>();
  private _owners = new Map<string, ServiceOwnership>();

  // ── Service Versions ──

  createVersion(version: Omit<ServiceVersion, 'id' | 'createdAt' | 'updatedAt'>): ServiceVersion {
    const now = new Date().toISOString();
    const v: ServiceVersion = { ...version, id: generateId(), createdAt: now, updatedAt: now };
    this._versions.set(v.id, v);
    return v;
  }

  getVersion(id: string): ServiceVersion | undefined {
    return this._versions.get(id);
  }

  getVersionsByService(serviceId: string): ServiceVersion[] {
    return [...this._versions.values()].filter(v => v.serviceId === serviceId);
  }

  getActiveVersion(serviceId: string): ServiceVersion | undefined {
    return [...this._versions.values()].find(v => v.serviceId === serviceId && v.state === 'active');
  }

  updateVersion(id: string, updates: Partial<ServiceVersion>): ServiceVersion {
    const v = this._versions.get(id);
    if (!v) throw new Error(`Version not found: ${id}`);
    Object.assign(v, updates, { updatedAt: new Date().toISOString() });
    return v;
  }

  get allVersions(): ServiceVersion[] {
    return [...this._versions.values()];
  }

  // ── Lifecycle Transitions ──

  transition(serviceId: string, fromState: ServiceLifecycleState, toState: ServiceLifecycleState, performedBy: string, reason?: string, versionId?: string): LifecycleTransition {
    const validTransitions: Record<ServiceLifecycleState, ServiceLifecycleState[]> = {
      'proposed': ['under-review'],
      'under-review': ['approved', 'proposed'],
      'approved': ['deployed'],
      'deployed': ['active'],
      'active': ['deprecated'],
      'deprecated': ['retired', 'active'],
      'retired': ['archived'],
      'archived': [],
    };

    if (!validTransitions[fromState]?.includes(toState)) {
      throw new Error(`Invalid transition from '${fromState}' to '${toState}'`);
    }

    const t: LifecycleTransition = {
      id: generateId(),
      serviceId,
      versionId,
      fromState,
      toState,
      performedBy,
      reason,
      timestamp: new Date().toISOString(),
    };
    this._transitions.push(t);

    if (versionId) {
      const version = this._versions.get(versionId);
      if (version) {
        version.state = toState;
        version.updatedAt = t.timestamp;
        if (toState === 'deployed') version.deployedAt = t.timestamp;
        if (toState === 'retired') version.retiredAt = t.timestamp;
      }
    }

    return t;
  }

  getTransitions(serviceId: string): LifecycleTransition[] {
    return this._transitions.filter(t => t.serviceId === serviceId);
  }

  get allTransitions(): LifecycleTransition[] {
    return [...this._transitions];
  }

  // ── Approval Requests ──

  createApproval(request: Omit<ApprovalRequest, 'id' | 'decisions' | 'status' | 'createdAt'>): ApprovalRequest {
    const a: ApprovalRequest = {
      ...request,
      id: generateId(),
      status: 'pending',
      decisions: [],
      createdAt: new Date().toISOString(),
    };
    this._approvals.set(a.id, a);
    return a;
  }

  getApproval(id: string): ApprovalRequest | undefined {
    return this._approvals.get(id);
  }

  getApprovalsByService(serviceId: string): ApprovalRequest[] {
    return [...this._approvals.values()].filter(a => a.serviceId === serviceId);
  }

  getPendingApprovals(): ApprovalRequest[] {
    return [...this._approvals.values()].filter(a => a.status === 'pending');
  }

  decide(approvalId: string, approver: string, decision: 'approved' | 'rejected', comment?: string): ApprovalRequest {
    const a = this._approvals.get(approvalId);
    if (!a) throw new Error(`Approval not found: ${approvalId}`);
    if (a.status !== 'pending') throw new Error('Approval already resolved');

    a.decisions.push({ approver, decision, comment, decidedAt: new Date().toISOString() });

    if (decision === 'rejected') {
      a.status = 'rejected';
      a.resolvedAt = new Date().toISOString();
    } else if (a.decisions.filter(d => d.decision === 'approved').length >= a.requiredApprovals) {
      a.status = 'approved';
      a.resolvedAt = new Date().toISOString();
    }

    return a;
  }

  withdrawApproval(approvalId: string): ApprovalRequest {
    const a = this._approvals.get(approvalId);
    if (!a) throw new Error(`Approval not found: ${approvalId}`);
    a.status = 'withdrawn';
    a.resolvedAt = new Date().toISOString();
    return a;
  }

  get allApprovals(): ApprovalRequest[] {
    return [...this._approvals.values()];
  }

  // ── Compliance Policies ──

  createCompliancePolicy(policy: Omit<CompliancePolicy, 'id' | 'createdAt' | 'updatedAt'>): CompliancePolicy {
    const now = new Date().toISOString();
    const p: CompliancePolicy = { ...policy, id: generateId(), createdAt: now, updatedAt: now };
    this._compliancePolicies.set(p.id, p);
    return p;
  }

  getCompliancePolicy(id: string): CompliancePolicy | undefined {
    return this._compliancePolicies.get(id);
  }

  updateCompliancePolicy(id: string, updates: Partial<CompliancePolicy>): CompliancePolicy {
    const p = this._compliancePolicies.get(id);
    if (!p) throw new Error(`Compliance policy not found: ${id}`);
    Object.assign(p, updates, { updatedAt: new Date().toISOString() });
    return p;
  }

  removeCompliancePolicy(id: string): boolean {
    return this._compliancePolicies.delete(id);
  }

  get allCompliancePolicies(): CompliancePolicy[] {
    return [...this._compliancePolicies.values()];
  }

  // ── Compliance Assessments ──

  assess(assessment: Omit<ComplianceAssessment, 'id'>): ComplianceAssessment {
    const a: ComplianceAssessment = { ...assessment, id: generateId() };
    this._assessments.set(a.id, a);
    return a;
  }

  getAssessment(id: string): ComplianceAssessment | undefined {
    return this._assessments.get(id);
  }

  getAssessmentsByService(serviceId: string): ComplianceAssessment[] {
    return [...this._assessments.values()].filter(a => a.serviceId === serviceId);
  }

  getLatestAssessment(serviceId: string, policyId: string): ComplianceAssessment | undefined {
    const assessments = [...this._assessments.values()]
      .filter(a => a.serviceId === serviceId && a.policyId === policyId)
      .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt));
    return assessments[0];
  }

  waiveAssessment(id: string, reason: string, expiresAt?: string): ComplianceAssessment {
    const a = this._assessments.get(id);
    if (!a) throw new Error(`Assessment not found: ${id}`);
    a.status = 'waived';
    a.waiverReason = reason;
    a.expiresAt = expiresAt;
    return a;
  }

  get allAssessments(): ComplianceAssessment[] {
    return [...this._assessments.values()];
  }

  // ── Impact Analysis ──

  analyzeImpact(analysis: Omit<ImpactAnalysis, 'id'>): ImpactAnalysis {
    const ia: ImpactAnalysis = { ...analysis, id: generateId() };
    this._impactAnalyses.set(ia.id, ia);
    return ia;
  }

  getImpactAnalysis(id: string): ImpactAnalysis | undefined {
    return this._impactAnalyses.get(id);
  }

  getImpactAnalysesByService(serviceId: string): ImpactAnalysis[] {
    return [...this._impactAnalyses.values()].filter(ia => ia.serviceId === serviceId);
  }

  get allImpactAnalyses(): ImpactAnalysis[] {
    return [...this._impactAnalyses.values()];
  }

  // ── Service Ownership ──

  assignOwner(ownership: ServiceOwnership): ServiceOwnership {
    this._owners.set(ownership.serviceId, ownership);
    return ownership;
  }

  getOwner(serviceId: string): ServiceOwnership | undefined {
    return this._owners.get(serviceId);
  }

  getServicesByOwner(owner: string): ServiceOwnership[] {
    return [...this._owners.values()].filter(o => o.owner === owner);
  }

  removeOwner(serviceId: string): boolean {
    return this._owners.delete(serviceId);
  }

  get allOwners(): ServiceOwnership[] {
    return [...this._owners.values()];
  }

  // ── Stats ──

  getStats(): {
    versions: number;
    transitions: number;
    pendingApprovals: number;
    compliancePolicies: number;
    assessments: number;
    impactAnalyses: number;
    owners: number;
  } {
    return {
      versions: this._versions.size,
      transitions: this._transitions.length,
      pendingApprovals: [...this._approvals.values()].filter(a => a.status === 'pending').length,
      compliancePolicies: this._compliancePolicies.size,
      assessments: this._assessments.size,
      impactAnalyses: this._impactAnalyses.size,
      owners: this._owners.size,
    };
  }
}
