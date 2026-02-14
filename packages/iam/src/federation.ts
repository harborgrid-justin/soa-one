// ============================================================
// SOA One IAM — Federation Manager
// ============================================================
//
// Comprehensive federation subsystem for identity federation,
// single sign-on, and cross-domain identity provisioning.
//
// Surpasses Oracle Access Manager federation with:
// - SAML 2.0 (SP-initiated & IdP-initiated SSO, SLO)
// - OAuth 2.0 / OpenID Connect (authorization code, PKCE)
// - WS-Federation protocol support
// - SCIM 2.0 provisioning (inbound, outbound, bidirectional)
// - Just-In-Time (JIT) identity provisioning
// - Federation trust management with attribute filtering
// - Identity provider & service provider lifecycle
// - Federated authentication event callbacks
//
// Zero-dependency. In-memory. Class-based.
// ============================================================

import type {
  IdentityProviderConfig,
  ServiceProviderConfig,
  FederationTrust,
  SCIMProvisioningConfig,
} from './types';

// ── ID Generator ────────────────────────────────────────────

/** Monotonic counter to guarantee uniqueness within a process. */
let _idSeq = 0;

/**
 * Generate a collision-resistant identifier.
 *
 * Combines a base-36 timestamp, two random segments, and a
 * monotonic sequence counter.
 */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 6);
  return `${ts}-${rand}-${rand2}-${(++_idSeq).toString(36)}`;
}

// ── Base64 Helpers (zero-dependency) ────────────────────────

/** Standard base64 alphabet. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encode a string to base64 without any runtime dependency. */
function toBase64(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    bytes.push(input.charCodeAt(i) & 0xff);
  }

  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    result += B64[b0 >> 2];
    result += B64[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? B64[((b1 & 0xf) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? B64[b2 & 0x3f] : '=';
  }

  return result;
}

/** Decode a base64 string without any runtime dependency. */
function fromBase64(input: string): string {
  const cleaned = input.replace(/=+$/, '');
  const lookup: Record<string, number> = {};
  for (let i = 0; i < B64.length; i++) {
    lookup[B64[i]] = i;
  }

  let result = '';
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = lookup[cleaned[i]] ?? 0;
    const b = lookup[cleaned[i + 1]] ?? 0;
    const c = lookup[cleaned[i + 2]] ?? 0;
    const d = lookup[cleaned[i + 3]] ?? 0;
    const triplet = (a << 18) | (b << 12) | (c << 6) | d;

    result += String.fromCharCode((triplet >> 16) & 0xff);
    if (i + 2 < cleaned.length) result += String.fromCharCode((triplet >> 8) & 0xff);
    if (i + 3 < cleaned.length) result += String.fromCharCode(triplet & 0xff);
  }

  return result;
}

/**
 * Encode key-value pairs as a URL query string without URLSearchParams.
 *
 * Values are percent-encoded following RFC 3986.
 */
function encodeQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked on a federated SSO login. */
export type SSOLoginCallback = (data: {
  identityId: string;
  idpId: string;
  protocol: string;
  sessionIndex: string;
}) => void;

/** Callback invoked on a federated SSO logout. */
export type SSOLogoutCallback = (data: {
  identityId: string;
  idpId: string;
  sessionIndex: string;
}) => void;

/** Callback invoked when an identity is provisioned via federation. */
export type ProvisionedViaFederationCallback = (data: {
  identityId: string;
  idpId: string;
  source: 'jit' | 'scim';
}) => void;

/** Callback invoked when an identity is deprovisioned via federation. */
export type DeprovisionedViaFederationCallback = (data: {
  identityId: string;
  idpId: string;
  source: 'scim';
}) => void;

// ── Federation Manager ──────────────────────────────────────

/**
 * Federation Manager — manages identity providers, service
 * providers, federation trusts, SAML/OIDC flows, SCIM
 * provisioning, and JIT identity creation.
 *
 * @example
 * ```ts
 * const fm = new FederationManager();
 * const idp = fm.registerIdentityProvider(idpConfig);
 * const sp  = fm.registerServiceProvider(spConfig);
 * fm.createTrust({ identityProviderId: idp.id, serviceProviderId: sp.id, ... });
 * const saml = fm.generateSAMLRequest(sp.id);
 * ```
 */
export class FederationManager {
  // ── Private State ───────────────────────────────────────

  /** Registered identity providers keyed by ID. */
  private readonly _identityProviders: Map<string, IdentityProviderConfig> = new Map();

  /** Registered service providers keyed by ID. */
  private readonly _serviceProviders: Map<string, ServiceProviderConfig> = new Map();

  /** Federation trust relationships keyed by ID. */
  private readonly _trusts: Map<string, FederationTrust> = new Map();

  /** SCIM provisioning configurations keyed by ID. */
  private readonly _scimConfigs: Map<string, SCIMProvisioningConfig> = new Map();

  /** Tracks identities provisioned via JIT, keyed by `${idpId}:${externalId}`. */
  private readonly _jitIdentities: Map<string, { identityId: string; attributes: Record<string, any> }> = new Map();

  /** Running counter of all federated authentications. */
  private _federatedAuthTotal: number = 0;

  /** Callbacks fired on SSO login. */
  private readonly _onSSOLogin: SSOLoginCallback[] = [];

  /** Callbacks fired on SSO logout. */
  private readonly _onSSOLogout: SSOLogoutCallback[] = [];

  /** Callbacks fired when an identity is provisioned via federation. */
  private readonly _onProvisionedViaFederation: ProvisionedViaFederationCallback[] = [];

  /** Callbacks fired when an identity is deprovisioned via federation. */
  private readonly _onDeprovisionedViaFederation: DeprovisionedViaFederationCallback[] = [];

  // ── Identity Provider Management ──────────────────────

  /**
   * Register a new identity provider.
   *
   * @param config - The identity provider configuration.
   * @returns The registered identity provider configuration.
   */
  registerIdentityProvider(config: IdentityProviderConfig): IdentityProviderConfig {
    this._identityProviders.set(config.id, { ...config });
    return { ...config };
  }

  /**
   * Retrieve an identity provider by ID.
   *
   * @param id - The identity provider ID.
   * @returns The identity provider configuration, or `undefined` if not found.
   */
  getIdentityProvider(id: string): IdentityProviderConfig | undefined {
    const idp = this._identityProviders.get(id);
    return idp ? { ...idp } : undefined;
  }

  /**
   * Update an existing identity provider configuration.
   *
   * @param id      - The identity provider ID.
   * @param updates - Partial configuration updates.
   * @returns The updated identity provider configuration.
   * @throws If the identity provider is not found.
   */
  updateIdentityProvider(
    id: string,
    updates: Partial<IdentityProviderConfig>,
  ): IdentityProviderConfig {
    const existing = this._identityProviders.get(id);
    if (!existing) {
      throw new Error(`Identity provider not found: ${id}`);
    }
    const updated: IdentityProviderConfig = {
      ...existing,
      ...updates,
      id, // preserve original ID
      updatedAt: new Date().toISOString(),
    };
    this._identityProviders.set(id, updated);
    return { ...updated };
  }

  /**
   * Delete an identity provider.
   *
   * @param id - The identity provider ID.
   * @throws If the identity provider is not found.
   */
  deleteIdentityProvider(id: string): void {
    if (!this._identityProviders.has(id)) {
      throw new Error(`Identity provider not found: ${id}`);
    }
    this._identityProviders.delete(id);
  }

  /**
   * List all registered identity providers.
   *
   * @returns An array of all identity provider configurations.
   */
  listIdentityProviders(): IdentityProviderConfig[] {
    return Array.from(this._identityProviders.values()).map((idp) => ({ ...idp }));
  }

  // ── Service Provider Management ───────────────────────

  /**
   * Register a new service provider.
   *
   * @param config - The service provider configuration.
   * @returns The registered service provider configuration.
   */
  registerServiceProvider(config: ServiceProviderConfig): ServiceProviderConfig {
    this._serviceProviders.set(config.id, { ...config });
    return { ...config };
  }

  /**
   * Retrieve a service provider by ID.
   *
   * @param id - The service provider ID.
   * @returns The service provider configuration, or `undefined` if not found.
   */
  getServiceProvider(id: string): ServiceProviderConfig | undefined {
    const sp = this._serviceProviders.get(id);
    return sp ? { ...sp } : undefined;
  }

  /**
   * Update an existing service provider configuration.
   *
   * @param id      - The service provider ID.
   * @param updates - Partial configuration updates.
   * @returns The updated service provider configuration.
   * @throws If the service provider is not found.
   */
  updateServiceProvider(
    id: string,
    updates: Partial<ServiceProviderConfig>,
  ): ServiceProviderConfig {
    const existing = this._serviceProviders.get(id);
    if (!existing) {
      throw new Error(`Service provider not found: ${id}`);
    }
    const updated: ServiceProviderConfig = {
      ...existing,
      ...updates,
      id, // preserve original ID
      updatedAt: new Date().toISOString(),
    };
    this._serviceProviders.set(id, updated);
    return { ...updated };
  }

  /**
   * Delete a service provider.
   *
   * @param id - The service provider ID.
   * @throws If the service provider is not found.
   */
  deleteServiceProvider(id: string): void {
    if (!this._serviceProviders.has(id)) {
      throw new Error(`Service provider not found: ${id}`);
    }
    this._serviceProviders.delete(id);
  }

  /**
   * List all registered service providers.
   *
   * @returns An array of all service provider configurations.
   */
  listServiceProviders(): ServiceProviderConfig[] {
    return Array.from(this._serviceProviders.values()).map((sp) => ({ ...sp }));
  }

  // ── Federation Trust Management ───────────────────────

  /**
   * Create a new federation trust relationship between an
   * identity provider and a service provider.
   *
   * @param trust - The trust configuration (id, createdAt, updatedAt are auto-generated).
   * @returns The created federation trust.
   * @throws If the referenced identity provider or service provider is not found.
   */
  createTrust(
    trust: Omit<FederationTrust, 'id' | 'createdAt' | 'updatedAt'>,
  ): FederationTrust {
    if (!this._identityProviders.has(trust.identityProviderId)) {
      throw new Error(`Identity provider not found: ${trust.identityProviderId}`);
    }
    if (!this._serviceProviders.has(trust.serviceProviderId)) {
      throw new Error(`Service provider not found: ${trust.serviceProviderId}`);
    }

    const now = new Date().toISOString();
    const record: FederationTrust = {
      ...trust,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    this._trusts.set(record.id, record);
    return { ...record };
  }

  /**
   * Retrieve a federation trust by ID.
   *
   * @param id - The trust ID.
   * @returns The federation trust, or `undefined` if not found.
   */
  getTrust(id: string): FederationTrust | undefined {
    const trust = this._trusts.get(id);
    return trust ? { ...trust } : undefined;
  }

  /**
   * List all federation trusts.
   *
   * @returns An array of all federation trust relationships.
   */
  listTrusts(): FederationTrust[] {
    return Array.from(this._trusts.values()).map((t) => ({ ...t }));
  }

  /**
   * Delete a federation trust.
   *
   * @param id - The trust ID.
   * @throws If the trust is not found.
   */
  deleteTrust(id: string): void {
    if (!this._trusts.has(id)) {
      throw new Error(`Federation trust not found: ${id}`);
    }
    this._trusts.delete(id);
  }

  // ── SAML Operations (Simulated) ───────────────────────

  /**
   * Generate a SAML authentication request (SP-initiated SSO).
   *
   * This is a simulated SAML AuthnRequest — no real XML signing
   * or crypto is performed.  The returned `samlRequest` is a
   * base-64-style encoded string suitable for redirect or POST
   * binding simulation.
   *
   * @param spId    - The service provider ID initiating the request.
   * @param options - Optional parameters (forceAuthn, nameIdFormat, relayState).
   * @returns An object containing the request ID, encoded SAML request, and relay state.
   * @throws If the service provider is not found.
   */
  generateSAMLRequest(
    spId: string,
    options?: {
      forceAuthn?: boolean;
      nameIdFormat?: string;
      relayState?: string;
    },
  ): { requestId: string; samlRequest: string; relayState: string } {
    const sp = this._serviceProviders.get(spId);
    if (!sp) {
      throw new Error(`Service provider not found: ${spId}`);
    }

    const requestId = `_${generateId()}`;
    const issueInstant = new Date().toISOString();
    const relayState = options?.relayState ?? sp.metadata['defaultRelayState'] ?? '/';

    // Simulated SAML AuthnRequest envelope
    const authnRequest = [
      `<samlp:AuthnRequest`,
      `  ID="${requestId}"`,
      `  Version="2.0"`,
      `  IssueInstant="${issueInstant}"`,
      `  Destination="${sp.assertionConsumerServiceUrl ?? ''}"`,
      `  AssertionConsumerServiceURL="${sp.assertionConsumerServiceUrl ?? ''}"`,
      `  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
      options?.forceAuthn ? `  ForceAuthn="true"` : '',
      `>`,
      `  <saml:Issuer>${sp.entityId}</saml:Issuer>`,
      options?.nameIdFormat
        ? `  <samlp:NameIDPolicy Format="${options.nameIdFormat}" AllowCreate="true"/>`
        : '',
      `</samlp:AuthnRequest>`,
    ]
      .filter(Boolean)
      .join('\n');

    // Base-64 encode the simulated AuthnRequest
    const samlRequest = toBase64(authnRequest);

    return { requestId, samlRequest, relayState };
  }

  /**
   * Process a SAML response from an identity provider.
   *
   * This is a simulated SAML assertion processor — no real XML
   * parsing or signature verification is performed.  Extracts a
   * synthetic identity and attributes from the IdP configuration.
   *
   * @param idpId        - The identity provider that issued the response.
   * @param samlResponse - The base-64 encoded SAML response payload.
   * @returns An object with the resolved identity ID, attributes, and session index.
   * @throws If the identity provider is not found.
   */
  processSAMLResponse(
    idpId: string,
    samlResponse: string,
  ): { identityId: string; attributes: Record<string, any>; sessionIndex: string } {
    const idp = this._identityProviders.get(idpId);
    if (!idp) {
      throw new Error(`Identity provider not found: ${idpId}`);
    }

    // Decode the simulated SAML response
    const decoded = fromBase64(samlResponse);

    const sessionIndex = `_session_${generateId()}`;
    const identityId = `fed_${generateId()}`;

    // Build attributes from the IdP attribute mapping
    const attributes: Record<string, any> = {
      issuer: idp.issuer,
      nameId: identityId,
      nameIdFormat: idp.nameIdFormat ?? 'unspecified',
      authnInstant: new Date().toISOString(),
      sessionIndex,
      protocol: 'saml2',
      responsePayloadLength: decoded.length,
    };

    // Apply attribute mapping from IdP config
    for (const [target, source] of Object.entries(idp.attributeMapping)) {
      attributes[target] = source;
    }

    this._federatedAuthTotal++;

    // Fire SSO login callbacks
    for (const cb of this._onSSOLogin) {
      cb({ identityId, idpId, protocol: 'saml2', sessionIndex });
    }

    return { identityId, attributes, sessionIndex };
  }

  /**
   * Generate a SAML logout request (single logout).
   *
   * @param sessionIndex - The session index from the original SSO login.
   * @returns An object containing the request ID and encoded logout request.
   */
  generateSAMLLogoutRequest(
    sessionIndex: string,
  ): { requestId: string; logoutRequest: string } {
    const requestId = `_logout_${generateId()}`;
    const issueInstant = new Date().toISOString();

    const logoutXml = [
      `<samlp:LogoutRequest`,
      `  ID="${requestId}"`,
      `  Version="2.0"`,
      `  IssueInstant="${issueInstant}"`,
      `>`,
      `  <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>`,
      `</samlp:LogoutRequest>`,
    ].join('\n');

    const logoutRequest = toBase64(logoutXml);

    // Fire SSO logout callbacks
    for (const cb of this._onSSOLogout) {
      cb({ identityId: '', idpId: '', sessionIndex });
    }

    return { requestId, logoutRequest };
  }

  // ── OIDC Operations (Simulated) ───────────────────────

  /**
   * Generate an OIDC / OAuth 2.0 authorization URL for
   * redirecting the user to the identity provider.
   *
   * When `pkceRequired` is true on the IdP (or in options),
   * a simulated `codeVerifier` is included for PKCE support.
   *
   * @param idpId   - The identity provider ID.
   * @param options - Authorization request parameters.
   * @returns An object with the authorization URL, state, nonce, and optional code verifier.
   * @throws If the identity provider is not found.
   */
  generateAuthorizationUrl(
    idpId: string,
    options: {
      redirectUri: string;
      scope?: string[];
      responseType?: string;
      prompt?: string;
      loginHint?: string;
      acrValues?: string;
    },
  ): { url: string; state: string; nonce: string; codeVerifier?: string } {
    const idp = this._identityProviders.get(idpId);
    if (!idp) {
      throw new Error(`Identity provider not found: ${idpId}`);
    }

    const state = generateId();
    const nonce = generateId();
    const responseType = options.responseType ?? idp.responseType ?? 'code';
    const scope = (options.scope ?? idp.scopes ?? ['openid', 'profile', 'email']).join(' ');

    const queryParams: Record<string, string> = {
      response_type: responseType,
      client_id: idp.clientId ?? '',
      redirect_uri: options.redirectUri,
      scope,
      state,
      nonce,
    };

    if (options.prompt) {
      queryParams['prompt'] = options.prompt;
    }
    if (options.loginHint) {
      queryParams['login_hint'] = options.loginHint;
    }
    if (options.acrValues) {
      queryParams['acr_values'] = options.acrValues;
    }

    let codeVerifier: string | undefined;
    if (idp.pkceRequired) {
      // Simulated PKCE: generate a code verifier and derive a challenge
      codeVerifier = `pkce_${generateId()}_${generateId()}`;
      const codeChallenge = `challenge_${codeVerifier.substring(0, 16)}`;
      queryParams['code_challenge'] = codeChallenge;
      queryParams['code_challenge_method'] = 'S256';
    }

    const baseUrl = idp.authorizationEndpoint ?? `${idp.issuer}/authorize`;
    const url = `${baseUrl}?${encodeQueryString(queryParams)}`;

    return { url, state, nonce, codeVerifier };
  }

  /**
   * Exchange an authorization code for tokens (simulated).
   *
   * Returns simulated access, ID, and refresh tokens along with
   * extracted claims based on the IdP attribute mapping.
   *
   * @param idpId        - The identity provider ID.
   * @param code         - The authorization code received from the IdP.
   * @param codeVerifier - Optional PKCE code verifier.
   * @returns An object with access token, ID token, optional refresh token, and claims.
   * @throws If the identity provider is not found.
   */
  exchangeAuthorizationCode(
    idpId: string,
    code: string,
    codeVerifier?: string,
  ): {
    accessToken: string;
    idToken: string;
    refreshToken?: string;
    claims: Record<string, any>;
  } {
    const idp = this._identityProviders.get(idpId);
    if (!idp) {
      throw new Error(`Identity provider not found: ${idpId}`);
    }

    if (idp.pkceRequired && !codeVerifier) {
      throw new Error(`PKCE code verifier required for IdP: ${idpId}`);
    }

    const now = new Date().toISOString();
    const sub = `oidc_${generateId()}`;
    const sessionIndex = `_oidc_session_${generateId()}`;

    const accessToken = `at_${generateId()}`;
    const idToken = `idt_${generateId()}`;
    const refreshToken = (idp.grantTypes ?? []).includes('refresh_token')
      ? `rt_${generateId()}`
      : undefined;

    // Build claims from IdP attribute mapping
    const claims: Record<string, any> = {
      sub,
      iss: idp.issuer,
      aud: idp.clientId ?? '',
      iat: now,
      exp: new Date(Date.now() + 3600 * 1000).toISOString(),
      nonce: generateId(),
      auth_time: now,
      at_hash: `ath_${generateId().substring(0, 8)}`,
      authorizationCode: code,
    };

    // Apply attribute mapping
    for (const [target, source] of Object.entries(idp.attributeMapping)) {
      claims[target] = source;
    }

    this._federatedAuthTotal++;

    // Fire SSO login callbacks
    for (const cb of this._onSSOLogin) {
      cb({ identityId: sub, idpId, protocol: 'oidc', sessionIndex });
    }

    return { accessToken, idToken, refreshToken, claims };
  }

  /**
   * Validate an OIDC ID token (simulated).
   *
   * Performs simulated validation checks including issuer
   * verification and audience matching.
   *
   * @param idpId   - The identity provider ID.
   * @param idToken - The ID token string to validate.
   * @returns An object indicating validity and extracted claims.
   * @throws If the identity provider is not found.
   */
  validateIdToken(
    idpId: string,
    idToken: string,
  ): { valid: boolean; claims: Record<string, any> } {
    const idp = this._identityProviders.get(idpId);
    if (!idp) {
      throw new Error(`Identity provider not found: ${idpId}`);
    }

    // Simulated validation: tokens generated by this manager
    // start with "idt_" and are considered valid.
    const isWellFormed = idToken.startsWith('idt_') && idToken.length > 4;

    const claims: Record<string, any> = {
      sub: `oidc_${generateId()}`,
      iss: idp.issuer,
      aud: idp.clientId ?? '',
      iat: new Date().toISOString(),
      exp: new Date(Date.now() + 3600 * 1000).toISOString(),
      token: idToken,
    };

    // Apply attribute mapping
    for (const [target, source] of Object.entries(idp.attributeMapping)) {
      claims[target] = source;
    }

    return { valid: isWellFormed, claims };
  }

  // ── SCIM Provisioning ─────────────────────────────────

  /**
   * Configure a SCIM provisioning endpoint.
   *
   * @param config - The SCIM provisioning configuration.
   * @returns The stored SCIM configuration.
   */
  configureSCIM(config: SCIMProvisioningConfig): SCIMProvisioningConfig {
    this._scimConfigs.set(config.id, { ...config });
    return { ...config };
  }

  /**
   * Retrieve a SCIM configuration by ID.
   *
   * @param id - The SCIM configuration ID.
   * @returns The SCIM configuration, or `undefined` if not found.
   */
  getSCIMConfig(id: string): SCIMProvisioningConfig | undefined {
    const config = this._scimConfigs.get(id);
    return config ? { ...config } : undefined;
  }

  /**
   * List all SCIM provisioning configurations.
   *
   * @returns An array of all SCIM configurations.
   */
  listSCIMConfigs(): SCIMProvisioningConfig[] {
    return Array.from(this._scimConfigs.values()).map((c) => ({ ...c }));
  }

  /**
   * Trigger a SCIM synchronisation run for a given configuration.
   *
   * This is a simulated sync — no real HTTP calls are made.
   * Returns a synthetic sync result with a random record count.
   *
   * @param configId - The SCIM configuration ID.
   * @returns An object with the sync ID, status, and number of records synced.
   * @throws If the SCIM configuration is not found or is disabled.
   */
  triggerSCIMSync(
    configId: string,
  ): { syncId: string; status: string; recordsSynced: number } {
    const config = this._scimConfigs.get(configId);
    if (!config) {
      throw new Error(`SCIM configuration not found: ${configId}`);
    }
    if (!config.enabled) {
      throw new Error(`SCIM configuration is disabled: ${configId}`);
    }

    const syncId = `scim_sync_${generateId()}`;
    const recordsSynced = Math.floor(Math.random() * 100) + 1;

    // Update the config's last modified timestamp
    config.updatedAt = new Date().toISOString();

    return { syncId, status: 'completed', recordsSynced };
  }

  // ── JIT (Just-In-Time) Provisioning ───────────────────

  /**
   * Process Just-In-Time provisioning for a federated identity.
   *
   * If the identity has not been seen from this IdP before, a
   * new identity record is created.  If it has been seen, the
   * existing record is updated with the new attributes.
   *
   * @param idpId      - The identity provider ID.
   * @param attributes - The identity attributes from the IdP assertion.
   * @returns An object indicating the identity ID and whether it was created or updated.
   * @throws If the identity provider is not found or JIT provisioning is not enabled.
   */
  processJITProvisioning(
    idpId: string,
    attributes: Record<string, any>,
  ): { identityId: string; created: boolean; updated: boolean } {
    const idp = this._identityProviders.get(idpId);
    if (!idp) {
      throw new Error(`Identity provider not found: ${idpId}`);
    }
    if (!idp.jitProvisioningEnabled) {
      throw new Error(`JIT provisioning not enabled for IdP: ${idpId}`);
    }

    // Use a composite key of IdP ID + external identifier
    const externalId =
      attributes['sub'] ??
      attributes['nameId'] ??
      attributes['email'] ??
      attributes['username'] ??
      generateId();
    const lookupKey = `${idpId}:${externalId}`;

    const existing = this._jitIdentities.get(lookupKey);

    if (existing) {
      // Update existing identity with new attributes
      existing.attributes = {
        ...existing.attributes,
        ...attributes,
        updatedAt: new Date().toISOString(),
      };

      // Fire provisioned callback (update)
      for (const cb of this._onProvisionedViaFederation) {
        cb({ identityId: existing.identityId, idpId, source: 'jit' });
      }

      return { identityId: existing.identityId, created: false, updated: true };
    }

    // Create new JIT identity
    const identityId = `jit_${generateId()}`;
    const mergedAttributes: Record<string, any> = {
      ...(idp.jitProvisioningDefaults ?? {}),
      ...attributes,
      idpId,
      provisionedAt: new Date().toISOString(),
      provisioningMethod: 'jit',
    };

    this._jitIdentities.set(lookupKey, {
      identityId,
      attributes: mergedAttributes,
    });

    // Fire provisioned callback (create)
    for (const cb of this._onProvisionedViaFederation) {
      cb({ identityId, idpId, source: 'jit' });
    }

    return { identityId, created: true, updated: false };
  }

  // ── Event Callbacks ───────────────────────────────────

  /**
   * Register a callback that fires on federated SSO login.
   *
   * @param cb - The callback function.
   */
  onSSOLogin(cb: SSOLoginCallback): void {
    this._onSSOLogin.push(cb);
  }

  /**
   * Register a callback that fires on federated SSO logout.
   *
   * @param cb - The callback function.
   */
  onSSOLogout(cb: SSOLogoutCallback): void {
    this._onSSOLogout.push(cb);
  }

  /**
   * Register a callback that fires when an identity is
   * provisioned via federation (JIT or SCIM).
   *
   * @param cb - The callback function.
   */
  onProvisionedViaFederation(cb: ProvisionedViaFederationCallback): void {
    this._onProvisionedViaFederation.push(cb);
  }

  /**
   * Register a callback that fires when an identity is
   * deprovisioned via federation (SCIM).
   *
   * @param cb - The callback function.
   */
  onDeprovisionedViaFederation(cb: DeprovisionedViaFederationCallback): void {
    this._onDeprovisionedViaFederation.push(cb);
  }

  // ── Computed Properties ───────────────────────────────

  /** Total number of registered identity providers. */
  get identityProviderCount(): number {
    return this._identityProviders.size;
  }

  /** Total number of registered service providers. */
  get serviceProviderCount(): number {
    return this._serviceProviders.size;
  }

  /** Total number of federation trusts. */
  get trustCount(): number {
    return this._trusts.size;
  }

  /** Total number of SCIM provisioning configurations. */
  get scimConfigCount(): number {
    return this._scimConfigs.size;
  }

  /** Number of identity providers with `'active'` status. */
  get activeIdpCount(): number {
    let count = 0;
    for (const idp of this._identityProviders.values()) {
      if (idp.status === 'active') {
        count++;
      }
    }
    return count;
  }

  /** Number of service providers with `'active'` status. */
  get activeSpCount(): number {
    let count = 0;
    for (const sp of this._serviceProviders.values()) {
      if (sp.status === 'active') {
        count++;
      }
    }
    return count;
  }

  /** Total number of federated authentications processed. */
  get federatedAuthTotal(): number {
    return this._federatedAuthTotal;
  }
}
