// ============================================================
// SOA One SOA — B2B Gateway
// ============================================================
//
// Business-to-Business gateway subsystem for managing trading
// partners, trading partner agreements (TPA), and document
// exchanges.  Provides partner onboarding, agreement lifecycle,
// document validation, send/receive workflows, and event
// callbacks — all with zero external dependencies.
// ============================================================

import type {
  TradingPartner,
  TradingPartnerAgreement,
  B2BDocumentExchange,
  B2BDocumentFormat,
  B2BTransport,
  PartnerStatus,
  ExchangeDirection,
  B2BValidationRule,
  PartnerContact,
  TransportConfig,
  PartnerSecurityConfig,
} from './types';

import { generateId } from './registry';

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked when a document is sent outbound. */
export type DocumentSentCallback = (exchange: B2BDocumentExchange) => void;

/** Callback invoked when a document is received inbound. */
export type DocumentReceivedCallback = (exchange: B2BDocumentExchange) => void;

/** Callback invoked when a document passes validation. */
export type DocumentValidatedCallback = (exchange: B2BDocumentExchange) => void;

/** Callback invoked when a document fails validation. */
export type DocumentFailedCallback = (exchange: B2BDocumentExchange) => void;

// ── Validation Result ───────────────────────────────────────

/** Result of a document validation run. */
interface ValidationResult {
  /** Whether the document passed all rules. */
  valid: boolean;
  /** Validation error messages (empty when valid). */
  errors: string[];
}

// ── B2B Gateway ─────────────────────────────────────────────

/**
 * B2B Gateway — manages trading partners, agreements, and
 * document exchanges for inter-organisation communication.
 *
 * @example
 * ```ts
 * const gw = new B2BGateway();
 * gw.registerPartner(partner);
 * gw.registerAgreement(agreement);
 * const ex = gw.sendDocument(partnerId, agreementId, '850', content, 'edi-x12');
 * ```
 */
export class B2BGateway {
  // ── Private State ───────────────────────────────────────

  /** Registered trading partners keyed by ID. */
  private readonly _partners: Map<string, TradingPartner> = new Map();

  /** Trading partner agreements keyed by ID. */
  private readonly _agreements: Map<string, TradingPartnerAgreement> = new Map();

  /** Document exchange records keyed by ID. */
  private readonly _exchanges: Map<string, B2BDocumentExchange> = new Map();

  /** Callbacks fired when a document is sent. */
  private readonly _onDocumentSent: DocumentSentCallback[] = [];

  /** Callbacks fired when a document is received. */
  private readonly _onDocumentReceived: DocumentReceivedCallback[] = [];

  /** Callbacks fired when a document passes validation. */
  private readonly _onDocumentValidated: DocumentValidatedCallback[] = [];

  /** Callbacks fired when a document fails validation. */
  private readonly _onDocumentFailed: DocumentFailedCallback[] = [];

  /** Running counter of all exchanges processed. */
  private _totalExchanges: number = 0;

  // ── Partner Management ──────────────────────────────────

  /**
   * Register a new trading partner.
   *
   * @param partner - The trading partner profile to register.
   */
  registerPartner(partner: TradingPartner): void {
    this._partners.set(partner.id, partner);
  }

  /**
   * Retrieve a trading partner by ID.
   *
   * @param partnerId - The partner ID.
   * @returns The trading partner, or `undefined` if not found.
   */
  getPartner(partnerId: string): TradingPartner | undefined {
    return this._partners.get(partnerId);
  }

  /**
   * Find a trading partner by their code (e.g. DUNS, GLN).
   *
   * @param code - The partner code to search for.
   * @returns The matching trading partner, or `undefined`.
   */
  getPartnerByCode(code: string): TradingPartner | undefined {
    for (const partner of this._partners.values()) {
      if (partner.code === code) {
        return partner;
      }
    }
    return undefined;
  }

  /**
   * Update the status of a trading partner.
   *
   * @param partnerId - The partner ID.
   * @param status    - The new partner status.
   * @throws If the partner is not found.
   */
  updatePartnerStatus(partnerId: string, status: PartnerStatus): void {
    const partner = this._partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`);
    }
    partner.status = status;
  }

  /**
   * Get all trading partners whose status is `'active'`.
   *
   * @returns An array of active trading partners.
   */
  getActivePartners(): TradingPartner[] {
    const result: TradingPartner[] = [];
    for (const partner of this._partners.values()) {
      if (partner.status === 'active') {
        result.push(partner);
      }
    }
    return result;
  }

  // ── Agreement Management ────────────────────────────────

  /**
   * Register a trading partner agreement (TPA).
   *
   * @param agreement - The agreement to register.
   */
  registerAgreement(agreement: TradingPartnerAgreement): void {
    this._agreements.set(agreement.id, agreement);
  }

  /**
   * Retrieve an agreement by ID.
   *
   * @param agreementId - The agreement ID.
   * @returns The agreement, or `undefined` if not found.
   */
  getAgreement(agreementId: string): TradingPartnerAgreement | undefined {
    return this._agreements.get(agreementId);
  }

  /**
   * Get all agreements that include a given partner.
   *
   * @param partnerId - The partner ID to filter by.
   * @returns An array of matching agreements.
   */
  getAgreementsByPartner(partnerId: string): TradingPartnerAgreement[] {
    const result: TradingPartnerAgreement[] = [];
    for (const agreement of this._agreements.values()) {
      if (agreement.partnerIds.includes(partnerId)) {
        result.push(agreement);
      }
    }
    return result;
  }

  /**
   * Get all agreements that are active and not yet expired.
   *
   * @returns An array of active, non-expired agreements.
   */
  getActiveAgreements(): TradingPartnerAgreement[] {
    const now = new Date().toISOString();
    const result: TradingPartnerAgreement[] = [];
    for (const agreement of this._agreements.values()) {
      if (!agreement.active) {
        continue;
      }
      if (agreement.expirationDate && agreement.expirationDate <= now) {
        continue;
      }
      result.push(agreement);
    }
    return result;
  }

  // ── Document Exchange ───────────────────────────────────

  /**
   * Send a document to a trading partner (outbound exchange).
   *
   * Creates a {@link B2BDocumentExchange} record, validates the
   * document against the agreement's rules, and fires the
   * appropriate callbacks.
   *
   * @param partnerId    - The target partner ID.
   * @param agreementId  - The governing agreement ID.
   * @param documentType - The document type code (e.g. `'850'`).
   * @param content      - The document content.
   * @param format       - The document format.
   * @param metadata     - Optional custom metadata.
   * @returns The created exchange record.
   * @throws If the partner or agreement is not found.
   */
  sendDocument(
    partnerId: string,
    agreementId: string,
    documentType: string,
    content: string,
    format: B2BDocumentFormat,
    metadata?: Record<string, any>,
  ): B2BDocumentExchange {
    const partner = this._partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`);
    }

    const agreement = this._agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    // Validate the document against the agreement's rules.
    const validation = this._validateDocument(content, agreement.validationRules);

    const exchange: B2BDocumentExchange = {
      id: generateId(),
      partnerId,
      agreementId,
      direction: 'outbound',
      documentType,
      format,
      content,
      status: validation.valid ? 'validated' : 'failed',
      validationErrors: validation.errors,
      exchangedAt: new Date().toISOString(),
      error: validation.valid ? undefined : validation.errors.join('; '),
      metadata: metadata ?? {},
    };

    this._exchanges.set(exchange.id, exchange);
    this._totalExchanges++;

    // Fire callbacks.
    if (validation.valid) {
      for (const cb of this._onDocumentValidated) {
        cb(exchange);
      }
      for (const cb of this._onDocumentSent) {
        cb(exchange);
      }
    } else {
      for (const cb of this._onDocumentFailed) {
        cb(exchange);
      }
    }

    return exchange;
  }

  /**
   * Receive a document from a trading partner (inbound exchange).
   *
   * Creates a {@link B2BDocumentExchange} record, validates the
   * document against the agreement's rules, and fires the
   * appropriate callbacks.
   *
   * @param partnerId    - The source partner ID.
   * @param agreementId  - The governing agreement ID.
   * @param documentType - The document type code (e.g. `'810'`).
   * @param content      - The document content.
   * @param format       - The document format.
   * @param metadata     - Optional custom metadata.
   * @returns The created exchange record.
   * @throws If the partner or agreement is not found.
   */
  receiveDocument(
    partnerId: string,
    agreementId: string,
    documentType: string,
    content: string,
    format: B2BDocumentFormat,
    metadata?: Record<string, any>,
  ): B2BDocumentExchange {
    const partner = this._partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`);
    }

    const agreement = this._agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    // Validate the document against the agreement's rules.
    const validation = this._validateDocument(content, agreement.validationRules);

    const exchange: B2BDocumentExchange = {
      id: generateId(),
      partnerId,
      agreementId,
      direction: 'inbound',
      documentType,
      format,
      content,
      status: validation.valid ? 'validated' : 'failed',
      validationErrors: validation.errors,
      exchangedAt: new Date().toISOString(),
      error: validation.valid ? undefined : validation.errors.join('; '),
      metadata: metadata ?? {},
    };

    this._exchanges.set(exchange.id, exchange);
    this._totalExchanges++;

    // Fire callbacks.
    if (validation.valid) {
      for (const cb of this._onDocumentValidated) {
        cb(exchange);
      }
      for (const cb of this._onDocumentReceived) {
        cb(exchange);
      }
    } else {
      for (const cb of this._onDocumentFailed) {
        cb(exchange);
      }
    }

    return exchange;
  }

  // ── Validation ──────────────────────────────────────────

  /**
   * Validate document content against a set of B2B validation rules.
   *
   * @param content - The document content string.
   * @param rules   - The validation rules to apply.
   * @returns A {@link ValidationResult} with `valid` flag and any errors.
   */
  private _validateDocument(
    content: string,
    rules: B2BValidationRule[],
  ): ValidationResult {
    const errors: string[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'schema': {
          // Schema validation: check that content is non-empty and,
          // if a schemaPattern is configured, that it matches.
          const schemaPattern = rule.config['schemaPattern'] as string | undefined;
          if (schemaPattern) {
            try {
              const regex = new RegExp(schemaPattern);
              if (!regex.test(content)) {
                errors.push(`Schema validation failed for rule "${rule.name}": content does not match schema pattern`);
              }
            } catch {
              errors.push(`Schema validation failed for rule "${rule.name}": invalid schema pattern`);
            }
          }
          break;
        }

        case 'field-required': {
          // Check that a required field / token is present in the content.
          const fieldName = rule.config['fieldName'] as string | undefined;
          if (fieldName && !content.includes(fieldName)) {
            errors.push(`Required field missing for rule "${rule.name}": "${fieldName}" not found`);
          }
          break;
        }

        case 'field-format': {
          // Validate that a field value matches a format pattern.
          const pattern = rule.config['pattern'] as string | undefined;
          if (pattern) {
            try {
              const regex = new RegExp(pattern);
              if (!regex.test(content)) {
                errors.push(`Field format validation failed for rule "${rule.name}": content does not match pattern`);
              }
            } catch {
              errors.push(`Field format validation failed for rule "${rule.name}": invalid pattern`);
            }
          }
          break;
        }

        case 'field-value': {
          // Validate that content contains an expected value.
          const expectedValue = rule.config['expectedValue'] as string | undefined;
          if (expectedValue && !content.includes(expectedValue)) {
            errors.push(`Field value validation failed for rule "${rule.name}": expected value "${expectedValue}" not found`);
          }
          break;
        }

        case 'custom': {
          // Custom validation: if a requiredLength is configured,
          // validate content length.
          const minLength = rule.config['minLength'] as number | undefined;
          const maxLength = rule.config['maxLength'] as number | undefined;
          if (minLength !== undefined && content.length < minLength) {
            errors.push(`Custom validation failed for rule "${rule.name}": content length ${content.length} is below minimum ${minLength}`);
          }
          if (maxLength !== undefined && content.length > maxLength) {
            errors.push(`Custom validation failed for rule "${rule.name}": content length ${content.length} exceeds maximum ${maxLength}`);
          }
          break;
        }

        default: {
          // Unknown rule type — skip silently.
          break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Exchange Queries ────────────────────────────────────

  /**
   * Retrieve a document exchange by ID.
   *
   * @param exchangeId - The exchange ID.
   * @returns The exchange record, or `undefined` if not found.
   */
  getExchange(exchangeId: string): B2BDocumentExchange | undefined {
    return this._exchanges.get(exchangeId);
  }

  /**
   * Get document exchanges for a given partner, optionally
   * limited to the most recent N records.
   *
   * @param partnerId - The partner ID to filter by.
   * @param limit     - Optional maximum number of results.
   * @returns An array of matching exchange records.
   */
  getExchangesByPartner(
    partnerId: string,
    limit?: number,
  ): B2BDocumentExchange[] {
    const result: B2BDocumentExchange[] = [];
    for (const exchange of this._exchanges.values()) {
      if (exchange.partnerId === partnerId) {
        result.push(exchange);
      }
    }
    // Sort descending by exchange time so most recent come first.
    result.sort((a, b) => (b.exchangedAt > a.exchangedAt ? 1 : -1));
    if (limit !== undefined && limit > 0) {
      return result.slice(0, limit);
    }
    return result;
  }

  /**
   * Get document exchanges filtered by status.
   *
   * @param status - The exchange status to filter by.
   * @returns An array of matching exchange records.
   */
  getExchangesByStatus(
    status: B2BDocumentExchange['status'],
  ): B2BDocumentExchange[] {
    const result: B2BDocumentExchange[] = [];
    for (const exchange of this._exchanges.values()) {
      if (exchange.status === status) {
        result.push(exchange);
      }
    }
    return result;
  }

  /**
   * Acknowledge a document exchange, setting its status to
   * `'acknowledged'` and recording the acknowledgement time.
   *
   * @param exchangeId - The exchange ID to acknowledge.
   * @throws If the exchange is not found.
   */
  acknowledgeExchange(exchangeId: string): void {
    const exchange = this._exchanges.get(exchangeId);
    if (!exchange) {
      throw new Error(`Exchange not found: ${exchangeId}`);
    }
    exchange.status = 'acknowledged';
    exchange.acknowledgedAt = new Date().toISOString();
  }

  // ── Event Callbacks ─────────────────────────────────────

  /**
   * Register a callback that fires when a document is sent.
   *
   * @param cb - The callback function.
   */
  onDocumentSent(cb: DocumentSentCallback): void {
    this._onDocumentSent.push(cb);
  }

  /**
   * Register a callback that fires when a document is received.
   *
   * @param cb - The callback function.
   */
  onDocumentReceived(cb: DocumentReceivedCallback): void {
    this._onDocumentReceived.push(cb);
  }

  /**
   * Register a callback that fires when a document passes validation.
   *
   * @param cb - The callback function.
   */
  onDocumentValidated(cb: DocumentValidatedCallback): void {
    this._onDocumentValidated.push(cb);
  }

  /**
   * Register a callback that fires when a document fails validation.
   *
   * @param cb - The callback function.
   */
  onDocumentFailed(cb: DocumentFailedCallback): void {
    this._onDocumentFailed.push(cb);
  }

  // ── Computed Properties ─────────────────────────────────

  /** Total number of registered trading partners. */
  get partnerCount(): number {
    return this._partners.size;
  }

  /** Number of trading partners with `'active'` status. */
  get activePartnerCount(): number {
    let count = 0;
    for (const partner of this._partners.values()) {
      if (partner.status === 'active') {
        count++;
      }
    }
    return count;
  }

  /** Total number of registered agreements. */
  get agreementCount(): number {
    return this._agreements.size;
  }

  /** Number of active, non-expired agreements. */
  get activeAgreementCount(): number {
    return this.getActiveAgreements().length;
  }

  /** Total number of document exchanges processed. */
  get exchangeCount(): number {
    return this._totalExchanges;
  }
}
