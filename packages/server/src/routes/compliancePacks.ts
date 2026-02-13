import { Router } from 'express';
import { prisma } from '../prisma';
import {
  safeJsonParse,
  requireTenantId,
  requireUserId,
  validateRequired,
  asyncHandler,
} from '../utils/validation';

const router = Router();

// ---------------------------------------------------------------------------
// Compliance Pack Definitions
// ---------------------------------------------------------------------------

interface ComplianceRule {
  name: string;
  description: string;
  priority: number;
  conditions: {
    logic: string;
    conditions: { field: string; operator: string; value: any }[];
  };
  actions: { type: string; target: string; value: any }[];
}

interface CompliancePack {
  framework: string;
  name: string;
  description: string;
  ruleCount: number;
  categories: string[];
  rules: ComplianceRule[];
}

// ---- HIPAA Privacy Pack (15 rules) ----
const HIPAA_RULES: ComplianceRule[] = [
  {
    name: 'Patient Consent Required',
    description: 'Block access to PHI when patient consent has not been obtained',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'consent_obtained', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'blocked' },
      { type: 'setValue', target: 'violation_type', value: 'consent_missing' },
      { type: 'log', target: 'audit_log', value: 'PHI access blocked: patient consent not obtained' },
    ],
  },
  {
    name: 'Data Retention Check',
    description: 'Flag records older than 7 years (2555 days) for review per HIPAA retention policy',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'record_age_days', operator: 'greaterThan', value: 2555 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'retention_status', value: 'flag_for_review' },
      { type: 'setValue', target: 'review_reason', value: 'Record exceeds 7-year retention period' },
    ],
  },
  {
    name: 'Minimum Necessary Access',
    description: 'Enforce minimum necessary standard — restrict access to only required data fields',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'access_scope', operator: 'equals', value: 'full' },
        { field: 'role', operator: 'notEquals', value: 'treating_physician' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access_scope', value: 'limited' },
      { type: 'setValue', target: 'restricted_fields', value: 'ssn,financial_info,psychotherapy_notes' },
      { type: 'log', target: 'audit_log', value: 'Access scope reduced to minimum necessary' },
    ],
  },
  {
    name: 'Breach Notification Trigger',
    description: 'Trigger breach notification when unauthorized PHI access is detected',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'access_authorized', operator: 'equals', value: false },
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'records_affected', operator: 'greaterThan', value: 0 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'breach_notification_required', value: true },
      { type: 'setValue', target: 'notification_deadline_days', value: 60 },
      { type: 'setValue', target: 'incident_severity', value: 'critical' },
      { type: 'log', target: 'audit_log', value: 'HIPAA breach detected: notification process initiated' },
    ],
  },
  {
    name: 'Business Associate Agreement Check',
    description: 'Verify BAA exists before sharing PHI with third parties',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'recipient_type', operator: 'equals', value: 'business_associate' },
        { field: 'baa_on_file', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'sharing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'No BAA on file for recipient' },
    ],
  },
  {
    name: 'Access Logging Required',
    description: 'Ensure all PHI access events are logged for audit purposes',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'access_logged', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'require_logging', value: true },
      { type: 'log', target: 'audit_log', value: 'PHI access event requires audit logging' },
    ],
  },
  {
    name: 'Encryption at Rest Required',
    description: 'Verify PHI data is encrypted at rest before storage',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'storage_encrypted', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'storage_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'PHI must be encrypted at rest' },
    ],
  },
  {
    name: 'Patient Right of Access',
    description: 'Process patient requests for their own health records within 30 days',
    priority: 75,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'request_type', operator: 'equals', value: 'patient_access' },
        { field: 'request_age_days', operator: 'greaterThan', value: 30 },
        { field: 'request_fulfilled', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'compliance_violation', value: true },
      { type: 'setValue', target: 'violation_type', value: 'right_of_access_delayed' },
      { type: 'setValue', target: 'escalation_required', value: true },
    ],
  },
  {
    name: 'De-identification Verification',
    description: 'Verify data is properly de-identified before use in research',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'purpose', operator: 'equals', value: 'research' },
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'deidentified', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'blocked' },
      { type: 'setValue', target: 'block_reason', value: 'PHI must be de-identified for research use' },
    ],
  },
  {
    name: 'Emergency Access Override',
    description: 'Allow PHI access in emergency situations with enhanced logging',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'access_type', operator: 'equals', value: 'emergency' },
        { field: 'data_type', operator: 'equals', value: 'phi' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'granted' },
      { type: 'setValue', target: 'enhanced_logging', value: true },
      { type: 'setValue', target: 'post_access_review_required', value: true },
      { type: 'log', target: 'audit_log', value: 'Emergency PHI access granted: post-access review required' },
    ],
  },
  {
    name: 'Workforce Training Verification',
    description: 'Block PHI access for staff without current HIPAA training certification',
    priority: 70,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'hipaa_training_current', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'blocked' },
      { type: 'setValue', target: 'block_reason', value: 'HIPAA training certification expired or missing' },
    ],
  },
  {
    name: 'Authorization Expiry Check',
    description: 'Verify patient authorization has not expired for disclosure',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'request_type', operator: 'equals', value: 'disclosure' },
        { field: 'authorization_expired', operator: 'equals', value: true },
      ],
    },
    actions: [
      { type: 'setValue', target: 'disclosure_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Patient authorization has expired' },
    ],
  },
  {
    name: 'Psychotherapy Notes Protection',
    description: 'Apply extra protections for psychotherapy notes requiring separate authorization',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_category', operator: 'equals', value: 'psychotherapy_notes' },
        { field: 'separate_authorization', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'blocked' },
      { type: 'setValue', target: 'block_reason', value: 'Psychotherapy notes require separate patient authorization' },
    ],
  },
  {
    name: 'Transmission Encryption Required',
    description: 'Require encryption for electronic PHI transmissions',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'phi' },
        { field: 'transmission_method', operator: 'equals', value: 'electronic' },
        { field: 'transmission_encrypted', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'transmission_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Electronic PHI transmission must be encrypted' },
    ],
  },
  {
    name: 'Accounting of Disclosures',
    description: 'Maintain accounting of disclosures for the past 6 years',
    priority: 70,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'request_type', operator: 'equals', value: 'disclosure' },
        { field: 'disclosure_logged', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'require_disclosure_log', value: true },
      { type: 'log', target: 'audit_log', value: 'PHI disclosure must be added to accounting of disclosures' },
    ],
  },
];

// ---- SOX Financial Pack (12 rules) ----
const SOX_RULES: ComplianceRule[] = [
  {
    name: 'Segregation of Duties',
    description: 'Prevent the same user from both initiating and approving financial transactions',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'transaction_type', operator: 'equals', value: 'financial' },
        { field: 'initiator_id', operator: 'equals', value: '{approver_id}' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'approval_status', value: 'rejected' },
      { type: 'setValue', target: 'rejection_reason', value: 'Segregation of duties violation: initiator cannot approve own transaction' },
      { type: 'log', target: 'audit_log', value: 'SOX violation: segregation of duties breach detected' },
    ],
  },
  {
    name: 'Material Change Approval',
    description: 'Require dual approval for financial changes exceeding material threshold',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'change_type', operator: 'equals', value: 'financial_reporting' },
        { field: 'amount', operator: 'greaterThan', value: 50000 },
        { field: 'dual_approval', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'status', value: 'pending_dual_approval' },
      { type: 'setValue', target: 'approval_level', value: 'executive' },
    ],
  },
  {
    name: 'Audit Trail Completeness',
    description: 'Ensure all financial record modifications have complete audit trails',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'record_type', operator: 'equals', value: 'financial' },
        { field: 'modification_logged', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'operation_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'All financial record modifications must be logged' },
    ],
  },
  {
    name: 'Access Control Review',
    description: 'Flag user accounts with financial system access not reviewed in 90 days',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'system_type', operator: 'equals', value: 'financial' },
        { field: 'last_access_review_days', operator: 'greaterThan', value: 90 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access_review_required', value: true },
      { type: 'setValue', target: 'review_priority', value: 'high' },
    ],
  },
  {
    name: 'Change Management Approval',
    description: 'Require documented approval for changes to financial systems',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'change_target', operator: 'equals', value: 'financial_system' },
        { field: 'change_approved', operator: 'equals', value: false },
        { field: 'change_documented', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'deployment_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Changes to financial systems require documented approval' },
    ],
  },
  {
    name: 'Financial Reporting Deadline',
    description: 'Escalate when quarterly financial reports approach filing deadline',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'report_type', operator: 'equals', value: 'quarterly_financial' },
        { field: 'days_to_deadline', operator: 'lessThan', value: 5 },
        { field: 'report_status', operator: 'notEquals', value: 'filed' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'escalation_required', value: true },
      { type: 'setValue', target: 'escalation_level', value: 'cfo' },
      { type: 'setValue', target: 'urgency', value: 'critical' },
    ],
  },
  {
    name: 'Internal Control Testing',
    description: 'Flag internal controls not tested within the current fiscal year',
    priority: 75,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'control_type', operator: 'equals', value: 'internal' },
        { field: 'last_tested_days', operator: 'greaterThan', value: 365 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'testing_required', value: true },
      { type: 'setValue', target: 'compliance_status', value: 'at_risk' },
    ],
  },
  {
    name: 'Whistleblower Protection',
    description: 'Ensure anonymous reporting channels are active and functional',
    priority: 70,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'reporting_channel', operator: 'equals', value: 'anonymous' },
        { field: 'channel_active', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'compliance_violation', value: true },
      { type: 'setValue', target: 'violation_type', value: 'whistleblower_channel_inactive' },
      { type: 'setValue', target: 'remediation_priority', value: 'immediate' },
    ],
  },
  {
    name: 'Document Retention Enforcement',
    description: 'Prevent deletion of financial documents within SOX retention period',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'action_type', operator: 'equals', value: 'delete' },
        { field: 'document_type', operator: 'equals', value: 'financial' },
        { field: 'document_age_years', operator: 'lessThan', value: 7 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'deletion_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Financial documents must be retained for minimum 7 years per SOX' },
    ],
  },
  {
    name: 'CEO/CFO Certification Check',
    description: 'Verify executive certification before filing financial statements',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'filing_type', operator: 'equals', value: 'financial_statement' },
        { field: 'ceo_certified', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'filing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'CEO/CFO certification required per SOX Section 302' },
    ],
  },
  {
    name: 'External Auditor Independence',
    description: 'Verify external auditors meet independence requirements',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'auditor_type', operator: 'equals', value: 'external' },
        { field: 'provides_consulting', operator: 'equals', value: true },
      ],
    },
    actions: [
      { type: 'setValue', target: 'independence_violation', value: true },
      { type: 'setValue', target: 'violation_type', value: 'auditor_independence' },
      { type: 'log', target: 'audit_log', value: 'External auditor independence concern: concurrent consulting services' },
    ],
  },
  {
    name: 'Material Weakness Tracking',
    description: 'Track and escalate identified material weaknesses in internal controls',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'finding_type', operator: 'equals', value: 'material_weakness' },
        { field: 'remediation_status', operator: 'equals', value: 'open' },
        { field: 'finding_age_days', operator: 'greaterThan', value: 30 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'escalation_required', value: true },
      { type: 'setValue', target: 'escalation_level', value: 'audit_committee' },
      { type: 'setValue', target: 'urgency', value: 'high' },
    ],
  },
];

// ---- GDPR Data Protection Pack (18 rules) ----
const GDPR_RULES: ComplianceRule[] = [
  {
    name: 'Consent Verification',
    description: 'Verify explicit consent before processing personal data',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_category', operator: 'equals', value: 'personal' },
        { field: 'consent_given', operator: 'equals', value: false },
        { field: 'legal_basis', operator: 'notEquals', value: 'legitimate_interest' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Explicit consent required for personal data processing' },
    ],
  },
  {
    name: 'Data Minimization',
    description: 'Ensure only necessary data is collected for the stated purpose',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_fields_count', operator: 'greaterThan', value: 0 },
        { field: 'purpose_documented', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'collection_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Data collection purpose must be documented per GDPR Art. 5(1)(c)' },
    ],
  },
  {
    name: 'Right to Erasure',
    description: 'Process data erasure requests within 30 days',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'request_type', operator: 'equals', value: 'erasure' },
        { field: 'request_age_days', operator: 'greaterThan', value: 30 },
        { field: 'erasure_completed', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'compliance_violation', value: true },
      { type: 'setValue', target: 'violation_type', value: 'erasure_deadline_exceeded' },
      { type: 'setValue', target: 'escalation_required', value: true },
    ],
  },
  {
    name: 'Breach Reporting 72 Hour Rule',
    description: 'Report data breaches to supervisory authority within 72 hours',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'incident_type', operator: 'equals', value: 'data_breach' },
        { field: 'hours_since_discovery', operator: 'greaterThan', value: 48 },
        { field: 'authority_notified', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'urgency', value: 'critical' },
      { type: 'setValue', target: 'notification_required', value: true },
      { type: 'setValue', target: 'notification_deadline_hours', value: 72 },
      { type: 'log', target: 'audit_log', value: 'GDPR 72-hour breach notification deadline approaching' },
    ],
  },
  {
    name: 'Cross-Border Transfer Check',
    description: 'Verify adequate safeguards for data transfers outside EEA',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'transfer_destination', operator: 'notEquals', value: 'EEA' },
        { field: 'adequacy_decision', operator: 'equals', value: false },
        { field: 'standard_clauses', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'transfer_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Cross-border transfer requires adequacy decision or standard contractual clauses' },
    ],
  },
  {
    name: 'Data Protection Impact Assessment',
    description: 'Require DPIA for high-risk processing activities',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'processing_risk', operator: 'equals', value: 'high' },
        { field: 'dpia_completed', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Data Protection Impact Assessment required for high-risk processing' },
    ],
  },
  {
    name: 'Right to Data Portability',
    description: 'Provide data in machine-readable format within 30 days of request',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'request_type', operator: 'equals', value: 'portability' },
        { field: 'request_age_days', operator: 'greaterThan', value: 25 },
        { field: 'export_completed', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'urgency', value: 'high' },
      { type: 'setValue', target: 'escalation_required', value: true },
      { type: 'setValue', target: 'deadline_approaching', value: true },
    ],
  },
  {
    name: 'Children Data Special Protection',
    description: 'Require parental consent for processing data of children under 16',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_subject_age', operator: 'lessThan', value: 16 },
        { field: 'parental_consent', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Parental consent required for data subjects under 16' },
    ],
  },
  {
    name: 'Purpose Limitation',
    description: 'Prevent data use beyond the originally specified purpose',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'current_purpose', operator: 'notEquals', value: '{original_purpose}' },
        { field: 'purpose_compatible', operator: 'equals', value: false },
        { field: 'additional_consent', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Data cannot be processed for incompatible purposes without additional consent' },
    ],
  },
  {
    name: 'Data Processor Agreement Check',
    description: 'Verify processor agreement exists before sharing data with processors',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'recipient_role', operator: 'equals', value: 'processor' },
        { field: 'processing_agreement', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'sharing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Data processing agreement required per GDPR Art. 28' },
    ],
  },
  {
    name: 'Automated Decision Making Safeguard',
    description: 'Provide human review option for significant automated decisions',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'decision_type', operator: 'equals', value: 'automated' },
        { field: 'significant_effect', operator: 'equals', value: true },
        { field: 'human_review_available', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'decision_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Human review must be available for significant automated decisions per GDPR Art. 22' },
    ],
  },
  {
    name: 'Storage Limitation',
    description: 'Flag personal data stored beyond the declared retention period',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_category', operator: 'equals', value: 'personal' },
        { field: 'retention_period_exceeded', operator: 'equals', value: true },
      ],
    },
    actions: [
      { type: 'setValue', target: 'erasure_required', value: true },
      { type: 'setValue', target: 'review_reason', value: 'Personal data exceeds declared retention period' },
    ],
  },
  {
    name: 'Privacy Notice Update Check',
    description: 'Verify privacy notice is current when processing activities change',
    priority: 75,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'processing_activity_changed', operator: 'equals', value: true },
        { field: 'privacy_notice_updated', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'notice_update_required', value: true },
      { type: 'setValue', target: 'processing_allowed', value: false },
    ],
  },
  {
    name: 'Data Protection Officer Consultation',
    description: 'Require DPO consultation for new processing activities involving sensitive data',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'activity_type', operator: 'equals', value: 'new_processing' },
        { field: 'data_category', operator: 'equals', value: 'sensitive' },
        { field: 'dpo_consulted', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'DPO consultation required before processing sensitive data' },
    ],
  },
  {
    name: 'Right to Rectification',
    description: 'Process data correction requests within 30 days',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'request_type', operator: 'equals', value: 'rectification' },
        { field: 'request_age_days', operator: 'greaterThan', value: 25 },
        { field: 'rectification_completed', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'urgency', value: 'high' },
      { type: 'setValue', target: 'escalation_required', value: true },
    ],
  },
  {
    name: 'Consent Withdrawal Processing',
    description: 'Immediately halt processing when consent is withdrawn',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'consent_withdrawn', operator: 'equals', value: true },
        { field: 'legal_basis', operator: 'equals', value: 'consent' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'data_retention_review', value: true },
      { type: 'log', target: 'audit_log', value: 'Consent withdrawn: processing halted immediately' },
    ],
  },
  {
    name: 'Record of Processing Activities',
    description: 'Verify processing activities are documented in the ROPA register',
    priority: 75,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'processing_registered', operator: 'equals', value: false },
        { field: 'employee_count', operator: 'greaterThan', value: 250 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'registration_required', value: true },
      { type: 'setValue', target: 'compliance_status', value: 'non_compliant' },
    ],
  },
  {
    name: 'Special Category Data Protection',
    description: 'Apply enhanced protection for special category data (health, biometric, etc.)',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_category', operator: 'equals', value: 'special' },
        { field: 'explicit_consent', operator: 'equals', value: false },
        { field: 'legal_exemption', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'processing_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Special category data requires explicit consent or legal exemption per GDPR Art. 9' },
    ],
  },
];

// ---- PCI-DSS Payment Pack (10 rules) ----
const PCI_RULES: ComplianceRule[] = [
  {
    name: 'Card Data Encryption Required',
    description: 'Ensure cardholder data is encrypted using strong cryptography',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'cardholder' },
        { field: 'encryption_algorithm', operator: 'equals', value: 'none' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'storage_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Cardholder data must be encrypted with strong cryptography (AES-256 or equivalent)' },
    ],
  },
  {
    name: 'PAN Masking',
    description: 'Mask PAN display to show only first 6 and last 4 digits',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'pan' },
        { field: 'display_context', operator: 'equals', value: 'screen' },
        { field: 'pan_masked', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'display_allowed', value: false },
      { type: 'setValue', target: 'masking_required', value: true },
      { type: 'setValue', target: 'mask_format', value: 'first6_last4' },
    ],
  },
  {
    name: 'CVV Storage Prohibition',
    description: 'Prohibit storage of CVV/CVC data after authorization',
    priority: 100,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'cvv' },
        { field: 'transaction_phase', operator: 'equals', value: 'post_authorization' },
      ],
    },
    actions: [
      { type: 'setValue', target: 'storage_allowed', value: false },
      { type: 'setValue', target: 'immediate_deletion_required', value: true },
      { type: 'setValue', target: 'block_reason', value: 'CVV/CVC must never be stored after transaction authorization' },
    ],
  },
  {
    name: 'Network Segmentation Check',
    description: 'Verify cardholder data environment is properly segmented from other networks',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'network_zone', operator: 'equals', value: 'cde' },
        { field: 'segmentation_verified', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'compliance_status', value: 'at_risk' },
      { type: 'setValue', target: 'segmentation_audit_required', value: true },
    ],
  },
  {
    name: 'Access Control - Need to Know',
    description: 'Restrict cardholder data access to personnel with business need',
    priority: 90,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'cardholder' },
        { field: 'business_need_documented', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'blocked' },
      { type: 'setValue', target: 'block_reason', value: 'Documented business need required for cardholder data access' },
    ],
  },
  {
    name: 'Vulnerability Scan Compliance',
    description: 'Flag systems not scanned for vulnerabilities in the past 90 days',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'system_type', operator: 'equals', value: 'payment' },
        { field: 'days_since_vuln_scan', operator: 'greaterThan', value: 90 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'scan_required', value: true },
      { type: 'setValue', target: 'compliance_status', value: 'non_compliant' },
      { type: 'setValue', target: 'urgency', value: 'high' },
    ],
  },
  {
    name: 'Default Password Prevention',
    description: 'Prevent use of vendor default passwords on payment systems',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'system_type', operator: 'equals', value: 'payment' },
        { field: 'using_default_credentials', operator: 'equals', value: true },
      ],
    },
    actions: [
      { type: 'setValue', target: 'access', value: 'blocked' },
      { type: 'setValue', target: 'password_change_required', value: true },
      { type: 'setValue', target: 'block_reason', value: 'Default vendor credentials must be changed before system use' },
    ],
  },
  {
    name: 'TLS Encryption for Transmission',
    description: 'Require TLS 1.2+ for all cardholder data transmissions over public networks',
    priority: 95,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'data_type', operator: 'equals', value: 'cardholder' },
        { field: 'network_type', operator: 'equals', value: 'public' },
        { field: 'tls_version', operator: 'lessThan', value: 1.2 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'transmission_allowed', value: false },
      { type: 'setValue', target: 'block_reason', value: 'Cardholder data transmission requires TLS 1.2 or higher' },
    ],
  },
  {
    name: 'Log Monitoring Active',
    description: 'Verify security event logging and monitoring is active for payment systems',
    priority: 85,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'system_type', operator: 'equals', value: 'payment' },
        { field: 'logging_enabled', operator: 'equals', value: false },
      ],
    },
    actions: [
      { type: 'setValue', target: 'compliance_status', value: 'critical_violation' },
      { type: 'setValue', target: 'remediation_priority', value: 'immediate' },
      { type: 'setValue', target: 'block_reason', value: 'Security logging must be enabled on all payment systems' },
    ],
  },
  {
    name: 'Key Rotation Check',
    description: 'Ensure cryptographic keys are rotated at least annually',
    priority: 80,
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'key_type', operator: 'equals', value: 'encryption' },
        { field: 'days_since_rotation', operator: 'greaterThan', value: 365 },
      ],
    },
    actions: [
      { type: 'setValue', target: 'key_rotation_required', value: true },
      { type: 'setValue', target: 'compliance_status', value: 'non_compliant' },
      { type: 'log', target: 'audit_log', value: 'Cryptographic key exceeds annual rotation requirement' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pack Registry
// ---------------------------------------------------------------------------

const COMPLIANCE_PACKS: Record<string, CompliancePack> = {
  hipaa: {
    framework: 'hipaa',
    name: 'HIPAA Privacy',
    description: 'Health Insurance Portability and Accountability Act privacy rules covering patient consent, data retention, access control, breach notification, and PHI safeguards.',
    ruleCount: HIPAA_RULES.length,
    categories: ['patient_consent', 'data_retention', 'access_control', 'breach_notification', 'encryption', 'workforce_training'],
    rules: HIPAA_RULES,
  },
  sox: {
    framework: 'sox',
    name: 'SOX Financial',
    description: 'Sarbanes-Oxley Act compliance rules for change management, audit trail integrity, access segregation, financial reporting controls, and executive certification.',
    ruleCount: SOX_RULES.length,
    categories: ['change_management', 'audit_trail', 'access_segregation', 'financial_reporting', 'document_retention', 'internal_controls'],
    rules: SOX_RULES,
  },
  gdpr: {
    framework: 'gdpr',
    name: 'GDPR Data Protection',
    description: 'General Data Protection Regulation rules for consent management, data minimization, right to erasure, breach reporting, cross-border transfer, and automated decision making safeguards.',
    ruleCount: GDPR_RULES.length,
    categories: ['consent_management', 'data_minimization', 'right_to_erasure', 'breach_reporting', 'cross_border_transfer', 'data_subject_rights'],
    rules: GDPR_RULES,
  },
  pci: {
    framework: 'pci',
    name: 'PCI-DSS Payment',
    description: 'Payment Card Industry Data Security Standard rules for card data encryption, access control, network security, vulnerability management, and transmission security.',
    ruleCount: PCI_RULES.length,
    categories: ['card_data_encryption', 'access_control', 'network_security', 'vulnerability_management', 'transmission_security', 'key_management'],
    rules: PCI_RULES,
  },
};

// ---------------------------------------------------------------------------
// GET /packs -- list available compliance packs (summary only)
// ---------------------------------------------------------------------------
router.get(
  '/packs',
  asyncHandler(async (_req: any, res) => {
    const packs = Object.values(COMPLIANCE_PACKS).map((pack) => ({
      framework: pack.framework,
      name: pack.name,
      description: pack.description,
      ruleCount: pack.ruleCount,
      categories: pack.categories,
    }));

    res.json(packs);
  }),
);

// ---------------------------------------------------------------------------
// GET /packs/:framework -- get full pack details with rule definitions
// ---------------------------------------------------------------------------
router.get(
  '/packs/:framework',
  asyncHandler(async (req: any, res) => {
    const framework = req.params.framework.toLowerCase();
    const pack = COMPLIANCE_PACKS[framework];

    if (!pack) {
      return res.status(404).json({
        error: `Compliance pack "${framework}" not found. Available: ${Object.keys(COMPLIANCE_PACKS).join(', ')}`,
      });
    }

    res.json(pack);
  }),
);

// ---------------------------------------------------------------------------
// POST /packs/:framework/install -- install compliance pack into the tenant
// ---------------------------------------------------------------------------
router.post(
  '/packs/:framework/install',
  asyncHandler(async (req: any, res) => {
    const tenantId = requireTenantId(req);
    const userId = requireUserId(req);

    const framework = req.params.framework.toLowerCase();
    const pack = COMPLIANCE_PACKS[framework];

    if (!pack) {
      return res.status(404).json({
        error: `Compliance pack "${framework}" not found. Available: ${Object.keys(COMPLIANCE_PACKS).join(', ')}`,
      });
    }

    // 1. Create a new Project for this compliance pack
    const project = await prisma.project.create({
      data: {
        tenantId,
        name: `${pack.name} Compliance Rules`,
        description: `Auto-installed compliance pack: ${pack.description}`,
      },
    });

    // 2. Create a RuleSet with all the pre-built rules
    const ruleSet = await prisma.ruleSet.create({
      data: {
        projectId: project.id,
        name: `${pack.name} Rules`,
        description: `${pack.ruleCount} pre-built ${pack.name} compliance rules`,
        status: 'draft',
        version: 1,
      },
    });

    // 3. Create individual Rule records
    const createdRules = [];
    for (const packRule of pack.rules) {
      const rule = await prisma.rule.create({
        data: {
          ruleSetId: ruleSet.id,
          name: packRule.name,
          description: packRule.description,
          priority: packRule.priority,
          conditions: JSON.stringify(packRule.conditions),
          actions: JSON.stringify(packRule.actions),
          enabled: true,
        },
      });
      createdRules.push(rule);
    }

    // 4. Create a ComplianceFramework linked to the rule set
    const requirements = pack.categories.map((category, index) => ({
      id: `${framework}-req-${index + 1}`,
      name: category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: `${pack.name} ${category.replace(/_/g, ' ')} requirements`,
      category,
      status: 'active',
      linkedRuleSetIds: [ruleSet.id],
    }));

    const complianceFramework = await prisma.complianceFramework.create({
      data: {
        tenantId,
        name: `${pack.name} Compliance`,
        framework: pack.framework,
        description: pack.description,
        requirements: JSON.stringify(requirements),
        status: 'active',
      },
    });

    res.status(201).json({
      message: `${pack.name} compliance pack installed successfully`,
      project: {
        id: project.id,
        name: project.name,
      },
      ruleSet: {
        id: ruleSet.id,
        name: ruleSet.name,
        ruleCount: createdRules.length,
      },
      complianceFramework: {
        id: complianceFramework.id,
        name: complianceFramework.name,
        framework: complianceFramework.framework,
        requirementCount: requirements.length,
      },
      installedRules: createdRules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        priority: r.priority,
      })),
    });
  }),
);

export default router;
