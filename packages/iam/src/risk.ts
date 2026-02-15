// ============================================================
// SOA One IAM — Risk Engine
// ============================================================
//
// Adaptive risk scoring engine with behavioral analytics,
// anomaly detection, threat intelligence correlation, and
// context-aware access decisions.
//
// Surpasses Oracle Adaptive Risk Management with:
// - Weighted multi-factor risk scoring with pluggable rules
// - Behavioral profiling with continuous learning
// - Impossible-travel detection via Haversine distance
// - Unusual-time and new-device anomaly checks
// - Location deviation and velocity anomaly detection
// - Threat intelligence indicator matching
// - Risk-level-aware access recommendations
// - Event-driven callbacks for real-time integration
//
// Zero external dependencies. 100% in-memory.
// ============================================================

import type {
  RiskLevel,
  RiskFactorCategory,
  RiskAssessment,
  RiskFactor,
  RiskScoringRule,
  RiskCondition,
  BehavioralProfile,
  AnomalyDetectionResult,
  ThreatIntelIndicator,
  GeoLocation,
} from './types';

// ── Utilities ────────────────────────────────────────────────

/** Generate a unique ID. */
export function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 6);
  return `iam_risk_${ts}-${rand}-${rand2}`;
}

// ── Callback Types ──────────────────────────────────────────

/** Callback invoked when a risk assessment completes. */
export type RiskAssessedCallback = (assessment: RiskAssessment) => void;

/** Callback invoked when an anomaly is detected. */
export type AnomalyDetectedCallback = (anomaly: AnomalyDetectionResult) => void;

/** Callback invoked when a threat indicator matches. */
export type ThreatIndicatorMatchedCallback = (indicator: ThreatIntelIndicator, context: Record<string, any>) => void;

/** Callback invoked when risk level changes for an identity. */
export type RiskLevelChangedCallback = (identityId: string, previousLevel: RiskLevel, newLevel: RiskLevel) => void;

// ── Risk Context ────────────────────────────────────────────

/** Context provided for a risk assessment. */
export interface RiskAssessmentContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geoLocation?: GeoLocation;
  action?: string;
  sessionId?: string;
}

// ── Behavioral Profile Update Data ──────────────────────────

/** Data for updating a behavioral profile. */
export interface BehavioralProfileData {
  loginHour?: number;
  location?: GeoLocation;
  deviceFingerprint?: string;
  ipAddress?: string;
  sessionDurationMinutes?: number;
  actionsCount?: number;
}

// ── Risk Engine ─────────────────────────────────────────────

/**
 * Adaptive Risk Engine with multi-factor scoring, behavioral
 * analytics, anomaly detection, and threat intelligence.
 *
 * Usage:
 * ```ts
 * const engine = new RiskEngine();
 *
 * // Add a risk scoring rule
 * engine.createRule({
 *   name: 'New Device',
 *   description: 'Flag logins from unknown devices',
 *   enabled: true,
 *   category: 'device',
 *   priority: 10,
 *   condition: { field: 'deviceFingerprint', operator: 'isNew', value: true },
 *   scoreAdjustment: 25,
 *   severity: 'medium',
 *   action: 'add-score',
 *   metadata: {},
 * });
 *
 * // Assess risk
 * const assessment = engine.assessRisk('user-123', {
 *   ipAddress: '10.0.0.1',
 *   deviceFingerprint: 'fp-abc',
 *   geoLocation: { latitude: 40.7, longitude: -74.0, country: 'US' },
 * });
 *
 * console.log(assessment.riskLevel);       // 'medium'
 * console.log(assessment.recommendation);  // 'step-up'
 * ```
 */
export class RiskEngine {
  // ── Private Storage ─────────────────────────────────────

  /** Risk scoring rules keyed by rule ID. */
  private _rules: Map<string, RiskScoringRule> = new Map();

  /** Behavioral profiles keyed by identity ID. */
  private _profiles: Map<string, BehavioralProfile> = new Map();

  /** Risk assessments keyed by assessment ID. */
  private _assessments: Map<string, RiskAssessment> = new Map();

  /** Anomaly detections stored as a flat list. */
  private _anomalies: AnomalyDetectionResult[] = [];

  /** Threat intelligence indicators keyed by indicator ID. */
  private _threatIndicators: Map<string, ThreatIntelIndicator> = new Map();

  /** Tracks the last known risk level per identity for change detection. */
  private _lastRiskLevel: Map<string, RiskLevel> = new Map();

  // ── Event Callbacks ───────────────────────────────────────

  private _onRiskAssessed: RiskAssessedCallback[] = [];
  private _onAnomalyDetected: AnomalyDetectedCallback[] = [];
  private _onThreatIndicatorMatched: ThreatIndicatorMatchedCallback[] = [];
  private _onRiskLevelChanged: RiskLevelChangedCallback[] = [];

  // ── Event Registration ────────────────────────────────────

  /** Register a callback for completed risk assessments. */
  onRiskAssessed(callback: RiskAssessedCallback): () => void {
    this._onRiskAssessed.push(callback);
    return () => {
      const idx = this._onRiskAssessed.indexOf(callback);
      if (idx >= 0) this._onRiskAssessed.splice(idx, 1);
    };
  }

  /** Register a callback for anomaly detection events. */
  onAnomalyDetected(callback: AnomalyDetectedCallback): () => void {
    this._onAnomalyDetected.push(callback);
    return () => {
      const idx = this._onAnomalyDetected.indexOf(callback);
      if (idx >= 0) this._onAnomalyDetected.splice(idx, 1);
    };
  }

  /** Register a callback for threat indicator matches. */
  onThreatIndicatorMatched(callback: ThreatIndicatorMatchedCallback): () => void {
    this._onThreatIndicatorMatched.push(callback);
    return () => {
      const idx = this._onThreatIndicatorMatched.indexOf(callback);
      if (idx >= 0) this._onThreatIndicatorMatched.splice(idx, 1);
    };
  }

  /** Register a callback for risk level changes. */
  onRiskLevelChanged(callback: RiskLevelChangedCallback): () => void {
    this._onRiskLevelChanged.push(callback);
    return () => {
      const idx = this._onRiskLevelChanged.indexOf(callback);
      if (idx >= 0) this._onRiskLevelChanged.splice(idx, 1);
    };
  }

  // ════════════════════════════════════════════════════════════
  // Risk Assessment
  // ════════════════════════════════════════════════════════════

  /**
   * Perform a full risk assessment for an identity.
   *
   * 1. Retrieves the behavioral profile for the identity.
   * 2. Evaluates all enabled risk scoring rules against the context.
   * 3. Runs anomaly detection.
   * 4. Checks threat intelligence for IP and user-agent.
   * 5. Calculates a weighted overall score.
   * 6. Determines risk level and recommendation.
   */
  assessRisk(identityId: string, context: RiskAssessmentContext): RiskAssessment {
    const now = new Date().toISOString();
    const factors: RiskFactor[] = [];
    const triggers: string[] = [];

    // 1. Get behavioral profile
    const profile = this._profiles.get(identityId);

    // 2. Evaluate all enabled rules sorted by priority (descending)
    const enabledRules = Array.from(this._rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      const matched = this._evaluateRuleCondition(rule.condition, context, profile);
      if (matched) {
        const weight = this._categoryWeight(rule.category);
        const score = Math.min(100, Math.max(0, rule.scoreAdjustment));
        const weightedScore = score * weight;

        factors.push({
          category: rule.category,
          name: rule.name,
          score,
          weight,
          weightedScore,
          details: { ruleId: rule.id, action: rule.action ?? 'add-score' },
          anomalous: rule.severity === 'high' || rule.severity === 'critical',
        });

        triggers.push(rule.name);
      }
    }

    // 3. Run anomaly detection
    const anomalies = this.detectAnomalies(identityId, context as Record<string, any>);
    for (const anomaly of anomalies) {
      const severityScore = this._severityToScore(anomaly.severity);
      const weight = this._categoryWeight(this._anomalyTypeToCategory(anomaly.anomalyType));
      const weightedScore = severityScore * weight;

      factors.push({
        category: this._anomalyTypeToCategory(anomaly.anomalyType),
        name: anomaly.anomalyType,
        score: severityScore,
        weight,
        weightedScore,
        details: anomaly.details,
        anomalous: true,
      });

      triggers.push(`anomaly:${anomaly.anomalyType}`);
    }

    // 4. Check threat intelligence for IP and user-agent
    if (context.ipAddress) {
      const ipThreat = this.checkThreatIntel('ip', context.ipAddress);
      if (ipThreat) {
        const score = this._severityToScore(ipThreat.severity);
        const weight = this._categoryWeight('reputation');
        factors.push({
          category: 'reputation',
          name: `threat-intel:ip:${ipThreat.threatType}`,
          score,
          weight,
          weightedScore: score * weight,
          details: { indicatorId: ipThreat.id, threatType: ipThreat.threatType, source: ipThreat.source },
          anomalous: true,
        });
        triggers.push(`threat-intel:ip:${ipThreat.threatType}`);

        for (const cb of this._onThreatIndicatorMatched) {
          cb(ipThreat, context as Record<string, any>);
        }
      }
    }

    if (context.userAgent) {
      const uaThreat = this.checkThreatIntel('user-agent', context.userAgent);
      if (uaThreat) {
        const score = this._severityToScore(uaThreat.severity);
        const weight = this._categoryWeight('reputation');
        factors.push({
          category: 'reputation',
          name: `threat-intel:user-agent:${uaThreat.threatType}`,
          score,
          weight,
          weightedScore: score * weight,
          details: { indicatorId: uaThreat.id, threatType: uaThreat.threatType, source: uaThreat.source },
          anomalous: true,
        });
        triggers.push(`threat-intel:user-agent:${uaThreat.threatType}`);

        for (const cb of this._onThreatIndicatorMatched) {
          cb(uaThreat, context as Record<string, any>);
        }
      }
    }

    // 5. Calculate weighted overall score
    let overallScore: number;
    if (factors.length === 0) {
      overallScore = 0;
    } else {
      const totalWeightedScore = factors.reduce((sum, f) => sum + f.weightedScore, 0);
      const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
      overallScore = totalWeight > 0
        ? Math.min(100, Math.round(totalWeightedScore / totalWeight))
        : 0;
    }

    // 6. Determine risk level and recommendation
    const riskLevel = this.calculateRiskLevel(overallScore);
    const recommendation = this.calculateRecommendation(riskLevel);

    const assessment: RiskAssessment = {
      id: generateId(),
      identityId,
      sessionId: context.sessionId,
      overallScore,
      riskLevel,
      factors,
      recommendation,
      triggers,
      assessedAt: now,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    this._assessments.set(assessment.id, assessment);

    // Fire risk-assessed callbacks
    for (const cb of this._onRiskAssessed) {
      cb(assessment);
    }

    // Check for risk level change
    const previousLevel = this._lastRiskLevel.get(identityId);
    if (previousLevel !== undefined && previousLevel !== riskLevel) {
      for (const cb of this._onRiskLevelChanged) {
        cb(identityId, previousLevel, riskLevel);
      }
    }
    this._lastRiskLevel.set(identityId, riskLevel);

    return assessment;
  }

  /** Retrieve a risk assessment by ID. */
  getRiskAssessment(id: string): RiskAssessment | undefined {
    return this._assessments.get(id);
  }

  /** Retrieve the most recent risk assessment for an identity. */
  getLatestAssessment(identityId: string): RiskAssessment | undefined {
    let latest: RiskAssessment | undefined;
    for (const a of this._assessments.values()) {
      if (a.identityId === identityId) {
        if (!latest || a.assessedAt > latest.assessedAt) {
          latest = a;
        }
      }
    }
    return latest;
  }

  /** Retrieve risk assessment history for an identity, newest first. */
  getRiskHistory(identityId: string, limit?: number): RiskAssessment[] {
    const history = Array.from(this._assessments.values())
      .filter((a) => a.identityId === identityId)
      .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt));
    return limit !== undefined ? history.slice(0, limit) : history;
  }

  // ════════════════════════════════════════════════════════════
  // Risk Scoring Rules
  // ════════════════════════════════════════════════════════════

  /** Create a new risk scoring rule. */
  createRule(rule: Omit<RiskScoringRule, 'id'>): RiskScoringRule {
    const newRule: RiskScoringRule = { ...rule, id: generateId() };
    this._rules.set(newRule.id, newRule);
    return newRule;
  }

  /** Retrieve a risk scoring rule by ID. */
  getRule(id: string): RiskScoringRule | undefined {
    return this._rules.get(id);
  }

  /** Update an existing risk scoring rule. */
  updateRule(id: string, updates: Partial<Omit<RiskScoringRule, 'id'>>): RiskScoringRule {
    const existing = this._rules.get(id);
    if (!existing) throw new Error(`Risk scoring rule not found: ${id}`);
    const updated: RiskScoringRule = { ...existing, ...updates, id };
    this._rules.set(id, updated);
    return updated;
  }

  /** Delete a risk scoring rule by ID. */
  deleteRule(id: string): void {
    if (!this._rules.has(id)) throw new Error(`Risk scoring rule not found: ${id}`);
    this._rules.delete(id);
  }

  /** List all risk scoring rules. */
  listRules(): RiskScoringRule[] {
    return Array.from(this._rules.values());
  }

  // ════════════════════════════════════════════════════════════
  // Behavioral Profiles
  // ════════════════════════════════════════════════════════════

  /**
   * Update (or create) the behavioral profile for an identity.
   *
   * Each data point is incorporated into the running profile,
   * building a picture of normal behavior over time.
   */
  updateProfile(identityId: string, data: BehavioralProfileData): BehavioralProfile {
    const now = new Date().toISOString();
    let profile = this._profiles.get(identityId);

    if (!profile) {
      profile = {
        identityId,
        typicalLoginHours: [],
        typicalLocations: [],
        typicalDevices: [],
        typicalIpRanges: [],
        averageSessionDurationMinutes: 0,
        averageActionsPerSession: 0,
        knownDeviceFingerprints: [],
        loginFrequencyPerWeek: 0,
        sensitiveResourceAccessPattern: {},
        lastUpdatedAt: now,
        dataPointCount: 0,
      };
    }

    const count = profile.dataPointCount;

    if (data.loginHour !== undefined) {
      if (!profile.typicalLoginHours.includes(data.loginHour)) {
        profile.typicalLoginHours.push(data.loginHour);
      }
    }

    if (data.location) {
      const alreadyKnown = profile.typicalLocations.some(
        (loc) =>
          loc.latitude === data.location!.latitude &&
          loc.longitude === data.location!.longitude,
      );
      if (!alreadyKnown) {
        profile.typicalLocations.push({ ...data.location });
      }
    }

    if (data.deviceFingerprint) {
      if (!profile.knownDeviceFingerprints.includes(data.deviceFingerprint)) {
        profile.knownDeviceFingerprints.push(data.deviceFingerprint);
      }
      if (!profile.typicalDevices.includes(data.deviceFingerprint)) {
        profile.typicalDevices.push(data.deviceFingerprint);
      }
    }

    if (data.ipAddress) {
      if (!profile.typicalIpRanges.includes(data.ipAddress)) {
        profile.typicalIpRanges.push(data.ipAddress);
      }
    }

    if (data.sessionDurationMinutes !== undefined) {
      // Running average
      profile.averageSessionDurationMinutes =
        count > 0
          ? (profile.averageSessionDurationMinutes * count + data.sessionDurationMinutes) / (count + 1)
          : data.sessionDurationMinutes;
    }

    if (data.actionsCount !== undefined) {
      profile.averageActionsPerSession =
        count > 0
          ? (profile.averageActionsPerSession * count + data.actionsCount) / (count + 1)
          : data.actionsCount;
    }

    profile.dataPointCount = count + 1;
    profile.lastUpdatedAt = now;

    this._profiles.set(identityId, profile);
    return { ...profile };
  }

  /** Retrieve the behavioral profile for an identity. */
  getProfile(identityId: string): BehavioralProfile | undefined {
    const profile = this._profiles.get(identityId);
    return profile ? { ...profile } : undefined;
  }

  /** List all behavioral profiles. */
  listProfiles(): BehavioralProfile[] {
    return Array.from(this._profiles.values()).map((p) => ({ ...p }));
  }

  // ════════════════════════════════════════════════════════════
  // Anomaly Detection
  // ════════════════════════════════════════════════════════════

  /**
   * Run all anomaly detection checks for an identity given the
   * current context. Results are stored and returned.
   */
  detectAnomalies(identityId: string, context: Record<string, any>): AnomalyDetectionResult[] {
    const profile = this._profiles.get(identityId);
    if (!profile) return [];

    const results: AnomalyDetectionResult[] = [];

    // Impossible travel
    if (context.geoLocation) {
      const result = this._checkImpossibleTravel(profile, context.geoLocation as GeoLocation);
      if (result) results.push(result);
    }

    // Unusual time
    const currentHour = context.loginHour ?? new Date().getHours();
    const unusualTime = this._checkUnusualTime(profile, currentHour);
    if (unusualTime) results.push(unusualTime);

    // New device
    if (context.deviceFingerprint) {
      const newDevice = this._checkNewDevice(profile, context.deviceFingerprint as string);
      if (newDevice) results.push(newDevice);
    }

    // Unusual location
    if (context.geoLocation) {
      const unusualLoc = this._checkUnusualLocation(profile, context.geoLocation as GeoLocation);
      if (unusualLoc) results.push(unusualLoc);
    }

    // Velocity anomaly
    const velocity = this._checkVelocityAnomaly(identityId);
    if (velocity) results.push(velocity);

    // Store anomalies and fire callbacks
    for (const anomaly of results) {
      this._anomalies.push(anomaly);
      for (const cb of this._onAnomalyDetected) {
        cb(anomaly);
      }
    }

    return results;
  }

  /** Retrieve all anomaly detection results for an identity. */
  getAnomalies(identityId: string): AnomalyDetectionResult[] {
    return this._anomalies.filter((a) => a.identityId === identityId);
  }

  /** Retrieve recent anomaly detections across all identities, newest first. */
  getRecentAnomalies(limit?: number): AnomalyDetectionResult[] {
    const sorted = [...this._anomalies].sort(
      (a, b) => b.detectedAt.localeCompare(a.detectedAt),
    );
    return limit !== undefined ? sorted.slice(0, limit) : sorted;
  }

  // ── Private Anomaly Checks ──────────────────────────────

  /**
   * Check for impossible travel: the user appears in a new
   * location impossibly fast given the distance from their
   * last known location.
   */
  private _checkImpossibleTravel(
    profile: BehavioralProfile,
    currentLocation: GeoLocation,
  ): AnomalyDetectionResult | null {
    if (profile.typicalLocations.length === 0) return null;

    // Compare against the most recently added typical location
    const lastLocation = profile.typicalLocations[profile.typicalLocations.length - 1];
    const distanceKm = this._haversineDistance(lastLocation, currentLocation);

    // Impossible travel threshold: > 500 km in the time since last update
    // For simplicity, if the profile was updated within the last hour and
    // the distance exceeds 500 km, flag it.
    const lastUpdateMs = new Date(profile.lastUpdatedAt).getTime();
    const elapsed = Date.now() - lastUpdateMs;
    const elapsedHours = elapsed / (1000 * 60 * 60);

    // Max plausible speed: ~900 km/h (jet aircraft)
    const maxPlausibleDistanceKm = elapsedHours * 900;

    if (distanceKm > 500 && distanceKm > maxPlausibleDistanceKm) {
      return {
        identityId: profile.identityId,
        anomalyType: 'impossible-travel',
        severity: 'high',
        confidence: Math.min(1, distanceKm / (maxPlausibleDistanceKm + 1)),
        description: `Impossible travel detected: ${Math.round(distanceKm)} km from last known location in ${elapsedHours.toFixed(1)} hours`,
        details: {
          lastLocation,
          currentLocation,
          distanceKm: Math.round(distanceKm),
          elapsedHours: parseFloat(elapsedHours.toFixed(2)),
          maxPlausibleDistanceKm: Math.round(maxPlausibleDistanceKm),
        },
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Check if the current login hour deviates from the user's
   * established pattern.
   */
  private _checkUnusualTime(
    profile: BehavioralProfile,
    currentHour: number,
  ): AnomalyDetectionResult | null {
    if (profile.typicalLoginHours.length < 3) return null;

    if (!profile.typicalLoginHours.includes(currentHour)) {
      // Check if it's close to any typical hour (within 1 hour)
      const isNearTypical = profile.typicalLoginHours.some(
        (h) => Math.abs(h - currentHour) <= 1 || Math.abs(h - currentHour) >= 23,
      );

      if (!isNearTypical) {
        return {
          identityId: profile.identityId,
          anomalyType: 'unusual-time',
          severity: 'low',
          confidence: 0.7,
          description: `Login at unusual hour ${currentHour}:00. Typical hours: ${profile.typicalLoginHours.join(', ')}`,
          details: {
            currentHour,
            typicalHours: profile.typicalLoginHours,
          },
          detectedAt: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Check if the device fingerprint is unknown for this identity.
   */
  private _checkNewDevice(
    profile: BehavioralProfile,
    deviceFingerprint: string,
  ): AnomalyDetectionResult | null {
    if (profile.knownDeviceFingerprints.length === 0) return null;

    if (!profile.knownDeviceFingerprints.includes(deviceFingerprint)) {
      return {
        identityId: profile.identityId,
        anomalyType: 'new-device',
        severity: 'medium',
        confidence: 0.85,
        description: `Login from unrecognized device: ${deviceFingerprint}`,
        details: {
          deviceFingerprint,
          knownDeviceCount: profile.knownDeviceFingerprints.length,
        },
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Check if the current location significantly deviates from
   * all known typical locations.
   */
  private _checkUnusualLocation(
    profile: BehavioralProfile,
    location: GeoLocation,
  ): AnomalyDetectionResult | null {
    if (profile.typicalLocations.length === 0) return null;

    // Find the minimum distance to any known location
    let minDistance = Infinity;
    for (const known of profile.typicalLocations) {
      const dist = this._haversineDistance(known, location);
      if (dist < minDistance) minDistance = dist;
    }

    // Flag if more than 200 km from any known location
    if (minDistance > 200) {
      return {
        identityId: profile.identityId,
        anomalyType: 'unusual-location',
        severity: minDistance > 1000 ? 'high' : 'medium',
        confidence: Math.min(1, minDistance / 2000),
        description: `Login from unusual location: ${Math.round(minDistance)} km from nearest known location`,
        details: {
          currentLocation: location,
          nearestKnownDistanceKm: Math.round(minDistance),
          knownLocationCount: profile.typicalLocations.length,
        },
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Check for velocity anomaly: too many assessments for the
   * same identity in a short time window.
   */
  private _checkVelocityAnomaly(identityId: string): AnomalyDetectionResult | null {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recentAssessments = Array.from(this._assessments.values()).filter(
      (a) => a.identityId === identityId && a.assessedAt > fiveMinutesAgo,
    );

    // More than 10 assessments in 5 minutes is suspicious
    if (recentAssessments.length > 10) {
      return {
        identityId,
        anomalyType: 'velocity-anomaly',
        severity: 'high',
        confidence: Math.min(1, recentAssessments.length / 20),
        description: `Velocity anomaly: ${recentAssessments.length} access attempts in the last 5 minutes`,
        details: {
          assessmentCount: recentAssessments.length,
          windowMinutes: 5,
        },
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  // ════════════════════════════════════════════════════════════
  // Threat Intelligence
  // ════════════════════════════════════════════════════════════

  /** Add a new threat intelligence indicator. */
  addThreatIndicator(indicator: Omit<ThreatIntelIndicator, 'id'>): ThreatIntelIndicator {
    const newIndicator: ThreatIntelIndicator = { ...indicator, id: generateId() };
    this._threatIndicators.set(newIndicator.id, newIndicator);
    return newIndicator;
  }

  /** Retrieve a threat intelligence indicator by ID. */
  getThreatIndicator(id: string): ThreatIntelIndicator | undefined {
    return this._threatIndicators.get(id);
  }

  /**
   * Check whether a value matches any active (non-expired)
   * threat indicator of the given type.
   */
  checkThreatIntel(type: string, value: string): ThreatIntelIndicator | undefined {
    const now = new Date().toISOString();
    for (const indicator of this._threatIndicators.values()) {
      if (indicator.type === type && indicator.value === value && indicator.expiresAt > now) {
        return indicator;
      }
    }
    return undefined;
  }

  /** List all threat intelligence indicators. */
  listThreatIndicators(): ThreatIntelIndicator[] {
    return Array.from(this._threatIndicators.values());
  }

  /** Remove a threat intelligence indicator by ID. */
  removeThreatIndicator(id: string): void {
    this._threatIndicators.delete(id);
  }

  /**
   * Remove all expired threat indicators and return the count
   * of removed indicators.
   */
  cleanupExpiredIndicators(): number {
    const now = new Date().toISOString();
    let removed = 0;
    for (const [id, indicator] of this._threatIndicators) {
      if (indicator.expiresAt <= now) {
        this._threatIndicators.delete(id);
        removed++;
      }
    }
    return removed;
  }

  // ════════════════════════════════════════════════════════════
  // Risk Level Calculation
  // ════════════════════════════════════════════════════════════

  /**
   * Map a numeric risk score (0-100) to a risk level.
   *
   * -  0-20: minimal
   * - 21-40: low
   * - 41-60: medium
   * - 61-80: high
   * - 81-100: critical
   */
  calculateRiskLevel(score: number): RiskLevel {
    if (score <= 20) return 'minimal';
    if (score <= 40) return 'low';
    if (score <= 60) return 'medium';
    if (score <= 80) return 'high';
    return 'critical';
  }

  /**
   * Determine the recommended action for a given risk level.
   *
   * - minimal  -> 'allow'
   * - low      -> 'monitor'
   * - medium   -> 'step-up'
   * - high     -> 'challenge'
   * - critical -> 'deny'
   */
  calculateRecommendation(riskLevel: RiskLevel): 'allow' | 'step-up' | 'challenge' | 'deny' | 'monitor' {
    switch (riskLevel) {
      case 'minimal': return 'allow';
      case 'low': return 'monitor';
      case 'medium': return 'step-up';
      case 'high': return 'challenge';
      case 'critical': return 'deny';
    }
  }

  // ════════════════════════════════════════════════════════════
  // Getters
  // ════════════════════════════════════════════════════════════

  /** Total number of registered risk scoring rules. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** Total number of behavioral profiles. */
  get profileCount(): number {
    return this._profiles.size;
  }

  /** Total number of risk assessments. */
  get assessmentCount(): number {
    return this._assessments.size;
  }

  /** Total number of detected anomalies. */
  get anomalyCount(): number {
    return this._anomalies.length;
  }

  /** Number of active (non-expired) threat intelligence indicators. */
  get activeThreatIndicatorCount(): number {
    const now = new Date().toISOString();
    let count = 0;
    for (const indicator of this._threatIndicators.values()) {
      if (indicator.expiresAt > now) count++;
    }
    return count;
  }

  /** Average risk score across all assessments. */
  get averageRiskScore(): number {
    if (this._assessments.size === 0) return 0;
    let total = 0;
    for (const a of this._assessments.values()) {
      total += a.overallScore;
    }
    return Math.round((total / this._assessments.size) * 100) / 100;
  }

  /** Number of assessments with risk level 'high' or 'critical'. */
  get highRiskSessionCount(): number {
    let count = 0;
    for (const a of this._assessments.values()) {
      if (a.riskLevel === 'high' || a.riskLevel === 'critical') count++;
    }
    return count;
  }

  // ════════════════════════════════════════════════════════════
  // Private Helpers
  // ════════════════════════════════════════════════════════════

  /**
   * Evaluate a risk condition against the current context and
   * behavioral profile. Supports recursive AND/OR logic.
   */
  private _evaluateRuleCondition(
    condition: RiskCondition,
    context: RiskAssessmentContext,
    profile: BehavioralProfile | undefined,
  ): boolean {
    // Handle compound conditions with children
    if (condition.children && condition.children.length > 0) {
      if (condition.logic === 'OR') {
        return condition.children.some((child) =>
          this._evaluateRuleCondition(child, context, profile),
        );
      }
      // Default to AND
      return condition.children.every((child) =>
        this._evaluateRuleCondition(child, context, profile),
      );
    }

    // Resolve field value from context or profile
    const fieldValue = this._resolveFieldValue(condition.field, context, profile);

    return this._evaluateOperator(condition.operator, fieldValue, condition.value, profile, condition.field);
  }

  /**
   * Resolve the value of a field from the context or behavioral
   * profile for condition evaluation.
   */
  private _resolveFieldValue(
    field: string,
    context: RiskAssessmentContext,
    profile: BehavioralProfile | undefined,
  ): any {
    // Direct context fields
    const contextRecord = context as Record<string, any>;
    if (field in contextRecord) return contextRecord[field];

    // GeoLocation sub-fields
    if (field.startsWith('geoLocation.') && context.geoLocation) {
      const subField = field.substring('geoLocation.'.length);
      return (context.geoLocation as Record<string, any>)[subField];
    }

    // Profile fields
    if (profile) {
      const profileRecord = profile as Record<string, any>;
      if (field in profileRecord) return profileRecord[field];
    }

    return undefined;
  }

  /**
   * Evaluate a single comparison operator.
   */
  private _evaluateOperator(
    operator: RiskCondition['operator'],
    fieldValue: any,
    conditionValue: any,
    profile: BehavioralProfile | undefined,
    field: string,
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'notEquals':
        return fieldValue !== conditionValue;
      case 'greaterThan':
        return typeof fieldValue === 'number' && fieldValue > conditionValue;
      case 'lessThan':
        return typeof fieldValue === 'number' && fieldValue < conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(conditionValue);
      case 'matches':
        try {
          return typeof fieldValue === 'string' && new RegExp(conditionValue).test(fieldValue);
        } catch {
          return false;
        }
      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2 && typeof fieldValue === 'number') {
          return fieldValue >= conditionValue[0] && fieldValue <= conditionValue[1];
        }
        return false;
      case 'isNew': {
        // Value is "new" if not found in the corresponding profile collection
        if (!profile) return true;
        if (field === 'deviceFingerprint') {
          return !profile.knownDeviceFingerprints.includes(fieldValue);
        }
        if (field === 'ipAddress') {
          return !profile.typicalIpRanges.includes(fieldValue);
        }
        if (field === 'geoLocation.country') {
          return !profile.typicalLocations.some((loc) => loc.country === fieldValue);
        }
        return true;
      }
      case 'changed': {
        // Value has "changed" if profile exists and the current value
        // differs from the most recent profile entry
        if (!profile) return false;
        if (field === 'ipAddress') {
          return (
            profile.typicalIpRanges.length > 0 &&
            profile.typicalIpRanges[profile.typicalIpRanges.length - 1] !== fieldValue
          );
        }
        if (field === 'deviceFingerprint') {
          return (
            profile.knownDeviceFingerprints.length > 0 &&
            profile.knownDeviceFingerprints[profile.knownDeviceFingerprints.length - 1] !== fieldValue
          );
        }
        return false;
      }
      default:
        return false;
    }
  }

  /**
   * Return the weight for a given risk factor category.
   * Weights sum to a meaningful weighting scheme.
   */
  private _categoryWeight(category: RiskFactorCategory): number {
    const weights: Record<RiskFactorCategory, number> = {
      authentication: 1.0,
      behavior: 0.9,
      device: 0.8,
      location: 0.85,
      network: 0.7,
      time: 0.5,
      velocity: 0.95,
      context: 0.6,
      reputation: 1.0,
    };
    return weights[category] ?? 0.5;
  }

  /**
   * Map a risk severity level to a numeric score contribution.
   */
  private _severityToScore(severity: RiskLevel): number {
    switch (severity) {
      case 'minimal': return 10;
      case 'low': return 25;
      case 'medium': return 50;
      case 'high': return 75;
      case 'critical': return 100;
    }
  }

  /**
   * Map an anomaly type to a risk factor category.
   */
  private _anomalyTypeToCategory(anomalyType: AnomalyDetectionResult['anomalyType']): RiskFactorCategory {
    switch (anomalyType) {
      case 'impossible-travel': return 'location';
      case 'unusual-time': return 'time';
      case 'new-device': return 'device';
      case 'unusual-location': return 'location';
      case 'velocity-anomaly': return 'velocity';
      case 'behavior-change': return 'behavior';
      case 'privilege-escalation': return 'context';
    }
  }

  /**
   * Calculate the Haversine distance between two geographic
   * points in kilometres.
   */
  private _haversineDistance(a: GeoLocation, b: GeoLocation): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const sinHalfDLat = Math.sin(dLat / 2);
    const sinHalfDLon = Math.sin(dLon / 2);
    const h = sinHalfDLat * sinHalfDLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    return R * c;
  }
}
