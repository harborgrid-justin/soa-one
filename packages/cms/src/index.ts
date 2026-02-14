// ============================================================
// SOA One CMS — Public API
// ============================================================
//
// Content Management module for SOA One.
// Zero-dependency, 100% compatible with @soa-one/engine SDK.
// ============================================================

// ── Core Types ──────────────────────────────────────────────

export type {
  // Document types
  DocumentStatus,
  ContentCategory,
  DocumentPriority,
  CMSDocument,
  DocumentVersion,
  DocumentRelationType,
  DocumentRelation,
  Folder,

  // Repository types
  RepositoryType,
  StorageTier,
  RepositoryConfig,
  RepositoryMetrics,

  // Workflow types
  WorkflowStatus,
  WorkflowStepType,
  WorkflowStepStatus,
  ApprovalOutcome,
  EscalationPolicy,
  WorkflowStepDefinition,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowContext,
  WorkflowLogEntry,

  // Imaging types
  ImagingOperation,
  OCRConfig,
  OCRResult,
  OCRPageResult,
  OCRBlock,
  OCRTable,
  OCRTableCell,
  BoundingBox,
  BarcodeType,
  BarcodeConfig,
  BarcodeResult,
  WatermarkConfig,
  AnnotationType,
  Annotation,
  AnnotationReply,
  ComparisonResult,
  DocumentDifference,
  ImagingPipeline,
  ImagingStep,

  // Search types
  SearchQueryType,
  SortDirection,
  SearchOperator,
  SearchQuery,
  SearchCondition,
  SearchSort,
  SearchFacetRequest,
  DateRange,
  SearchResults,
  SearchHit,
  SearchFacetResult,
  SearchFacetBucket,
  SavedSearch,

  // Taxonomy types
  TaxonomyType,
  TaxonomyDefinition,
  TaxonomyNode,
  ClassificationRule,
  ClassificationCondition,

  // Retention types
  DispositionAction,
  RetentionTrigger,
  RetentionPolicy,
  LegalHold,
  RetentionScheduleEntry,

  // Collaboration types
  CollaborationEventType,
  Comment,
  CommentAnchor,
  CommentReaction,
  UserPresence,
  DocumentShare,
  CollaborationEvent,
  CollaborationEventListener,

  // Security types
  Permission,
  PrincipalType,
  ACE,
  ACL,
  ClassificationLevel,
  SecurityPolicy,
  AuditEntry,

  // Rendition types
  RenditionType,
  RenditionStatus,
  Rendition,
  RenditionProfile,
  RenditionConfig,

  // Metadata types
  MetadataFieldType,
  MetadataSchema,
  MetadataFieldDefinition,
  MetadataEnumValue,
  ExtractionSource,
  ExtractionRule,
  MetadataValidationResult,
  MetadataValidationError,

  // CMS event types
  CMSEventType,
  CMSEvent,
  CMSEventListener,

  // CMS metrics
  CMSMetrics,

  // CMS configuration
  CMSConfig,
} from './types';

// ── ContentManagementSystem (Main Entry Point) ──────────────

export { ContentManagementSystem } from './cms';

// ── Document Management ─────────────────────────────────────

export {
  DocumentManager,
  createDocument,
  generateId,
  hashContent,
  calculateSize,
  detectCategory,
  isValidTransition,
  DocumentNotFoundError,
  DocumentLockedError,
  LegalHoldError,
  InvalidTransitionError,
  type CreateDocumentOptions,
} from './document';

// ── Content Repository ──────────────────────────────────────

export {
  ContentRepository,
  RepositoryPolicyError,
  QuotaExceededError,
} from './repository';

// ── Workflow Engine ─────────────────────────────────────────

export {
  WorkflowEngine,
  type WorkflowStepHandler,
  type WorkflowStepResult,
  type WorkflowStepRegistration,
} from './workflow';

// ── Imaging & Processing ────────────────────────────────────

export {
  OCREngine,
  BarcodeEngine,
  AnnotationManager,
  DocumentComparator,
  WatermarkEngine,
  ImagingPipelineExecutor,
  type OCRProcessor,
} from './imaging';

// ── Search Engine ───────────────────────────────────────────

export {
  SearchEngine,
  evaluateSearchOperator,
} from './search';

// ── Taxonomy & Classification ───────────────────────────────

export {
  TaxonomyManager,
  type ClassificationResult,
} from './taxonomy';

// ── Records Retention ───────────────────────────────────────

export {
  RetentionManager,
} from './retention';

// ── Collaboration ───────────────────────────────────────────

export {
  CollaborationHub,
} from './collaboration';

// ── Security & Access Control ───────────────────────────────

export {
  AccessControlManager,
  AccessDeniedError,
  ClassificationError,
} from './security';

// ── Rendition Engine ────────────────────────────────────────

export {
  RenditionEngine,
  type RenditionHandler,
} from './rendition';

// ── Metadata Management ─────────────────────────────────────

export {
  MetadataSchemaManager,
} from './metadata';

// ── Engine Plugin ───────────────────────────────────────────

export {
  createCMSPlugin,
  type EnginePlugin,
} from './plugin';
