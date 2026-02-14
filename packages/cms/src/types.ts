// ============================================================
// SOA One CMS — Type Definitions
// ============================================================
//
// Comprehensive type system for the Content Management module.
// Covers documents, repositories, workflows, imaging, search,
// taxonomy, retention, collaboration, security, rendition,
// metadata, analytics, and federation.
//
// Surpasses Oracle WebCenter and Oracle Imaging & Process
// Management in breadth and depth of capabilities.
// ============================================================

// ── Document Types ──────────────────────────────────────────

/** Document lifecycle states. */
export type DocumentStatus =
  | 'draft'
  | 'pending-review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'deleted'
  | 'superseded'
  | 'checked-out'
  | 'locked'
  | 'expired';

/** Content MIME type categories. */
export type ContentCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'video'
  | 'audio'
  | 'email'
  | 'archive'
  | 'code'
  | 'data'
  | 'form'
  | 'drawing'
  | 'other';

/** Document priority levels. */
export type DocumentPriority = 'low' | 'normal' | 'high' | 'critical';

/** A content management document. */
export interface CMSDocument {
  /** Globally unique document ID. */
  id: string;
  /** Human-readable document name/title. */
  name: string;
  /** Document description. */
  description?: string;
  /** MIME content type (e.g. 'application/pdf'). */
  mimeType: string;
  /** Content category. */
  category: ContentCategory;
  /** Current lifecycle status. */
  status: DocumentStatus;
  /** Priority. */
  priority: DocumentPriority;
  /** Raw content (text, binary placeholder, or structured). */
  content: any;
  /** Content size in bytes. */
  sizeBytes: number;
  /** Content hash for integrity verification. */
  contentHash?: string;
  /** Hash algorithm used. */
  hashAlgorithm?: 'sha256' | 'sha384' | 'sha512' | 'md5';
  /** Current version number. */
  version: number;
  /** Version label (e.g. '1.0', '2.0-draft'). */
  versionLabel?: string;
  /** Parent folder/container path. */
  path: string;
  /** Tags for quick categorization. */
  tags: string[];
  /** Custom metadata key-value pairs. */
  metadata: Record<string, any>;
  /** Document owner (principal). */
  owner: string;
  /** Creator. */
  createdBy: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Last modifier. */
  modifiedBy: string;
  /** ISO-8601 last modification timestamp. */
  modifiedAt: string;
  /** Whether the document is currently locked. */
  locked: boolean;
  /** Who holds the lock. */
  lockedBy?: string;
  /** ISO-8601 lock timestamp. */
  lockedAt?: string;
  /** Lock expiration. */
  lockExpiresAt?: string;
  /** Whether the document is checked out. */
  checkedOut: boolean;
  /** Who checked it out. */
  checkedOutBy?: string;
  /** Checkout timestamp. */
  checkedOutAt?: string;
  /** Retention policy ID applied to this document. */
  retentionPolicyId?: string;
  /** Legal hold flag. */
  legalHold: boolean;
  /** Expiration date. */
  expiresAt?: string;
  /** Taxonomy node IDs this document belongs to. */
  taxonomyNodeIds: string[];
  /** ACL ID for access control. */
  aclId?: string;
  /** Links to related documents. */
  relatedDocumentIds: string[];
  /** Available renditions. */
  renditionIds: string[];
  /** Language/locale. */
  language?: string;
  /** Character encoding. */
  encoding?: string;
}

/** A version snapshot of a document. */
export interface DocumentVersion {
  /** Version ID. */
  id: string;
  /** Document ID this version belongs to. */
  documentId: string;
  /** Sequential version number. */
  versionNumber: number;
  /** Human-readable version label. */
  versionLabel?: string;
  /** Content at this version. */
  content: any;
  /** Size in bytes. */
  sizeBytes: number;
  /** Content hash. */
  contentHash?: string;
  /** Change description. */
  changeDescription?: string;
  /** Whether this is a major or minor version. */
  versionType: 'major' | 'minor';
  /** Who created this version. */
  createdBy: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Document metadata at this version. */
  metadata: Record<string, any>;
  /** Tags at this version. */
  tags: string[];
  /** Status at this version. */
  status: DocumentStatus;
}

/** Document relationship types. */
export type DocumentRelationType =
  | 'parent'
  | 'child'
  | 'sibling'
  | 'reference'
  | 'attachment'
  | 'translation'
  | 'rendition'
  | 'supersedes'
  | 'superseded-by'
  | 'derived-from'
  | 'response-to';

/** A relationship between two documents. */
export interface DocumentRelation {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationType: DocumentRelationType;
  metadata?: Record<string, any>;
  createdBy: string;
  createdAt: string;
}

/** A folder or container in the content hierarchy. */
export interface Folder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  path: string;
  owner: string;
  createdBy: string;
  createdAt: string;
  modifiedAt: string;
  metadata: Record<string, any>;
  aclId?: string;
  documentCount: number;
  subfolderCount: number;
}

// ── Repository Types ────────────────────────────────────────

/** Repository type. */
export type RepositoryType = 'standard' | 'federated' | 'archive' | 'staging';

/** Repository storage tier. */
export type StorageTier = 'hot' | 'warm' | 'cold' | 'archive' | 'glacier';

/** Repository configuration. */
export interface RepositoryConfig {
  /** Repository unique name. */
  name: string;
  /** Repository type. */
  type: RepositoryType;
  /** Default storage tier. */
  defaultStorageTier: StorageTier;
  /** Maximum document size in bytes. */
  maxDocumentSizeBytes?: number;
  /** Allowed MIME types (empty = all). */
  allowedMimeTypes?: string[];
  /** Blocked MIME types. */
  blockedMimeTypes?: string[];
  /** Whether versioning is enabled. */
  versioningEnabled: boolean;
  /** Maximum versions to retain per document (0 = unlimited). */
  maxVersions?: number;
  /** Whether to auto-generate content hashes. */
  autoHash: boolean;
  /** Hash algorithm. */
  hashAlgorithm: 'sha256' | 'sha384' | 'sha512' | 'md5';
  /** Whether deduplication is enabled. */
  deduplication: boolean;
  /** Default ACL for new documents. */
  defaultAclId?: string;
  /** Quota in bytes (0 = unlimited). */
  quotaBytes?: number;
  /** Custom metadata. */
  metadata?: Record<string, any>;
}

/** Repository metrics snapshot. */
export interface RepositoryMetrics {
  totalDocuments: number;
  totalVersions: number;
  totalFolders: number;
  totalSizeBytes: number;
  quotaUsedPercent: number;
  documentsByStatus: Record<DocumentStatus, number>;
  documentsByCategory: Record<ContentCategory, number>;
  documentsCreatedToday: number;
  documentsModifiedToday: number;
  averageVersionsPerDocument: number;
  timestamp: string;
}

// ── Workflow Types ───────────────────────────────────────────

/** Workflow instance status. */
export type WorkflowStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'timed-out';

/** Workflow step types. */
export type WorkflowStepType =
  | 'approval'
  | 'review'
  | 'task'
  | 'notification'
  | 'condition'
  | 'parallel-gateway'
  | 'exclusive-gateway'
  | 'timer'
  | 'script'
  | 'sub-workflow'
  | 'human-task'
  | 'service-call'
  | 'content-update'
  | 'escalation';

/** Workflow step status. */
export type WorkflowStepStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'timed-out'
  | 'escalated'
  | 'delegated';

/** Approval outcome. */
export type ApprovalOutcome = 'approved' | 'rejected' | 'deferred' | 'abstained';

/** Escalation policy. */
export interface EscalationPolicy {
  /** Time before escalation in ms. */
  escalateAfterMs: number;
  /** Who to escalate to. */
  escalateTo: string;
  /** Maximum escalation levels. */
  maxEscalations: number;
  /** Action on max escalation. */
  onMaxEscalation: 'auto-approve' | 'auto-reject' | 'cancel' | 'notify-admin';
}

/** A step in a workflow definition. */
export interface WorkflowStepDefinition {
  /** Step name. */
  name: string;
  /** Step type. */
  type: WorkflowStepType;
  /** Description. */
  description?: string;
  /** Assignee (user/role/group). */
  assignee?: string;
  /** Candidate groups. */
  candidateGroups?: string[];
  /** Timeout in ms. */
  timeoutMs?: number;
  /** Escalation policy. */
  escalation?: EscalationPolicy;
  /** Dependencies: step names that must complete first. */
  dependsOn?: string[];
  /** Condition expression for conditional steps. */
  condition?: string;
  /** Script expression for script steps. */
  script?: string;
  /** Sub-workflow ID for sub-workflow steps. */
  subWorkflowId?: string;
  /** Whether this step is optional (can be skipped). */
  optional?: boolean;
  /** Priority. */
  priority?: DocumentPriority;
  /** Due date offset in ms from step activation. */
  dueDateOffsetMs?: number;
  /** Notification template for notification steps. */
  notificationTemplate?: string;
  /** Allowed outcomes for approval steps. */
  allowedOutcomes?: ApprovalOutcome[];
  /** Required approval count for multi-approver steps. */
  requiredApprovals?: number;
  /** Custom configuration. */
  config?: Record<string, any>;
}

/** A complete workflow definition. */
export interface WorkflowDefinition {
  /** Unique workflow ID. */
  id: string;
  /** Workflow name. */
  name: string;
  /** Description. */
  description?: string;
  /** Workflow version. */
  version: string;
  /** Ordered steps. */
  steps: WorkflowStepDefinition[];
  /** Overall timeout in ms. */
  timeoutMs?: number;
  /** Whether to auto-cancel on document deletion. */
  autoCancelOnDelete: boolean;
  /** Custom metadata. */
  metadata?: Record<string, any>;
}

/** A workflow instance with runtime state. */
export interface WorkflowInstance {
  /** Unique instance ID. */
  instanceId: string;
  /** Workflow definition ID. */
  workflowId: string;
  /** Workflow name. */
  workflowName: string;
  /** Document ID being processed. */
  documentId: string;
  /** Overall status. */
  status: WorkflowStatus;
  /** Current step index. */
  currentStep: number;
  /** Per-step status tracking. */
  stepStatuses: Record<string, WorkflowStepStatus>;
  /** Per-step outcomes. */
  stepOutcomes: Record<string, ApprovalOutcome | string>;
  /** Per-step assignees (actual, after delegation). */
  stepAssignees: Record<string, string>;
  /** Per-step comments. */
  stepComments: Record<string, string[]>;
  /** Context data accumulated through execution. */
  context: WorkflowContext;
  /** Initiator. */
  initiatedBy: string;
  /** Start time. */
  startedAt: string;
  /** Completion time. */
  completedAt?: string;
  /** Error details. */
  error?: string;
  /** Execution log. */
  log: WorkflowLogEntry[];
}

/** Workflow execution context. */
export interface WorkflowContext {
  workflowId: string;
  instanceId: string;
  documentId: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  stepResults: Record<string, any>;
}

/** A log entry for workflow execution. */
export interface WorkflowLogEntry {
  timestamp: string;
  stepName: string;
  action: 'activate' | 'complete' | 'skip' | 'fail' | 'escalate' | 'delegate' | 'timeout';
  actor?: string;
  outcome?: string;
  comment?: string;
  durationMs?: number;
  error?: string;
}

// ── Imaging Types ───────────────────────────────────────────

/** Image processing operation types. */
export type ImagingOperation =
  | 'ocr'
  | 'barcode-detect'
  | 'barcode-generate'
  | 'thumbnail'
  | 'resize'
  | 'rotate'
  | 'crop'
  | 'watermark'
  | 'annotate'
  | 'redact'
  | 'deskew'
  | 'denoise'
  | 'contrast-adjust'
  | 'brightness-adjust'
  | 'color-convert'
  | 'merge'
  | 'split'
  | 'compare'
  | 'stamp'
  | 'page-extract'
  | 'classify';

/** OCR configuration. */
export interface OCRConfig {
  /** Target language(s) for OCR. */
  languages: string[];
  /** Output format. */
  outputFormat: 'text' | 'hocr' | 'structured' | 'searchable-pdf';
  /** Confidence threshold (0-1). */
  confidenceThreshold: number;
  /** Whether to detect page orientation. */
  detectOrientation: boolean;
  /** Whether to detect tables. */
  detectTables: boolean;
  /** Whether to detect handwriting. */
  detectHandwriting: boolean;
  /** Page range (empty = all). */
  pageRange?: string;
  /** DPI for processing. */
  dpi?: number;
  /** Preprocessing steps. */
  preprocessing?: ('deskew' | 'denoise' | 'contrast' | 'binarize')[];
}

/** OCR result. */
export interface OCRResult {
  /** Full extracted text. */
  text: string;
  /** Confidence score (0-1). */
  confidence: number;
  /** Per-page results. */
  pages: OCRPageResult[];
  /** Detected language. */
  detectedLanguage?: string;
  /** Processing time in ms. */
  processingTimeMs: number;
  /** Detected tables. */
  tables?: OCRTable[];
}

/** OCR result for a single page. */
export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  width: number;
  height: number;
  blocks: OCRBlock[];
}

/** A text block detected by OCR. */
export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  blockType: 'text' | 'table' | 'figure' | 'header' | 'footer' | 'handwriting';
}

/** OCR-detected table. */
export interface OCRTable {
  pageNumber: number;
  rows: number;
  columns: number;
  cells: OCRTableCell[];
  boundingBox: BoundingBox;
}

/** A cell in an OCR-detected table. */
export interface OCRTableCell {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  text: string;
  confidence: number;
}

/** Bounding box coordinates. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Barcode types. */
export type BarcodeType =
  | 'qr'
  | 'code128'
  | 'code39'
  | 'ean13'
  | 'ean8'
  | 'upc-a'
  | 'upc-e'
  | 'pdf417'
  | 'data-matrix'
  | 'aztec'
  | 'interleaved-2-of-5';

/** Barcode detection configuration. */
export interface BarcodeConfig {
  /** Barcode types to detect (empty = all). */
  types?: BarcodeType[];
  /** Maximum barcodes to detect. */
  maxResults?: number;
  /** Page range. */
  pageRange?: string;
}

/** Barcode detection result. */
export interface BarcodeResult {
  type: BarcodeType;
  value: string;
  confidence: number;
  boundingBox: BoundingBox;
  pageNumber: number;
}

/** Watermark configuration. */
export interface WatermarkConfig {
  /** Watermark text. */
  text?: string;
  /** Watermark image data. */
  imageData?: any;
  /** Position. */
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  /** Opacity (0-1). */
  opacity: number;
  /** Rotation angle in degrees. */
  rotation?: number;
  /** Font size (text watermarks). */
  fontSize?: number;
  /** Font color (text watermarks). */
  fontColor?: string;
  /** Pages to apply to (empty = all). */
  pages?: number[];
}

/** Document annotation types. */
export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'text-note'
  | 'sticky-note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'stamp'
  | 'redaction'
  | 'link'
  | 'callout'
  | 'polygon';

/** An annotation on a document. */
export interface Annotation {
  id: string;
  documentId: string;
  pageNumber: number;
  type: AnnotationType;
  /** Bounding region. */
  boundingBox: BoundingBox;
  /** Points for freehand/polygon. */
  points?: { x: number; y: number }[];
  /** Text content (for notes, callouts). */
  text?: string;
  /** Color. */
  color?: string;
  /** Opacity (0-1). */
  opacity?: number;
  /** Font size. */
  fontSize?: number;
  /** Stamp text or image. */
  stampData?: string;
  /** Reply annotations. */
  replies?: AnnotationReply[];
  /** Creator. */
  createdBy: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Last modifier. */
  modifiedBy?: string;
  /** Modification timestamp. */
  modifiedAt?: string;
  /** Status. */
  status: 'active' | 'resolved' | 'deleted';
}

/** A reply to an annotation. */
export interface AnnotationReply {
  id: string;
  annotationId: string;
  text: string;
  createdBy: string;
  createdAt: string;
}

/** Document comparison result. */
export interface ComparisonResult {
  /** Source document ID. */
  sourceDocumentId: string;
  /** Target document ID. */
  targetDocumentId: string;
  /** Similarity score (0-1). */
  similarityScore: number;
  /** Detected differences. */
  differences: DocumentDifference[];
  /** Processing time in ms. */
  processingTimeMs: number;
}

/** A difference between two documents. */
export interface DocumentDifference {
  type: 'addition' | 'deletion' | 'modification' | 'move';
  location: string;
  sourceContent?: string;
  targetContent?: string;
  pageNumber?: number;
}

/** Imaging pipeline definition. */
export interface ImagingPipeline {
  name: string;
  steps: ImagingStep[];
  stopOnError: boolean;
}

/** A step in an imaging pipeline. */
export interface ImagingStep {
  operation: ImagingOperation;
  name: string;
  config: Record<string, any>;
}

// ── Search Types ────────────────────────────────────────────

/** Search query types. */
export type SearchQueryType = 'fulltext' | 'metadata' | 'combined' | 'similarity' | 'structured';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

/** Search operator. */
export type SearchOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'notExists'
  | 'matches'
  | 'fuzzy'
  | 'proximity'
  | 'wildcard';

/** A search query. */
export interface SearchQuery {
  /** Query type. */
  type: SearchQueryType;
  /** Full-text search terms. */
  text?: string;
  /** Metadata field conditions. */
  conditions?: SearchCondition[];
  /** Condition group logic. */
  conditionLogic?: 'AND' | 'OR';
  /** Sort criteria. */
  sort?: SearchSort[];
  /** Pagination offset. */
  offset?: number;
  /** Page size. */
  limit?: number;
  /** Facets to compute. */
  facets?: SearchFacetRequest[];
  /** Fields to return (empty = all). */
  fields?: string[];
  /** Highlight matching terms. */
  highlight?: boolean;
  /** Highlight pre-tag. */
  highlightPreTag?: string;
  /** Highlight post-tag. */
  highlightPostTag?: string;
  /** Fuzzy matching tolerance (0-2). */
  fuzziness?: number;
  /** Minimum relevance score (0-1). */
  minScore?: number;
  /** Content categories to search. */
  categories?: ContentCategory[];
  /** Document statuses to include. */
  statuses?: DocumentStatus[];
  /** Folder path to scope search. */
  folderPath?: string;
  /** Whether to search recursively in subfolders. */
  recursive?: boolean;
  /** Date range filter. */
  dateRange?: DateRange;
  /** Saved search ID to reuse. */
  savedSearchId?: string;
}

/** A search condition on a metadata field. */
export interface SearchCondition {
  field: string;
  operator: SearchOperator;
  value: any;
  /** Boost factor for relevance scoring. */
  boost?: number;
}

/** Sort specification. */
export interface SearchSort {
  field: string;
  direction: SortDirection;
}

/** Facet request. */
export interface SearchFacetRequest {
  field: string;
  type: 'terms' | 'range' | 'date-histogram';
  size?: number;
  ranges?: { from?: any; to?: any; label: string }[];
  interval?: string;
}

/** Date range filter. */
export interface DateRange {
  field: string;
  from?: string;
  to?: string;
}

/** Search result set. */
export interface SearchResults {
  /** Matching documents. */
  hits: SearchHit[];
  /** Total number of matches. */
  totalHits: number;
  /** Query execution time in ms. */
  executionTimeMs: number;
  /** Maximum relevance score. */
  maxScore: number;
  /** Computed facets. */
  facets: SearchFacetResult[];
  /** Search suggestions (did you mean). */
  suggestions?: string[];
  /** Pagination info. */
  offset: number;
  limit: number;
  hasMore: boolean;
}

/** A single search hit. */
export interface SearchHit {
  documentId: string;
  /** Relevance score (0-1). */
  score: number;
  /** Highlighted fragments. */
  highlights?: Record<string, string[]>;
  /** Document snapshot (partial or full). */
  document: Partial<CMSDocument>;
}

/** Facet result. */
export interface SearchFacetResult {
  field: string;
  buckets: SearchFacetBucket[];
}

/** A bucket in a facet. */
export interface SearchFacetBucket {
  key: string;
  count: number;
  label?: string;
}

/** A saved search definition. */
export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  owner: string;
  shared: boolean;
  createdAt: string;
  modifiedAt: string;
}

// ── Taxonomy Types ──────────────────────────────────────────

/** Taxonomy types. */
export type TaxonomyType = 'hierarchical' | 'flat' | 'network' | 'faceted';

/** A taxonomy definition. */
export interface TaxonomyDefinition {
  id: string;
  name: string;
  description?: string;
  type: TaxonomyType;
  /** Root nodes. */
  rootNodeIds: string[];
  /** Whether auto-classification is enabled. */
  autoClassification: boolean;
  /** Classification rules for auto-assignment. */
  classificationRules?: ClassificationRule[];
  /** Owner. */
  owner: string;
  /** Created timestamp. */
  createdAt: string;
  /** Modified timestamp. */
  modifiedAt: string;
  /** Custom metadata. */
  metadata?: Record<string, any>;
}

/** A node in a taxonomy tree. */
export interface TaxonomyNode {
  id: string;
  taxonomyId: string;
  name: string;
  description?: string;
  /** Parent node ID (undefined for root). */
  parentId?: string;
  /** Child node IDs. */
  childIds: string[];
  /** Depth in the tree (0 = root). */
  depth: number;
  /** Full path from root. */
  path: string;
  /** Number of documents classified under this node. */
  documentCount: number;
  /** Synonyms for this classification. */
  synonyms?: string[];
  /** Sort order among siblings. */
  sortOrder: number;
  /** Custom metadata. */
  metadata?: Record<string, any>;
}

/** A rule for automatic document classification. */
export interface ClassificationRule {
  id: string;
  name: string;
  /** Target taxonomy node ID. */
  targetNodeId: string;
  /** Conditions that trigger classification. */
  conditions: ClassificationCondition[];
  /** Condition logic. */
  conditionLogic: 'AND' | 'OR';
  /** Confidence threshold (0-1). */
  confidenceThreshold: number;
  /** Priority (higher = evaluated first). */
  priority: number;
  /** Whether the rule is active. */
  enabled: boolean;
}

/** A condition for classification. */
export interface ClassificationCondition {
  /** What to evaluate. */
  source: 'content' | 'metadata' | 'filename' | 'mimeType' | 'path' | 'tags';
  /** Field name (for metadata). */
  field?: string;
  /** Operator. */
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'matches' | 'in';
  /** Value to match. */
  value: any;
}

// ── Retention Types ─────────────────────────────────────────

/** Retention policy disposition action. */
export type DispositionAction = 'delete' | 'archive' | 'review' | 'transfer' | 'notify' | 'extend';

/** Retention trigger types. */
export type RetentionTrigger =
  | 'creation-date'
  | 'modification-date'
  | 'last-access-date'
  | 'publication-date'
  | 'custom-date'
  | 'event'
  | 'workflow-completion';

/** A retention policy definition. */
export interface RetentionPolicy {
  id: string;
  name: string;
  description?: string;
  /** Retention period in days. */
  retentionDays: number;
  /** What triggers the retention countdown. */
  trigger: RetentionTrigger;
  /** Custom date field (if trigger is 'custom-date'). */
  triggerField?: string;
  /** Action to take when retention expires. */
  dispositionAction: DispositionAction;
  /** Secondary action after disposition. */
  secondaryAction?: DispositionAction;
  /** Whether to notify document owners before disposition. */
  notifyBeforeDisposition: boolean;
  /** Notification lead time in days. */
  notificationLeadDays?: number;
  /** Whether to allow extensions. */
  extensionsAllowed: boolean;
  /** Maximum extension period in days. */
  maxExtensionDays?: number;
  /** Document categories this policy applies to. */
  applicableCategories?: ContentCategory[];
  /** Document statuses this policy applies to. */
  applicableStatuses?: DocumentStatus[];
  /** Whether this policy is active. */
  enabled: boolean;
  /** Regulatory citation (e.g. 'GDPR Art. 17', 'SOX 802'). */
  regulatoryCitation?: string;
  /** Custom metadata. */
  metadata?: Record<string, any>;
}

/** A legal hold placed on documents. */
export interface LegalHold {
  id: string;
  name: string;
  description?: string;
  /** Case/matter reference. */
  caseReference: string;
  /** Custodian. */
  custodian: string;
  /** Document IDs under hold. */
  documentIds: string[];
  /** Query that defines the hold scope. */
  holdQuery?: SearchQuery;
  /** Start date. */
  startDate: string;
  /** End date (undefined = indefinite). */
  endDate?: string;
  /** Status. */
  status: 'active' | 'released' | 'expired';
  /** Who created the hold. */
  createdBy: string;
  /** Creation timestamp. */
  createdAt: string;
  /** Release details. */
  releasedBy?: string;
  releasedAt?: string;
  releaseReason?: string;
}

/** Retention schedule entry for a specific document. */
export interface RetentionScheduleEntry {
  documentId: string;
  policyId: string;
  retentionStartDate: string;
  retentionEndDate: string;
  dispositionAction: DispositionAction;
  status: 'active' | 'extended' | 'disposed' | 'held';
  extensionCount: number;
  lastExtensionDate?: string;
  disposedAt?: string;
  disposedBy?: string;
}

// ── Collaboration Types ─────────────────────────────────────

/** Collaboration event types. */
export type CollaborationEventType =
  | 'comment:added'
  | 'comment:edited'
  | 'comment:deleted'
  | 'comment:resolved'
  | 'annotation:added'
  | 'annotation:modified'
  | 'annotation:deleted'
  | 'annotation:resolved'
  | 'lock:acquired'
  | 'lock:released'
  | 'lock:expired'
  | 'checkout:start'
  | 'checkout:end'
  | 'presence:joined'
  | 'presence:left'
  | 'version:created'
  | 'status:changed'
  | 'share:created'
  | 'share:revoked'
  | 'mention:created'
  | 'task:assigned'
  | 'task:completed';

/** A comment on a document. */
export interface Comment {
  id: string;
  documentId: string;
  /** Parent comment ID (for threads). */
  parentId?: string;
  /** Comment text (supports markdown). */
  text: string;
  /** Page number (for page-specific comments). */
  pageNumber?: number;
  /** Anchor position (for inline comments). */
  anchor?: CommentAnchor;
  /** Mentioned users. */
  mentions: string[];
  /** Reactions. */
  reactions: CommentReaction[];
  /** Status. */
  status: 'active' | 'resolved' | 'deleted';
  /** Resolution details. */
  resolvedBy?: string;
  resolvedAt?: string;
  /** Creator. */
  createdBy: string;
  createdAt: string;
  /** Editor. */
  modifiedBy?: string;
  modifiedAt?: string;
  /** Reply count. */
  replyCount: number;
}

/** Comment anchor for inline positioning. */
export interface CommentAnchor {
  /** Field or element the comment is attached to. */
  field?: string;
  /** Text selection start offset. */
  startOffset?: number;
  /** Text selection end offset. */
  endOffset?: number;
  /** Quoted text. */
  quotedText?: string;
}

/** A reaction on a comment. */
export interface CommentReaction {
  emoji: string;
  users: string[];
  count: number;
}

/** User presence in a document. */
export interface UserPresence {
  userId: string;
  documentId: string;
  displayName: string;
  /** Cursor/view position. */
  cursor?: { pageNumber: number; offset?: number };
  /** Whether the user is actively editing. */
  isEditing: boolean;
  /** Last activity timestamp. */
  lastActiveAt: string;
  /** Session ID. */
  sessionId: string;
}

/** A share/link created for a document. */
export interface DocumentShare {
  id: string;
  documentId: string;
  /** Share type. */
  type: 'view' | 'edit' | 'comment' | 'download';
  /** Share token (for link sharing). */
  token?: string;
  /** Specific users shared with (empty = link sharing). */
  sharedWith: string[];
  /** Password protection. */
  passwordProtected: boolean;
  /** Expiration date. */
  expiresAt?: string;
  /** Maximum access count (0 = unlimited). */
  maxAccesses?: number;
  /** Current access count. */
  accessCount: number;
  /** Whether the share requires authentication. */
  requireAuth: boolean;
  /** Creator. */
  createdBy: string;
  createdAt: string;
  /** Status. */
  status: 'active' | 'expired' | 'revoked';
}

/** Collaboration event. */
export interface CollaborationEvent {
  type: CollaborationEventType;
  documentId: string;
  userId: string;
  timestamp: string;
  data?: Record<string, any>;
}

/** Collaboration event listener. */
export type CollaborationEventListener = (event: CollaborationEvent) => void;

// ── Security Types ──────────────────────────────────────────

/** Permission types. */
export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'create'
  | 'move'
  | 'copy'
  | 'version'
  | 'lock'
  | 'unlock'
  | 'checkout'
  | 'checkin'
  | 'annotate'
  | 'comment'
  | 'share'
  | 'download'
  | 'print'
  | 'export'
  | 'manage-acl'
  | 'manage-retention'
  | 'manage-workflow'
  | 'view-metadata'
  | 'edit-metadata'
  | 'classify'
  | 'redact';

/** Principal types. */
export type PrincipalType = 'user' | 'group' | 'role' | 'everyone' | 'anonymous';

/** An access control entry. */
export interface ACE {
  /** Principal identifier. */
  principal: string;
  /** Principal type. */
  principalType: PrincipalType;
  /** Granted permissions. */
  granted: Permission[];
  /** Denied permissions (override grants). */
  denied: Permission[];
}

/** An access control list. */
export interface ACL {
  id: string;
  name: string;
  description?: string;
  /** Access control entries. */
  entries: ACE[];
  /** Whether this ACL inherits from the parent folder. */
  inheritFromParent: boolean;
  /** Owner. */
  owner: string;
  /** Created timestamp. */
  createdAt: string;
  /** Modified timestamp. */
  modifiedAt: string;
}

/** Security classification levels. */
export type ClassificationLevel =
  | 'unclassified'
  | 'internal'
  | 'confidential'
  | 'secret'
  | 'top-secret';

/** Document security policy. */
export interface SecurityPolicy {
  /** Encryption at rest. */
  encryptionAtRest: boolean;
  /** Encryption algorithm. */
  encryptionAlgorithm?: 'aes-256-gcm' | 'aes-128-gcm' | 'chacha20-poly1305';
  /** Whether to enforce digital signatures. */
  digitalSignaturesRequired: boolean;
  /** DRM/rights management enabled. */
  drmEnabled: boolean;
  /** Allowed print. */
  allowPrint: boolean;
  /** Allowed copy. */
  allowCopy: boolean;
  /** Allowed download. */
  allowDownload: boolean;
  /** Allowed screen capture. */
  allowScreenCapture: boolean;
  /** Watermark on view. */
  viewWatermark: boolean;
  /** Watermark on print. */
  printWatermark: boolean;
  /** IP whitelist. */
  allowedIPs?: string[];
  /** Geographic restrictions. */
  allowedRegions?: string[];
  /** Session timeout in ms. */
  sessionTimeoutMs?: number;
  /** Max concurrent sessions per user. */
  maxConcurrentSessions?: number;
}

/** Audit trail entry. */
export interface AuditEntry {
  id: string;
  /** Action performed. */
  action: string;
  /** Document ID. */
  documentId?: string;
  /** Repository name. */
  repositoryName?: string;
  /** Who performed the action. */
  actor: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** IP address. */
  ipAddress?: string;
  /** User agent. */
  userAgent?: string;
  /** Action details. */
  details?: Record<string, any>;
  /** Before-state snapshot. */
  beforeState?: Record<string, any>;
  /** After-state snapshot. */
  afterState?: Record<string, any>;
  /** Success/failure. */
  success: boolean;
  /** Error if failed. */
  error?: string;
}

// ── Rendition Types ─────────────────────────────────────────

/** Rendition types. */
export type RenditionType =
  | 'pdf'
  | 'thumbnail'
  | 'preview'
  | 'web-optimized'
  | 'print-optimized'
  | 'text-extract'
  | 'audio-transcript'
  | 'video-thumbnail'
  | 'compressed'
  | 'accessible'
  | 'custom';

/** Rendition status. */
export type RenditionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'stale';

/** A document rendition. */
export interface Rendition {
  id: string;
  documentId: string;
  /** Source version number. */
  sourceVersion: number;
  /** Rendition type. */
  type: RenditionType;
  /** Output MIME type. */
  mimeType: string;
  /** Rendered content. */
  content: any;
  /** Size in bytes. */
  sizeBytes: number;
  /** Processing status. */
  status: RenditionStatus;
  /** Width (for images/thumbnails). */
  width?: number;
  /** Height. */
  height?: number;
  /** Page count (for PDFs). */
  pageCount?: number;
  /** Quality setting (0-100). */
  quality?: number;
  /** Processing time in ms. */
  processingTimeMs?: number;
  /** Error message if failed. */
  error?: string;
  /** Created timestamp. */
  createdAt: string;
  /** Expiration timestamp. */
  expiresAt?: string;
}

/** Rendition profile definition. */
export interface RenditionProfile {
  id: string;
  name: string;
  description?: string;
  /** Rendition type. */
  type: RenditionType;
  /** Target MIME type. */
  targetMimeType: string;
  /** MIME types this profile can convert from. */
  supportedSourceTypes: string[];
  /** Conversion configuration. */
  config: RenditionConfig;
  /** Whether to auto-generate on document upload. */
  autoGenerate: boolean;
  /** When to regenerate. */
  regenerateOn: 'version-change' | 'metadata-change' | 'manual';
  /** Priority. */
  priority: number;
  /** Whether this profile is enabled. */
  enabled: boolean;
}

/** Rendition conversion configuration. */
export interface RenditionConfig {
  /** Target width (images). */
  width?: number;
  /** Target height (images). */
  height?: number;
  /** Quality (0-100). */
  quality?: number;
  /** DPI. */
  dpi?: number;
  /** Color mode. */
  colorMode?: 'color' | 'grayscale' | 'monochrome';
  /** Page range. */
  pageRange?: string;
  /** Compression. */
  compression?: 'none' | 'lossless' | 'lossy';
  /** Whether to include annotations. */
  includeAnnotations?: boolean;
  /** Whether to include watermark. */
  includeWatermark?: boolean;
  /** Accessibility features. */
  accessibility?: boolean;
  /** Custom options. */
  options?: Record<string, any>;
}

// ── Metadata Types ──────────────────────────────────────────

/** Metadata field types. */
export type MetadataFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'text'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'select'
  | 'multi-select'
  | 'user'
  | 'document-reference'
  | 'geolocation'
  | 'json'
  | 'computed';

/** A metadata schema definition. */
export interface MetadataSchema {
  id: string;
  name: string;
  description?: string;
  /** Schema version. */
  version: string;
  /** Field definitions. */
  fields: MetadataFieldDefinition[];
  /** MIME types this schema applies to (empty = all). */
  applicableMimeTypes?: string[];
  /** Content categories this schema applies to (empty = all). */
  applicableCategories?: ContentCategory[];
  /** Whether this schema is required for applicable documents. */
  required: boolean;
  /** Whether fields are inheritable from parent folders. */
  inheritable: boolean;
  /** Owner. */
  owner: string;
  /** Created timestamp. */
  createdAt: string;
  /** Modified timestamp. */
  modifiedAt: string;
}

/** A field definition within a metadata schema. */
export interface MetadataFieldDefinition {
  /** Field key. */
  key: string;
  /** Display label. */
  label: string;
  /** Description. */
  description?: string;
  /** Field type. */
  type: MetadataFieldType;
  /** Whether the field is required. */
  required: boolean;
  /** Default value. */
  defaultValue?: any;
  /** Minimum value or length. */
  min?: number;
  /** Maximum value or length. */
  max?: number;
  /** Regex validation pattern. */
  pattern?: string;
  /** Enum values (for select/multi-select). */
  enumValues?: MetadataEnumValue[];
  /** Whether the field is searchable. */
  searchable: boolean;
  /** Whether the field is sortable. */
  sortable: boolean;
  /** Whether the field is displayed in list views. */
  displayInList: boolean;
  /** Display order. */
  displayOrder: number;
  /** Computed expression (for computed fields). */
  computedExpression?: string;
  /** Whether the field is read-only. */
  readOnly: boolean;
  /** Whether the field is hidden from UI. */
  hidden: boolean;
  /** Group/section name. */
  group?: string;
}

/** An enum value option. */
export interface MetadataEnumValue {
  value: string;
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  disabled?: boolean;
}

/** Metadata extraction source. */
export type ExtractionSource = 'content' | 'filename' | 'exif' | 'xmp' | 'iptc' | 'pdf-properties' | 'office-properties' | 'custom';

/** Metadata extraction rule. */
export interface ExtractionRule {
  id: string;
  name: string;
  source: ExtractionSource;
  /** Target metadata field. */
  targetField: string;
  /** Extraction pattern (regex for content, property name for others). */
  pattern?: string;
  /** Transform function name. */
  transform?: string;
  /** Default value if extraction fails. */
  defaultValue?: any;
  /** MIME types this rule applies to. */
  applicableMimeTypes?: string[];
  /** Priority. */
  priority: number;
  /** Whether this rule is enabled. */
  enabled: boolean;
}

/** Metadata validation result. */
export interface MetadataValidationResult {
  valid: boolean;
  errors: MetadataValidationError[];
}

/** A metadata validation error. */
export interface MetadataValidationError {
  field: string;
  message: string;
  expectedType?: string;
  actualValue?: any;
  constraint?: string;
}

// ── CMS Event Types ─────────────────────────────────────────

/** CMS lifecycle and operational events. */
export type CMSEventType =
  | 'cms:started'
  | 'cms:stopped'
  | 'cms:error'
  | 'document:created'
  | 'document:updated'
  | 'document:deleted'
  | 'document:versioned'
  | 'document:locked'
  | 'document:unlocked'
  | 'document:checked-out'
  | 'document:checked-in'
  | 'document:moved'
  | 'document:copied'
  | 'document:status-changed'
  | 'document:classified'
  | 'document:retention-applied'
  | 'document:legal-hold'
  | 'document:rendition-created'
  | 'document:shared'
  | 'folder:created'
  | 'folder:deleted'
  | 'folder:moved'
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:step-completed'
  | 'workflow:escalated'
  | 'search:executed'
  | 'imaging:processed'
  | 'retention:disposed'
  | 'security:violation'
  | 'security:acl-changed'
  | 'audit:recorded';

/** A CMS event. */
export interface CMSEvent {
  type: CMSEventType;
  timestamp: string;
  source: string;
  documentId?: string;
  userId?: string;
  data?: Record<string, any>;
  error?: string;
}

/** CMS event listener. */
export type CMSEventListener = (event: CMSEvent) => void;

// ── CMS Metrics Types ───────────────────────────────────────

/** CMS metrics snapshot. */
export interface CMSMetrics {
  /** Total documents. */
  totalDocuments: number;
  /** Total versions across all documents. */
  totalVersions: number;
  /** Total folders. */
  totalFolders: number;
  /** Total storage used in bytes. */
  totalStorageBytes: number;
  /** Documents by status. */
  documentsByStatus: Record<string, number>;
  /** Documents by category. */
  documentsByCategory: Record<string, number>;
  /** Active workflows. */
  activeWorkflows: number;
  /** Pending workflow tasks. */
  pendingTasks: number;
  /** Documents under legal hold. */
  documentsUnderHold: number;
  /** Active user sessions. */
  activeUsers: number;
  /** Search queries executed today. */
  searchQueriesToday: number;
  /** Average search latency in ms. */
  averageSearchLatencyMs: number;
  /** Renditions generated today. */
  renditionsToday: number;
  /** Imaging operations today. */
  imagingOperationsToday: number;
  /** Retention dispositions pending. */
  retentionDispositionsPending: number;
  /** Uptime in ms. */
  uptimeMs: number;
  /** Timestamp. */
  timestamp: string;
}

// ── CMS Configuration ───────────────────────────────────────

/** Full CMS configuration. */
export interface CMSConfig {
  /** CMS instance name. */
  name: string;
  /** Repository configuration. */
  repository?: RepositoryConfig;
  /** Security policy. */
  security?: SecurityPolicy;
  /** Default retention policy ID. */
  defaultRetentionPolicyId?: string;
  /** Whether audit trail is enabled. */
  auditEnabled?: boolean;
  /** Whether full-text indexing is enabled. */
  fullTextIndexEnabled?: boolean;
  /** Maximum upload size in bytes. */
  maxUploadSizeBytes?: number;
  /** Allowed MIME types (empty = all). */
  allowedMimeTypes?: string[];
  /** Auto-rendition profiles to apply on upload. */
  autoRenditionProfiles?: string[];
  /** Auto-classification taxonomies. */
  autoClassificationTaxonomies?: string[];
  /** Metadata schemas to enforce. */
  metadataSchemas?: string[];
  /** Custom metadata. */
  metadata?: Record<string, any>;
}
