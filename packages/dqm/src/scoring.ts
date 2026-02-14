// ============================================================
// SOA One DQM — Quality Scoring Framework
// ============================================================

import type {
  QualityDimension,
  DimensionWeight,
  DimensionScore,
  QualityScore,
  ScoreHistoryEntry,
  QualityRuleResult,
  QualitySeverity,
} from './types';

import { generateId } from './profiler';

// ── Dimension Mapping ─────────────────────────────────────────

/** Maps rule type strings to quality dimensions. */
const RULE_TYPE_DIMENSION_MAP: Record<string, QualityDimension> = {
  'not-null': 'completeness',
  completeness: 'completeness',
  accuracy: 'accuracy',
  consistency: 'consistency',
  'cross-field': 'consistency',
  conditional: 'consistency',
  timeliness: 'timeliness',
  freshness: 'timeliness',
  unique: 'uniqueness',
  pattern: 'validity',
  format: 'validity',
  domain: 'validity',
  schema: 'validity',
  referential: 'integrity',
  range: 'conformity',
  distribution: 'conformity',
  volume: 'conformity',
  statistical: 'conformity',
  business: 'conformity',
  aggregate: 'conformity',
  custom: 'conformity',
};

// ── Default Weights ───────────────────────────────────────────

const DEFAULT_WEIGHTS: DimensionWeight[] = [
  { dimension: 'completeness', weight: 0.20 },
  { dimension: 'accuracy', weight: 0.15 },
  { dimension: 'consistency', weight: 0.15 },
  { dimension: 'timeliness', weight: 0.10 },
  { dimension: 'uniqueness', weight: 0.15 },
  { dimension: 'validity', weight: 0.15 },
  { dimension: 'integrity', weight: 0.05 },
  { dimension: 'conformity', weight: 0.05 },
];

// ── Quality Scoring Engine ──────────────────────────────────

/**
 * Calculates weighted quality scores across eight dimensions,
 * tracks score history, and reports quality trends.
 *
 * Usage:
 * ```ts
 * const engine = new QualityScoringEngine();
 * const score = engine.calculateScore(ruleResults, 'orders');
 * console.log(score.grade); // 'A'
 * console.log(engine.trend); // 'improving'
 * ```
 */
export class QualityScoringEngine {
  private _weights: Map<QualityDimension, number>;
  private _history: ScoreHistoryEntry[];
  private _maxHistory: number;
  private _lastScore: QualityScore | null;

  constructor(weights?: DimensionWeight[], maxHistory: number = 100) {
    this._weights = new Map<QualityDimension, number>();
    this._history = [];
    this._maxHistory = maxHistory;
    this._lastScore = null;

    const initial = weights ?? DEFAULT_WEIGHTS;
    for (const w of initial) {
      this._weights.set(w.dimension, w.weight);
    }
  }

  // ── Weight Management ───────────────────────────────────

  /** Set the weight for a scoring dimension. */
  setWeight(dimension: QualityDimension, weight: number): void {
    this._weights.set(dimension, weight);
  }

  /** Get the weight for a scoring dimension. */
  getWeight(dimension: QualityDimension): number {
    return this._weights.get(dimension) ?? 0;
  }

  /** All dimension weights as an array. */
  get weights(): DimensionWeight[] {
    return Array.from(this._weights.entries()).map(
      ([dimension, weight]) => ({ dimension, weight }),
    );
  }

  // ── Scoring ─────────────────────────────────────────────

  /**
   * Calculate an overall quality score from rule results.
   *
   * Groups rule results by dimension, computes each dimension's
   * pass rate, applies configured weights, and produces a
   * normalised overall score between 0 and 100.
   */
  calculateScore(
    results: QualityRuleResult[],
    datasetName?: string,
  ): QualityScore {
    // Group results by dimension
    const dimensionResults = new Map<QualityDimension, QualityRuleResult[]>();
    for (const result of results) {
      const dimension = this._mapRuleToDimension(result.ruleType);
      const existing = dimensionResults.get(dimension) ?? [];
      existing.push(result);
      dimensionResults.set(dimension, existing);
    }

    // Calculate score for each dimension
    const dimensionScores: DimensionScore[] = [];
    let weightedTotal = 0;
    let weightSum = 0;

    for (const [dimension, weight] of this._weights) {
      const dimResults = dimensionResults.get(dimension) ?? [];
      const dimScore = this._buildDimensionScore(dimension, dimResults, weight);
      dimensionScores.push(dimScore);
      weightedTotal += dimScore.weightedScore;
      weightSum += weight;
    }

    // Normalise the overall score to 0-100
    const overall =
      weightSum > 0
        ? (weightedTotal / weightSum) * 100
        : 100;

    // Tally rules
    const totalRules = results.length;
    const passedRules = results.filter((r) => r.passed).length;
    const failedRules = totalRules - passedRules;

    const previousScore = this._lastScore?.overall ?? undefined;

    const score: QualityScore = {
      overall,
      grade: this._calculateGrade(overall),
      dimensions: dimensionScores,
      totalRules,
      passedRules,
      failedRules,
      trend: this._determineTrend(),
      previousScore,
      scoredAt: new Date().toISOString(),
    };

    this._lastScore = score;
    this._addToHistory(score, datasetName ?? 'unknown');

    // Re-evaluate trend now that history includes the new entry
    score.trend = this._determineTrend();

    return score;
  }

  /** The most recently calculated quality score. */
  get lastScore(): QualityScore | null {
    return this._lastScore;
  }

  /** Full score history (oldest first). */
  get history(): ScoreHistoryEntry[] {
    return [...this._history];
  }

  /** Current quality trend based on recent scores. */
  get trend(): 'improving' | 'stable' | 'degrading' {
    return this._determineTrend();
  }

  // ── Dimension Queries ───────────────────────────────────

  /**
   * Calculate a score for a single dimension from rule results.
   *
   * Only the results whose rule type maps to the requested
   * dimension are considered.
   */
  getScoreForDimension(
    dimension: QualityDimension,
    results: QualityRuleResult[],
  ): DimensionScore {
    const weight = this.getWeight(dimension);
    const matching = results.filter(
      (r) => this._mapRuleToDimension(r.ruleType) === dimension,
    );
    return this._buildDimensionScore(dimension, matching, weight);
  }

  /** Clear score history. */
  clearHistory(): void {
    this._history = [];
  }

  // ── Private ─────────────────────────────────────────────

  /** Build a DimensionScore from a set of rule results. */
  private _buildDimensionScore(
    dimension: QualityDimension,
    results: QualityRuleResult[],
    weight: number,
  ): DimensionScore {
    const ruleCount = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = ruleCount - passedCount;

    // Dimension score is the weighted average of pass rates,
    // giving heavier penalties to higher-severity failures.
    let score: number;

    if (ruleCount === 0) {
      score = 1; // No rules = no known issues
    } else {
      const severityMultiplier = (severity: QualitySeverity): number => {
        switch (severity) {
          case 'critical':
            return 2.0;
          case 'high':
            return 1.5;
          case 'medium':
            return 1.0;
          case 'low':
            return 0.75;
          case 'info':
            return 0.5;
          default:
            return 1.0;
        }
      };

      let totalWeight = 0;
      let weightedPassRate = 0;

      for (const result of results) {
        const mult = severityMultiplier(result.severity);
        weightedPassRate += result.passRate * mult;
        totalWeight += mult;
      }

      score = totalWeight > 0 ? weightedPassRate / totalWeight : 1;
    }

    return {
      dimension,
      score,
      weight,
      weightedScore: score * weight,
      ruleCount,
      passedCount,
      failedCount,
    };
  }

  /** Map a rule type string to a quality dimension. */
  private _mapRuleToDimension(ruleType: string): QualityDimension {
    return RULE_TYPE_DIMENSION_MAP[ruleType] ?? 'conformity';
  }

  /** Derive a letter grade from a 0-100 score. */
  private _calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Determine the quality trend from the last 5 scores.
   *
   * - **improving** — latest score exceeds the average of the
   *   preceding scores.
   * - **degrading** — latest score is more than 5 percentage
   *   points below the average of the preceding scores.
   * - **stable** — everything else.
   */
  private _determineTrend(): 'improving' | 'stable' | 'degrading' {
    const recent = this._history.slice(-5);

    if (recent.length < 2) {
      return 'stable';
    }

    const latest = recent[recent.length - 1].score.overall;
    const previous = recent.slice(0, -1);
    const avgPrevious =
      previous.reduce((sum, entry) => sum + entry.score.overall, 0) /
      previous.length;

    if (latest > avgPrevious) return 'improving';
    if (latest < avgPrevious - 5) return 'degrading';
    return 'stable';
  }

  /** Append a score to history, trimming to maxHistory. */
  private _addToHistory(score: QualityScore, datasetName: string): void {
    this._history.push({
      score,
      datasetName,
      timestamp: new Date().toISOString(),
    });

    if (this._history.length > this._maxHistory) {
      this._history = this._history.slice(
        this._history.length - this._maxHistory,
      );
    }
  }
}
