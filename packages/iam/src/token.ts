// ============================================================
// SOA One IAM — Token Service
// ============================================================
//
// Provides comprehensive token lifecycle management including
// issuance, validation, revocation, exchange (RFC 8693), and
// cleanup for all OAuth 2.0 / OIDC token types.
//
// Features:
// - JWT-style token issuance (simulated, base64-encoded JSON)
// - Access, refresh, ID, authorization code, API key, PAT tokens
// - Token validation and introspection
// - Token exchange per RFC 8693
// - Revocation (single, by identity, by client)
// - Automatic expired-token cleanup
// - Event callbacks for token lifecycle
// - Configurable signing parameters
//
// Zero external dependencies. All in-memory.
// ============================================================

import type {
  TokenType,
  TokenStatus,
  TokenRecord,
  TokenIssuanceRequest,
  TokenValidationResult,
  TokenExchangeRequest,
  TokenExchangeResult,
  JWTSigningConfig,
} from './types';

// ── Utilities ────────────────────────────────────────────────

/** Generate a unique ID. */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 6);
  return `${ts}-${rand}-${rand2}`;
}

/** Generate a fingerprint for a token value. */
export function generateFingerprint(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ── Simulated JWT helpers ───────────────────────────────────

/** Base64url alphabet. */
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Encode a JSON object to a base64url string (zero dependencies). */
function base64UrlEncode(obj: Record<string, any>): string {
  const bytes: number[] = [];
  const str = JSON.stringify(obj);
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }

  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    result += B64URL[b0 >> 2];
    result += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) {
      result += B64URL[((b1 & 0xf) << 2) | (b2 >> 6)];
    }
    if (i + 2 < bytes.length) {
      result += B64URL[b2 & 0x3f];
    }
  }

  return result;
}

/** Build a simulated JWT string (header.payload.signature). */
function buildSimulatedJwt(
  header: Record<string, any>,
  payload: Record<string, any>,
): string {
  const h = base64UrlEncode(header);
  const p = base64UrlEncode(payload);
  // Simulated signature — not cryptographically valid
  const sig = base64UrlEncode({ sig: 'simulated', ts: Date.now() });
  return `${h}.${p}.${sig}`;
}

// ── Default TTL constants ───────────────────────────────────

const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const DEFAULT_ID_TOKEN_TTL_SECONDS = 3600;           // 1 hour
const DEFAULT_AUTH_CODE_TTL_SECONDS = 600;            // 10 minutes
const DEFAULT_API_KEY_TTL_SECONDS = 365 * 24 * 3600;  // 1 year
const DEFAULT_PAT_TTL_DAYS = 90;

// ── Token Service ───────────────────────────────────────────

/**
 * Comprehensive token lifecycle service supporting issuance,
 * validation, revocation, exchange, and cleanup for all
 * OAuth 2.0 / OIDC token types.
 */
export class TokenService {
  private readonly _tokens: Map<string, TokenRecord> = new Map();
  private readonly _revocationList: Map<string, string> = new Map(); // tokenId -> revokedAt
  private _signingConfig: JWTSigningConfig;

  private _totalIssued = 0;
  private _totalRevoked = 0;

  // ── Event callbacks ─────────────────────────────────────

  /** Called after a token is issued. */
  onTokenIssued?: (token: TokenRecord) => void;

  /** Called after a token is revoked. */
  onTokenRevoked?: (tokenId: string) => void;

  /** Called after an access token is refreshed. */
  onTokenRefreshed?: (oldTokenId: string, newToken: TokenRecord) => void;

  // ── Constructor ─────────────────────────────────────────

  constructor(config?: Partial<JWTSigningConfig>) {
    this._signingConfig = {
      algorithm: config?.algorithm ?? 'RS256',
      keyId: config?.keyId ?? 'default-key-1',
      issuer: config?.issuer ?? 'soa-one-iam',
      defaultTtlSeconds: config?.defaultTtlSeconds ?? 3600,
      ...(config?.audience ? { audience: config.audience } : {}),
    };
  }

  // ── Getters ─────────────────────────────────────────────

  /** Total number of tokens ever issued. */
  get totalTokensIssued(): number {
    return this._totalIssued;
  }

  /** Total number of tokens ever revoked. */
  get totalTokensRevoked(): number {
    return this._totalRevoked;
  }

  /** Number of currently active tokens. */
  get activeTokenCount(): number {
    let count = 0;
    const now = new Date().toISOString();
    for (const token of this._tokens.values()) {
      if (token.status === 'active' && token.expiresAt > now) {
        count++;
      }
    }
    return count;
  }

  // ── Token Issuance ──────────────────────────────────────

  /** Issue a token from a generic issuance request. */
  issueToken(request: TokenIssuanceRequest): TokenRecord {
    const id = generateId();
    const now = new Date();
    const ttl = request.ttlSeconds ?? this._signingConfig.defaultTtlSeconds;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const jwtHeader = {
      alg: this._signingConfig.algorithm,
      typ: 'JWT',
      kid: this._signingConfig.keyId,
    };

    const jwtPayload: Record<string, any> = {
      jti: id,
      iss: this._signingConfig.issuer,
      sub: request.identityId,
      aud: request.audience ?? this._signingConfig.audience,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      scope: request.scope,
      ...(request.claims ?? {}),
    };

    if (request.clientId) {
      jwtPayload.azp = request.clientId;
    }

    const tokenValue = buildSimulatedJwt(jwtHeader, jwtPayload);
    const fingerprint = generateFingerprint(tokenValue);

    const record: TokenRecord = {
      id,
      type: request.type,
      status: 'active',
      identityId: request.identityId,
      clientId: request.clientId,
      scope: request.scope,
      audience: request.audience ?? this._signingConfig.audience,
      issuer: this._signingConfig.issuer,
      claims: {
        ...request.claims,
        _jwt: tokenValue,
        ...(request.bindToSession ? { sid: request.bindToSession } : {}),
      },
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      fingerprint,
    };

    this._tokens.set(id, record);
    this._totalIssued++;
    this.onTokenIssued?.(record);

    return record;
  }

  /** Issue an access token. */
  issueAccessToken(
    identityId: string,
    scope?: string[],
    claims?: Record<string, any>,
    ttlSeconds?: number,
  ): TokenRecord {
    return this.issueToken({
      type: 'access',
      identityId,
      scope,
      claims,
      ttlSeconds: ttlSeconds ?? this._signingConfig.defaultTtlSeconds,
    });
  }

  /** Issue a refresh token linked to an access token. */
  issueRefreshToken(
    identityId: string,
    accessTokenId: string,
    scope?: string[],
  ): TokenRecord {
    const record = this.issueToken({
      type: 'refresh',
      identityId,
      scope,
      claims: { access_token_id: accessTokenId },
      ttlSeconds: DEFAULT_REFRESH_TTL_SECONDS,
    });

    // Link to parent access token
    const stored = this._tokens.get(record.id)!;
    stored.parentTokenId = accessTokenId;
    return stored;
  }

  /** Issue an ID token (OIDC). */
  issueIdToken(
    identityId: string,
    clientId: string,
    claims?: Record<string, any>,
  ): TokenRecord {
    return this.issueToken({
      type: 'id',
      identityId,
      clientId,
      claims: {
        ...claims,
        auth_time: Math.floor(Date.now() / 1000),
        nonce: claims?.nonce,
      },
      ttlSeconds: DEFAULT_ID_TOKEN_TTL_SECONDS,
    });
  }

  /** Issue an authorization code. */
  issueAuthorizationCode(
    identityId: string,
    clientId: string,
    redirectUri: string,
    scope?: string[],
    codeChallenge?: string,
  ): TokenRecord {
    return this.issueToken({
      type: 'authorization-code',
      identityId,
      clientId,
      scope,
      claims: {
        redirect_uri: redirectUri,
        ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
      },
      ttlSeconds: DEFAULT_AUTH_CODE_TTL_SECONDS,
    });
  }

  /** Issue an API key. */
  issueAPIKey(
    identityId: string,
    name: string,
    scope?: string[],
  ): TokenRecord {
    return this.issueToken({
      type: 'api-key',
      identityId,
      scope,
      claims: {
        key_name: name,
        key_prefix: `ak_${generateId().substring(0, 8)}`,
      },
      ttlSeconds: DEFAULT_API_KEY_TTL_SECONDS,
    });
  }

  /** Issue a personal access token (PAT). */
  issuePersonalAccessToken(
    identityId: string,
    name: string,
    scope?: string[],
    ttlDays?: number,
  ): TokenRecord {
    const days = ttlDays ?? DEFAULT_PAT_TTL_DAYS;
    return this.issueToken({
      type: 'personal-access-token',
      identityId,
      scope,
      claims: {
        pat_name: name,
        pat_prefix: `pat_${generateId().substring(0, 8)}`,
      },
      ttlSeconds: days * 24 * 3600,
    });
  }

  // ── Token Validation ────────────────────────────────────

  /** Validate a token by its ID. */
  validateToken(tokenId: string): TokenValidationResult {
    const token = this._tokens.get(tokenId);

    if (!token) {
      return {
        valid: false,
        expired: false,
        revoked: false,
        error: 'Token not found',
      };
    }

    const now = new Date().toISOString();
    const expired = token.expiresAt <= now;
    const revoked = token.status === 'revoked' || this._revocationList.has(tokenId);
    const consumed = token.status === 'consumed';

    if (expired) {
      return {
        valid: false,
        expired: true,
        revoked,
        claims: token.claims,
        identityId: token.identityId,
        scope: token.scope,
        error: 'Token has expired',
      };
    }

    if (revoked) {
      return {
        valid: false,
        expired: false,
        revoked: true,
        claims: token.claims,
        identityId: token.identityId,
        scope: token.scope,
        error: 'Token has been revoked',
      };
    }

    if (consumed) {
      return {
        valid: false,
        expired: false,
        revoked: false,
        claims: token.claims,
        identityId: token.identityId,
        scope: token.scope,
        error: 'Token has already been consumed',
      };
    }

    // Check notBefore if set
    if (token.notBefore && token.notBefore > now) {
      return {
        valid: false,
        expired: false,
        revoked: false,
        claims: token.claims,
        identityId: token.identityId,
        scope: token.scope,
        error: 'Token is not yet valid',
      };
    }

    return {
      valid: true,
      expired: false,
      revoked: false,
      claims: token.claims,
      identityId: token.identityId,
      scope: token.scope,
    };
  }

  /** Validate a token by its fingerprint. */
  validateTokenByFingerprint(fingerprint: string): TokenValidationResult {
    for (const token of this._tokens.values()) {
      if (token.fingerprint === fingerprint) {
        return this.validateToken(token.id);
      }
    }
    return {
      valid: false,
      expired: false,
      revoked: false,
      error: 'Token not found by fingerprint',
    };
  }

  /** Introspect a token — returns the full record or undefined. */
  introspectToken(tokenId: string): TokenRecord | undefined {
    return this._tokens.get(tokenId);
  }

  // ── Token Lifecycle ─────────────────────────────────────

  /** Revoke a single token. */
  revokeToken(tokenId: string): void {
    const token = this._tokens.get(tokenId);
    if (!token) return;

    token.status = 'revoked';
    token.revokedAt = new Date().toISOString();
    this._revocationList.set(tokenId, token.revokedAt);
    this._totalRevoked++;
    this.onTokenRevoked?.(tokenId);
  }

  /** Revoke all tokens for a given identity. Returns the count revoked. */
  revokeAllTokens(identityId: string): number {
    let count = 0;
    for (const token of this._tokens.values()) {
      if (token.identityId === identityId && token.status === 'active') {
        token.status = 'revoked';
        token.revokedAt = new Date().toISOString();
        this._revocationList.set(token.id, token.revokedAt);
        this._totalRevoked++;
        this.onTokenRevoked?.(token.id);
        count++;
      }
    }
    return count;
  }

  /** Revoke all tokens issued to a specific client. Returns the count revoked. */
  revokeByClient(clientId: string): number {
    let count = 0;
    for (const token of this._tokens.values()) {
      if (token.clientId === clientId && token.status === 'active') {
        token.status = 'revoked';
        token.revokedAt = new Date().toISOString();
        this._revocationList.set(token.id, token.revokedAt);
        this._totalRevoked++;
        this.onTokenRevoked?.(token.id);
        count++;
      }
    }
    return count;
  }

  /** Refresh an access token using a refresh token. */
  refreshAccessToken(refreshTokenId: string): TokenRecord {
    const refreshToken = this._tokens.get(refreshTokenId);

    if (!refreshToken) {
      throw new TokenError('Refresh token not found');
    }

    if (refreshToken.type !== 'refresh') {
      throw new TokenError('Provided token is not a refresh token');
    }

    const validation = this.validateToken(refreshTokenId);
    if (!validation.valid) {
      throw new TokenError(`Refresh token is invalid: ${validation.error}`);
    }

    // Revoke the old access token if it still exists
    const oldAccessTokenId = refreshToken.parentTokenId ?? refreshToken.claims?.access_token_id;
    if (oldAccessTokenId) {
      const oldAccess = this._tokens.get(oldAccessTokenId);
      if (oldAccess && oldAccess.status === 'active') {
        this.revokeToken(oldAccessTokenId);
      }
    }

    // Issue a new access token with the same scope and identity
    const newAccessToken = this.issueAccessToken(
      refreshToken.identityId!,
      refreshToken.scope,
      undefined,
      this._signingConfig.defaultTtlSeconds,
    );

    // Update the refresh token to point to the new access token
    refreshToken.claims = {
      ...refreshToken.claims,
      access_token_id: newAccessToken.id,
    };
    refreshToken.parentTokenId = newAccessToken.id;

    this.onTokenRefreshed?.(oldAccessTokenId ?? refreshTokenId, newAccessToken);

    return newAccessToken;
  }

  /** Consume a token (mark as consumed). Used for authorization codes. */
  consumeToken(tokenId: string): void {
    const token = this._tokens.get(tokenId);
    if (!token) {
      throw new TokenError('Token not found');
    }
    if (token.status !== 'active') {
      throw new TokenError(`Cannot consume token with status "${token.status}"`);
    }
    token.status = 'consumed';
  }

  // ── Token Exchange (RFC 8693) ───────────────────────────

  /** Exchange a token per RFC 8693 token exchange. */
  exchangeToken(request: TokenExchangeRequest): TokenExchangeResult {
    // Validate the subject token
    const subjectToken = this._findTokenByJwtOrId(request.subjectToken);
    if (!subjectToken) {
      throw new TokenError('Subject token not found or invalid');
    }

    const subjectValidation = this.validateToken(subjectToken.id);
    if (!subjectValidation.valid) {
      throw new TokenError(`Subject token is invalid: ${subjectValidation.error}`);
    }

    // Validate actor token if provided
    let actorClaims: Record<string, any> | undefined;
    if (request.actorToken) {
      const actorToken = this._findTokenByJwtOrId(request.actorToken);
      if (!actorToken) {
        throw new TokenError('Actor token not found or invalid');
      }
      const actorValidation = this.validateToken(actorToken.id);
      if (!actorValidation.valid) {
        throw new TokenError(`Actor token is invalid: ${actorValidation.error}`);
      }
      actorClaims = {
        act: {
          sub: actorToken.identityId,
        },
      };
    }

    // Determine scope: use requested scope or fall back to subject token scope
    const scope = request.scope ?? subjectToken.scope;

    // Determine the issued token type
    const requestedType = request.requestedTokenType ?? 'urn:ietf:params:oauth:token-type:access_token';
    const tokenType = this._mapTokenTypeUri(requestedType);

    // Issue the exchanged token
    const newToken = this.issueToken({
      type: tokenType,
      identityId: subjectToken.identityId,
      scope,
      audience: request.audience,
      claims: {
        ...(actorClaims ?? {}),
        ...(request.resource ? { resource: request.resource } : {}),
        exchanged_from: subjectToken.id,
        subject_token_type: request.subjectTokenType,
      },
    });

    const result: TokenExchangeResult = {
      accessToken: newToken.claims._jwt ?? newToken.id,
      issuedTokenType: requestedType,
      tokenType: 'Bearer',
      expiresIn: this._signingConfig.defaultTtlSeconds,
      scope,
    };

    // Include a refresh token if an access token was exchanged
    if (tokenType === 'access' && subjectToken.identityId) {
      const refreshToken = this.issueRefreshToken(
        subjectToken.identityId,
        newToken.id,
        scope,
      );
      result.refreshToken = refreshToken.claims._jwt ?? refreshToken.id;
    }

    return result;
  }

  // ── Cleanup ─────────────────────────────────────────────

  /** Remove expired tokens from the store. Returns the count cleaned up. */
  cleanupExpiredTokens(): number {
    const now = new Date().toISOString();
    let count = 0;
    for (const [id, token] of this._tokens) {
      if (token.expiresAt <= now && token.status === 'active') {
        token.status = 'expired';
        count++;
      }
    }
    return count;
  }

  // ── Query ───────────────────────────────────────────────

  /** Get all tokens for a given identity. */
  getTokensByIdentity(identityId: string): TokenRecord[] {
    const result: TokenRecord[] = [];
    for (const token of this._tokens.values()) {
      if (token.identityId === identityId) {
        result.push(token);
      }
    }
    return result;
  }

  /** Get only active, non-expired tokens for a given identity. */
  getActiveTokensByIdentity(identityId: string): TokenRecord[] {
    const now = new Date().toISOString();
    const result: TokenRecord[] = [];
    for (const token of this._tokens.values()) {
      if (
        token.identityId === identityId &&
        token.status === 'active' &&
        token.expiresAt > now
      ) {
        result.push(token);
      }
    }
    return result;
  }

  /** Get all tokens issued to a specific client. */
  getTokensByClient(clientId: string): TokenRecord[] {
    const result: TokenRecord[] = [];
    for (const token of this._tokens.values()) {
      if (token.clientId === clientId) {
        result.push(token);
      }
    }
    return result;
  }

  // ── Configuration ───────────────────────────────────────

  /** Update the signing configuration. */
  updateSigningConfig(config: Partial<JWTSigningConfig>): void {
    this._signingConfig = {
      ...this._signingConfig,
      ...config,
    };
  }

  /** Get the current signing configuration. */
  getSigningConfig(): JWTSigningConfig {
    return { ...this._signingConfig };
  }

  // ── Private helpers ─────────────────────────────────────

  /** Find a token by its JWT string or by ID. */
  private _findTokenByJwtOrId(tokenRef: string): TokenRecord | undefined {
    // First try direct ID lookup
    const direct = this._tokens.get(tokenRef);
    if (direct) return direct;

    // Try to find by fingerprint of the value
    const fp = generateFingerprint(tokenRef);
    for (const token of this._tokens.values()) {
      if (token.fingerprint === fp) {
        return token;
      }
    }

    // Try to find by matching the JWT in claims
    for (const token of this._tokens.values()) {
      if (token.claims?._jwt === tokenRef) {
        return token;
      }
    }

    return undefined;
  }

  /** Map an RFC 8693 token type URI to an internal TokenType. */
  private _mapTokenTypeUri(uri: string): TokenType {
    switch (uri) {
      case 'urn:ietf:params:oauth:token-type:access_token':
        return 'access';
      case 'urn:ietf:params:oauth:token-type:refresh_token':
        return 'refresh';
      case 'urn:ietf:params:oauth:token-type:id_token':
        return 'id';
      case 'urn:ietf:params:oauth:token-type:saml2':
        return 'saml-assertion';
      default:
        return 'access';
    }
  }
}

// ── Errors ──────────────────────────────────────────────────

/** Error thrown by token operations. */
export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}
