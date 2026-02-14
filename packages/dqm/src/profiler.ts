// ============================================================
// SOA One DQM — Data Profiling Engine
// ============================================================
//
// Comprehensive data profiling engine with full statistical
// analysis, pattern detection, frequency analysis, entropy
// computation, and correlation discovery.
//
// Features:
// - Column-level type inference (string, number, integer, float,
//   boolean, date, datetime, null, unknown)
// - Full numeric statistics (min, max, mean, median, mode,
//   stddev, variance, skewness, kurtosis, percentiles, IQR,
//   coefficient of variation, outlier detection via 1.5*IQR)
// - String length statistics (min, max, mean, median)
// - Top-N and bottom-N frequency analysis
// - Pattern detection (letters → L, digits → D, keep specials)
// - Shannon entropy computation
// - Pearson correlation between numeric columns
// - Duplicate row detection
//
// Zero external dependencies.
// ============================================================

import type {
  ProfileDataType,
  NumericStats,
  StringLengthStats,
  ColumnProfile,
  DatasetProfile,
  DistributionBucket,
  PatternResult,
  ColumnCorrelation,
} from './types';

// ── ID Generator ────────────────────────────────────────────

/** Generate a unique DQM identifier. */
export function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `dqm_${timestamp}_${random}`;
}

// ── Profile Options ─────────────────────────────────────────

/** Options for dataset profiling. */
export interface ProfileOptions {
  /** Maximum number of patterns to return per column. */
  maxPatterns?: number;
  /** Maximum number of top/bottom values to return per column. */
  maxTopValues?: number;
  /** Maximum number of sample values to collect per column. */
  maxSampleValues?: number;
  /** Minimum absolute correlation coefficient to include. */
  correlationThreshold?: number;
  /** Whether to compute column correlations. */
  computeCorrelations?: boolean;
}

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_MAX_PATTERNS = 20;
const DEFAULT_MAX_TOP_VALUES = 20;
const DEFAULT_MAX_SAMPLE_VALUES = 10;
const DEFAULT_CORRELATION_THRESHOLD = 0.5;
const DEFAULT_COMPUTE_CORRELATIONS = true;

// ── Data Profiler ───────────────────────────────────────────

/**
 * Profiles datasets and individual columns to understand data
 * structure, distribution, quality, and statistical properties.
 *
 * Usage:
 * ```ts
 * const profiler = new DataProfiler();
 *
 * // Profile a full dataset
 * const dataset = profiler.profileDataset('customers', rows);
 *
 * // Profile a single column
 * const column = profiler.profileColumn('age', [25, 30, 35, 40]);
 * ```
 */
export class DataProfiler {
  /** Profile an entire dataset, producing column profiles and correlations. */
  profileDataset(
    name: string,
    rows: Record<string, any>[],
    options?: ProfileOptions,
  ): DatasetProfile {
    const startTime = Date.now();
    const maxPatterns = options?.maxPatterns ?? DEFAULT_MAX_PATTERNS;
    const maxTopValues = options?.maxTopValues ?? DEFAULT_MAX_TOP_VALUES;
    const maxSampleValues = options?.maxSampleValues ?? DEFAULT_MAX_SAMPLE_VALUES;
    const correlationThreshold =
      options?.correlationThreshold ?? DEFAULT_CORRELATION_THRESHOLD;
    const computeCorrelations =
      options?.computeCorrelations ?? DEFAULT_COMPUTE_CORRELATIONS;

    if (rows.length === 0) {
      return {
        id: generateId(),
        name,
        totalRows: 0,
        totalColumns: 0,
        columns: [],
        duplicateRowCount: 0,
        duplicateRowPercentage: 0,
        completeRowCount: 0,
        completeRowPercentage: 0,
        profiledAt: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        correlations: [],
      };
    }

    // Discover all columns across every row
    const allColumns = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        allColumns.add(key);
      }
    }

    const columnNames = Array.from(allColumns);

    // Profile each column
    const columns: ColumnProfile[] = [];
    for (const col of columnNames) {
      const values = rows.map((r) => r[col]);
      columns.push(
        this._profileColumnInternal(col, values, maxPatterns, maxTopValues, maxSampleValues),
      );
    }

    // Duplicate row detection
    const duplicateRowCount = this._countDuplicateRows(rows);
    const duplicateRowPercentage =
      rows.length > 0 ? (duplicateRowCount / rows.length) * 100 : 0;

    // Complete row detection (no nulls in any column)
    let completeRowCount = 0;
    for (const row of rows) {
      let complete = true;
      for (const col of columnNames) {
        const v = row[col];
        if (v === null || v === undefined) {
          complete = false;
          break;
        }
      }
      if (complete) completeRowCount++;
    }
    const completeRowPercentage =
      rows.length > 0 ? (completeRowCount / rows.length) * 100 : 0;

    // Correlations
    let correlations: ColumnCorrelation[] = [];
    if (computeCorrelations) {
      const numericCols = columns.filter(
        (c) =>
          (c.inferredType === 'number' ||
            c.inferredType === 'integer' ||
            c.inferredType === 'float') &&
          c.nullPercentage < 100,
      );
      correlations = this._computeCorrelations(
        rows,
        numericCols.map((c) => c.name),
        correlationThreshold,
      );
    }

    return {
      id: generateId(),
      name,
      totalRows: rows.length,
      totalColumns: columns.length,
      columns,
      duplicateRowCount,
      duplicateRowPercentage,
      completeRowCount,
      completeRowPercentage,
      profiledAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      correlations,
    };
  }

  /** Profile a single column of values. */
  profileColumn(name: string, values: any[]): ColumnProfile {
    return this._profileColumnInternal(
      name,
      values,
      DEFAULT_MAX_PATTERNS,
      DEFAULT_MAX_TOP_VALUES,
      DEFAULT_MAX_SAMPLE_VALUES,
    );
  }

  // ── Private ─────────────────────────────────────────────

  private _profileColumnInternal(
    name: string,
    values: any[],
    maxPatterns: number,
    maxTopValues: number,
    maxSampleValues: number,
  ): ColumnProfile {
    const totalValues = values.length;

    // Null / empty / whitespace counts
    let nullCount = 0;
    let emptyStringCount = 0;
    let whiteSpaceOnlyCount = 0;
    const nonNullValues: any[] = [];

    for (const v of values) {
      if (v === null || v === undefined) {
        nullCount++;
      } else {
        nonNullValues.push(v);
        if (typeof v === 'string') {
          if (v === '') emptyStringCount++;
          else if (v.trim() === '') whiteSpaceOnlyCount++;
        }
      }
    }

    const nullPercentage = totalValues > 0 ? (nullCount / totalValues) * 100 : 0;

    // Infer type
    const inferredType = this._inferType(nonNullValues);

    // Distinct / unique / duplicate counts
    const stringified = nonNullValues.map(String);
    const frequencyMap = new Map<string, number>();
    for (const s of stringified) {
      frequencyMap.set(s, (frequencyMap.get(s) ?? 0) + 1);
    }

    const distinctCount = frequencyMap.size;
    const distinctPercentage =
      nonNullValues.length > 0 ? (distinctCount / nonNullValues.length) * 100 : 0;

    let uniqueCount = 0;
    let duplicateCount = 0;
    for (const count of frequencyMap.values()) {
      if (count === 1) uniqueCount++;
      else duplicateCount += count;
    }
    const uniquePercentage =
      nonNullValues.length > 0 ? (uniqueCount / nonNullValues.length) * 100 : 0;

    // Top values / bottom values
    const topValues = this._computeTopValues(frequencyMap, nonNullValues.length, maxTopValues);
    const bottomValues = this._computeBottomValues(frequencyMap, nonNullValues.length, maxTopValues);

    // Patterns
    const patterns =
      inferredType === 'string' || inferredType === 'unknown'
        ? this._detectPatterns(nonNullValues, maxPatterns)
        : [];

    // Sample values
    const sampleValues = nonNullValues.slice(0, maxSampleValues);

    // Completeness
    const completeness = totalValues > 0 ? (nonNullValues.length / totalValues) * 100 : 0;

    // Entropy
    const entropy = this._computeEntropy(nonNullValues);

    // Build profile
    const profile: ColumnProfile = {
      name,
      inferredType,
      totalValues,
      nullCount,
      nullPercentage,
      distinctCount,
      distinctPercentage,
      uniqueCount,
      uniquePercentage,
      duplicateCount,
      emptyStringCount,
      whiteSpaceOnlyCount,
      topValues,
      bottomValues,
      patterns,
      sampleValues,
      completeness,
      entropy,
    };

    // Numeric stats
    if (
      inferredType === 'number' ||
      inferredType === 'integer' ||
      inferredType === 'float'
    ) {
      const numbers = nonNullValues.map(Number).filter((n) => !isNaN(n));
      if (numbers.length > 0) {
        profile.numericStats = this._computeNumericStats(numbers);
        profile.minValue = profile.numericStats.min;
        profile.maxValue = profile.numericStats.max;
        profile.meanValue = profile.numericStats.mean;
      }
    }

    // String length stats
    if (inferredType === 'string') {
      const lengths = nonNullValues.map((v) => String(v).length);
      if (lengths.length > 0) {
        profile.stringLengthStats = this._computeStringLengthStats(lengths);
        profile.minValue = profile.stringLengthStats.min;
        profile.maxValue = profile.stringLengthStats.max;
      }
    }

    // Date min/max
    if (
      inferredType === 'date' ||
      inferredType === 'datetime' ||
      inferredType === 'timestamp'
    ) {
      const timestamps = nonNullValues
        .map((v) => new Date(v).getTime())
        .filter((t) => !isNaN(t));
      if (timestamps.length > 0) {
        profile.minValue = new Date(Math.min(...timestamps)).toISOString();
        profile.maxValue = new Date(Math.max(...timestamps)).toISOString();
      }
    }

    return profile;
  }

  /** Infer the ProfileDataType from a sample of non-null values. */
  private _inferType(values: any[]): ProfileDataType {
    if (values.length === 0) return 'null';

    const sampleSize = Math.min(values.length, 100);
    let numberCount = 0;
    let integerCount = 0;
    let booleanCount = 0;
    let dateCount = 0;
    let arrayCount = 0;
    let objectCount = 0;
    let stringCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const v = values[i];

      if (typeof v === 'boolean' || v === 'true' || v === 'false') {
        booleanCount++;
        continue;
      }

      if (Array.isArray(v)) {
        arrayCount++;
        continue;
      }

      if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
        objectCount++;
        continue;
      }

      if (typeof v === 'number' && !isNaN(v)) {
        numberCount++;
        if (Number.isInteger(v)) integerCount++;
        continue;
      }

      if (typeof v === 'string') {
        // Try number
        const num = Number(v);
        if (v !== '' && !isNaN(num)) {
          numberCount++;
          if (Number.isInteger(num) && !v.includes('.')) integerCount++;
          continue;
        }

        // Try date — require a minimum length to avoid false positives on
        // short numeric strings
        if (v.length >= 8) {
          const ts = Date.parse(v);
          if (!isNaN(ts)) {
            dateCount++;
            continue;
          }
        }

        stringCount++;
        continue;
      }

      if (v instanceof Date) {
        dateCount++;
        continue;
      }

      stringCount++;
    }

    const threshold = sampleSize * 0.8;

    if (booleanCount >= threshold) return 'boolean';
    if (arrayCount >= threshold) return 'array';
    if (objectCount >= threshold) return 'object';

    if (numberCount >= threshold) {
      if (integerCount >= numberCount * 0.9) return 'integer';
      return 'float';
    }

    if (dateCount >= threshold) {
      // Distinguish date from datetime by checking for time component
      let hasTime = 0;
      for (let i = 0; i < sampleSize; i++) {
        const s = String(values[i]);
        if (/[Tt ][\d]{1,2}:/.test(s)) hasTime++;
      }
      return hasTime >= dateCount * 0.5 ? 'datetime' : 'date';
    }

    if (stringCount >= threshold) return 'string';

    // Mixed types — fall back to the dominant type
    const counts = [
      { type: 'string' as ProfileDataType, count: stringCount },
      { type: 'number' as ProfileDataType, count: numberCount },
      { type: 'boolean' as ProfileDataType, count: booleanCount },
      { type: 'date' as ProfileDataType, count: dateCount },
      { type: 'array' as ProfileDataType, count: arrayCount },
      { type: 'object' as ProfileDataType, count: objectCount },
    ];
    counts.sort((a, b) => b.count - a.count);

    return counts[0].count > 0 ? counts[0].type : 'unknown';
  }

  /** Compute full numeric statistics for a sorted-safe array of numbers. */
  private _computeNumericStats(values: number[]): NumericStats {
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);

    // Basic aggregates
    const min = sorted[0];
    const max = sorted[n - 1];
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / n;

    // Median
    const median = this._percentile(sorted, 50);

    // Mode — value with highest frequency; null if all unique
    const freqMap = new Map<number, number>();
    let maxFreq = 0;
    let modeValue: number | null = null;
    for (const v of values) {
      const f = (freqMap.get(v) ?? 0) + 1;
      freqMap.set(v, f);
      if (f > maxFreq) {
        maxFreq = f;
        modeValue = v;
      }
    }
    if (maxFreq === 1) modeValue = null;

    // Variance & standard deviation (population)
    let sumSqDiff = 0;
    for (const v of values) {
      const diff = v - mean;
      sumSqDiff += diff * diff;
    }
    const variance = sumSqDiff / n;
    const standardDeviation = Math.sqrt(variance);

    // Skewness (Fisher's definition, sample-adjusted)
    let skewness = 0;
    if (n >= 3 && standardDeviation > 0) {
      let m3 = 0;
      for (const v of values) {
        m3 += Math.pow((v - mean) / standardDeviation, 3);
      }
      skewness = (n / ((n - 1) * (n - 2))) * m3;
    }

    // Kurtosis (excess kurtosis, sample-adjusted)
    let kurtosis = 0;
    if (n >= 4 && standardDeviation > 0) {
      let m4 = 0;
      for (const v of values) {
        m4 += Math.pow((v - mean) / standardDeviation, 4);
      }
      const rawKurt =
        ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4;
      const correction = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
      kurtosis = rawKurt - correction;
    }

    // Percentiles via linear interpolation
    const percentile25 = this._percentile(sorted, 25);
    const percentile75 = this._percentile(sorted, 75);
    const percentile90 = this._percentile(sorted, 90);
    const percentile95 = this._percentile(sorted, 95);
    const percentile99 = this._percentile(sorted, 99);

    // IQR and outliers (1.5 * IQR rule)
    const interquartileRange = percentile75 - percentile25;
    const lowerFence = percentile25 - 1.5 * interquartileRange;
    const upperFence = percentile75 + 1.5 * interquartileRange;
    let outlierCount = 0;
    for (const v of values) {
      if (v < lowerFence || v > upperFence) outlierCount++;
    }

    // Coefficient of variation
    const coefficientOfVariation = mean !== 0 ? standardDeviation / Math.abs(mean) : 0;

    return {
      min,
      max,
      mean,
      median,
      mode: modeValue,
      standardDeviation,
      variance,
      skewness,
      kurtosis,
      percentile25,
      percentile75,
      percentile90,
      percentile95,
      percentile99,
      sum,
      interquartileRange,
      coefficientOfVariation,
      outlierCount,
    };
  }

  /**
   * Compute the p-th percentile using linear interpolation.
   * Expects a pre-sorted ascending array.
   */
  private _percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    // Use the C = 1 variant (equivalent to Excel PERCENTILE.INC)
    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const fraction = rank - lower;

    if (lower === upper) return sorted[lower];
    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
  }

  /** Compute string length statistics. */
  private _computeStringLengthStats(lengths: number[]): StringLengthStats {
    const sorted = [...lengths].sort((a, b) => a - b);
    const n = lengths.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = lengths.reduce((s, v) => s + v, 0) / n;
    const median = this._percentile(sorted, 50);

    return { min, max, mean, median };
  }

  /** Return the top-N most frequent values as DistributionBuckets. */
  private _computeTopValues(
    frequencyMap: Map<string, number>,
    totalNonNull: number,
    limit: number,
  ): DistributionBucket[] {
    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({
        value,
        count,
        percentage: totalNonNull > 0 ? (count / totalNonNull) * 100 : 0,
      }));
  }

  /** Return the bottom-N least frequent values as DistributionBuckets. */
  private _computeBottomValues(
    frequencyMap: Map<string, number>,
    totalNonNull: number,
    limit: number,
  ): DistributionBucket[] {
    return Array.from(frequencyMap.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([value, count]) => ({
        value,
        count,
        percentage: totalNonNull > 0 ? (count / totalNonNull) * 100 : 0,
      }));
  }

  /**
   * Detect structural patterns by replacing letters with L,
   * digits with D, and keeping special characters as-is.
   */
  private _detectPatterns(
    values: any[],
    maxPatterns: number,
  ): PatternResult[] {
    const patternMap = new Map<string, { count: number; examples: string[] }>();

    for (const v of values) {
      const str = String(v);
      const pattern = str
        .replace(/[A-Za-z]/g, 'L')
        .replace(/[0-9]/g, 'D');

      const entry = patternMap.get(pattern);
      if (entry) {
        entry.count++;
        if (entry.examples.length < 3) {
          entry.examples.push(str);
        }
      } else {
        patternMap.set(pattern, { count: 1, examples: [str] });
      }
    }

    const totalNonNull = values.length;
    return Array.from(patternMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, maxPatterns)
      .map(([pattern, { count, examples }]) => ({
        pattern,
        count,
        percentage: totalNonNull > 0 ? (count / totalNonNull) * 100 : 0,
        examples,
      }));
  }

  /** Compute Shannon entropy of a set of values (in bits). */
  private _computeEntropy(values: any[]): number {
    if (values.length === 0) return 0;

    const freqMap = new Map<string, number>();
    for (const v of values) {
      const key = String(v);
      freqMap.set(key, (freqMap.get(key) ?? 0) + 1);
    }

    const n = values.length;
    let entropy = 0;
    for (const count of freqMap.values()) {
      const p = count / n;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  /**
   * Compute Pearson correlation coefficients between all pairs
   * of the given numeric columns. Only pairs meeting the
   * threshold are included in the result.
   */
  private _computeCorrelations(
    rows: Record<string, any>[],
    columns: string[],
    threshold: number,
  ): ColumnCorrelation[] {
    const correlations: ColumnCorrelation[] = [];

    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const col1 = columns[i];
        const col2 = columns[j];

        // Collect valid numeric pairs
        const xs: number[] = [];
        const ys: number[] = [];

        for (const row of rows) {
          const v1 = Number(row[col1]);
          const v2 = Number(row[col2]);
          if (!isNaN(v1) && !isNaN(v2)) {
            xs.push(v1);
            ys.push(v2);
          }
        }

        if (xs.length < 3) continue;

        const n = xs.length;
        const sumX = xs.reduce((s, v) => s + v, 0);
        const sumY = ys.reduce((s, v) => s + v, 0);
        const sumXY = xs.reduce((s, v, idx) => s + v * ys[idx], 0);
        const sumX2 = xs.reduce((s, v) => s + v * v, 0);
        const sumY2 = ys.reduce((s, v) => s + v * v, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt(
          (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
        );

        if (denominator === 0) continue;

        const coefficient = numerator / denominator;

        if (Math.abs(coefficient) >= threshold) {
          correlations.push({
            column1: col1,
            column2: col2,
            coefficient,
            type: 'pearson',
          });
        }
      }
    }

    // Sort by absolute coefficient descending
    correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

    return correlations;
  }

  /** Count how many rows are duplicates (total rows - unique rows). */
  private _countDuplicateRows(rows: Record<string, any>[]): number {
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(JSON.stringify(row));
    }
    return rows.length - seen.size;
  }
}
