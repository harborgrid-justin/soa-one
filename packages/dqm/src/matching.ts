// ============================================================
// SOA One DQM — Record Matching & Deduplication Engine
// ============================================================

import type {
  MatchAlgorithm,
  MatchFieldConfig,
  MatchRuleDefinition,
  MatchPair,
  FieldMatchScore,
  MatchResult,
  MatchCluster,
  DeduplicationResult,
  MergeStrategy,
} from './types';

import { generateId } from './profiler';

// ── Custom Matcher ──────────────────────────────────────────

/** Custom matcher function. Returns a similarity score between 0 and 1. */
export type CustomMatcher = (
  value1: any,
  value2: any,
  parameters?: Record<string, any>,
) => number;

// ── Record Matching Engine ──────────────────────────────────

/**
 * Matches and deduplicates records using configurable rules and
 * multiple matching algorithms.
 *
 * Supports 12 built-in algorithms: exact, levenshtein, jaro-winkler,
 * soundex, metaphone, double-metaphone, ngram, cosine, jaccard,
 * token-sort, token-set, and fuzzy.
 *
 * Usage:
 * ```ts
 * const engine = new RecordMatchingEngine();
 *
 * engine.registerRule({
 *   id: 'name-match',
 *   name: 'Name Matching',
 *   fields: [
 *     { name: 'firstName', algorithm: 'jaro-winkler', weight: 0.5, threshold: 0.8 },
 *     { name: 'lastName', algorithm: 'soundex', weight: 0.5, threshold: 0.7 },
 *   ],
 *   overallThreshold: 0.75,
 *   enabled: true,
 * });
 *
 * const result = engine.findMatches(records, 'name-match');
 * const deduped = engine.deduplicate(records, 'name-match');
 * ```
 */
export class RecordMatchingEngine {
  private readonly _rules = new Map<string, MatchRuleDefinition>();
  private readonly _customMatchers = new Map<string, CustomMatcher>();

  // ── Rule Management ─────────────────────────────────────

  /** Register a match rule. */
  registerRule(rule: MatchRuleDefinition): void {
    this._rules.set(rule.id, rule);
  }

  /** Unregister a match rule. */
  unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /** Get a match rule by ID. */
  getRule(ruleId: string): MatchRuleDefinition | undefined {
    return this._rules.get(ruleId);
  }

  /** Total registered rules. */
  get ruleCount(): number {
    return this._rules.size;
  }

  /** List all registered rules. */
  get rules(): MatchRuleDefinition[] {
    return Array.from(this._rules.values());
  }

  /** Register a custom matcher function. */
  registerMatcher(name: string, matcher: CustomMatcher): void {
    this._customMatchers.set(name, matcher);
  }

  // ── Matching ────────────────────────────────────────────

  /** Find all matching pairs in a set of records. */
  findMatches(
    records: Record<string, any>[],
    ruleId: string,
  ): MatchResult {
    const startTime = Date.now();
    const rule = this._rules.get(ruleId);
    if (!rule) {
      return {
        ruleId,
        ruleName: '',
        totalRecords: records.length,
        matchPairs: [],
        exactMatches: 0,
        probableMatches: 0,
        possibleMatches: 0,
        clusters: [],
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    const pairs: MatchPair[] = [];

    // Build blocking index when blocking fields are configured
    const blocks = this._buildBlocks(records, rule.blockingFields);

    for (const block of blocks) {
      for (let i = 0; i < block.length; i++) {
        for (let j = i + 1; j < block.length; j++) {
          const idx1 = block[i];
          const idx2 = block[j];
          const pair = this.compareRecords(records[idx1], records[idx2], rule);
          pair.record1Index = idx1;
          pair.record2Index = idx2;

          if (pair.matchType !== 'non-match') {
            pairs.push(pair);
          }
        }
      }
    }

    // Optionally limit results
    const limited = rule.maxResults
      ? pairs.sort((a, b) => b.overallScore - a.overallScore).slice(0, rule.maxResults)
      : pairs;

    const exactMatches = limited.filter((p) => p.matchType === 'exact').length;
    const probableMatches = limited.filter((p) => p.matchType === 'probable').length;
    const possibleMatches = limited.filter((p) => p.matchType === 'possible').length;

    const clusters = this._buildClusters(limited, records.length);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      totalRecords: records.length,
      matchPairs: limited,
      exactMatches,
      probableMatches,
      possibleMatches,
      clusters,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /** Deduplicate records using a match rule. */
  deduplicate(
    records: Record<string, any>[],
    ruleId: string,
  ): DeduplicationResult {
    const startTime = Date.now();
    const matchResult = this.findMatches(records, ruleId);
    const rule = this._rules.get(ruleId);
    const strategy: MergeStrategy = rule?.mergeStrategy ?? 'keep-most-complete';

    const clusters = matchResult.clusters;

    // Determine which record indices are part of duplicate clusters
    const clusteredIndices = new Set<number>();
    for (const cluster of clusters) {
      for (const idx of cluster.recordIndices) {
        clusteredIndices.add(idx);
      }
    }

    // Build survivor records
    const survivorRecords: Record<string, any>[] = [];

    // Add merged records from clusters
    for (const cluster of clusters) {
      cluster.masterIndex = this._selectMaster(cluster, records, strategy);
      const merged = this._mergeRecords(cluster, records, strategy);
      survivorRecords.push(merged);
    }

    // Add non-clustered (unique) records
    for (let i = 0; i < records.length; i++) {
      if (!clusteredIndices.has(i)) {
        survivorRecords.push({ ...records[i] });
      }
    }

    const totalDuplicates = records.length - survivorRecords.length;

    return {
      totalRecords: records.length,
      uniqueRecords: survivorRecords.length,
      duplicateGroups: clusters.length,
      totalDuplicates,
      clusters,
      survivorRecords,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /** Compare two records using a match rule. */
  compareRecords(
    record1: Record<string, any>,
    record2: Record<string, any>,
    rule: MatchRuleDefinition,
  ): MatchPair {
    const fieldScores: FieldMatchScore[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const fieldConfig of rule.fields) {
      const value1 = record1[fieldConfig.name];
      const value2 = record2[fieldConfig.name];
      const score = this.compareValues(value1, value2, fieldConfig);

      fieldScores.push({
        field: fieldConfig.name,
        score,
        algorithm: fieldConfig.algorithm,
        value1,
        value2,
      });

      weightedSum += score * fieldConfig.weight;
      totalWeight += fieldConfig.weight;
    }

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    let matchType: MatchPair['matchType'];
    if (overallScore >= 1.0) {
      matchType = 'exact';
    } else if (overallScore >= rule.overallThreshold) {
      matchType = 'probable';
    } else if (overallScore >= rule.overallThreshold * 0.8) {
      matchType = 'possible';
    } else {
      matchType = 'non-match';
    }

    return {
      record1Index: 0,
      record2Index: 0,
      overallScore,
      fieldScores,
      matchType,
    };
  }

  /** Compare two values using a field configuration. */
  compareValues(
    value1: any,
    value2: any,
    fieldConfig: MatchFieldConfig,
  ): number {
    // Handle nulls / undefined
    if (value1 == null && value2 == null) return 1;
    if (value1 == null || value2 == null) return 0;

    let v1 = String(value1);
    let v2 = String(value2);

    // Apply preprocessing
    if (fieldConfig.preProcess && fieldConfig.preProcess.length > 0) {
      v1 = this._preProcess(v1, fieldConfig.preProcess);
      v2 = this._preProcess(v2, fieldConfig.preProcess);
    }

    // Apply case sensitivity
    if (!fieldConfig.caseSensitive) {
      v1 = v1.toLowerCase();
      v2 = v2.toLowerCase();
    }

    const algorithm = fieldConfig.algorithm;
    const params = fieldConfig.parameters;

    switch (algorithm) {
      case 'exact':
        return this._exactMatch(v1, v2);
      case 'levenshtein':
        return this._levenshtein(v1, v2);
      case 'jaro-winkler':
        return this._jaroWinkler(v1, v2);
      case 'soundex':
        return this._soundex(v1, v2);
      case 'metaphone':
        return this._metaphone(v1, v2);
      case 'double-metaphone':
        return this._doubleMetaphone(v1, v2);
      case 'ngram':
        return this._ngramSimilarity(v1, v2, params?.n ?? 2);
      case 'cosine':
        return this._cosineSimilarity(v1, v2);
      case 'jaccard':
        return this._jaccardSimilarity(v1, v2);
      case 'token-sort':
        return this._tokenSortRatio(v1, v2);
      case 'token-set':
        return this._tokenSetRatio(v1, v2);
      case 'fuzzy':
        return this._fuzzyMatch(v1, v2);
      case 'custom': {
        const matcherName = params?.matcher as string | undefined;
        if (matcherName) {
          const matcher = this._customMatchers.get(matcherName);
          if (matcher) return matcher(value1, value2, params);
        }
        return 0;
      }
      default:
        return this._exactMatch(v1, v2);
    }
  }

  // ── Preprocessing ───────────────────────────────────────

  private _preProcess(value: any, steps: string[]): string {
    let result = String(value ?? '');
    for (const step of steps) {
      switch (step) {
        case 'trim':
          result = result.trim();
          break;
        case 'lowercase':
          result = result.toLowerCase();
          break;
        case 'remove-punctuation':
          result = result.replace(/[^\w\s]/g, '');
          break;
        case 'phonetic':
          result = RecordMatchingEngine.computeSoundex(result);
          break;
        default:
          break;
      }
    }
    return result;
  }

  // ── Algorithm Implementations ───────────────────────────

  private _exactMatch(v1: string, v2: string): number {
    return v1 === v2 ? 1 : 0;
  }

  private _levenshtein(v1: string, v2: string): number {
    if (v1 === v2) return 1;
    const maxLen = Math.max(v1.length, v2.length);
    if (maxLen === 0) return 1;
    const distance = RecordMatchingEngine.levenshteinDistance(v1, v2);
    return 1 - distance / maxLen;
  }

  private _jaroWinkler(v1: string, v2: string): number {
    if (v1 === v2) return 1;
    if (v1.length === 0 || v2.length === 0) return 0;

    const matchWindow = Math.max(0, Math.floor(Math.max(v1.length, v2.length) / 2) - 1);

    const s1Matches = new Array<boolean>(v1.length).fill(false);
    const s2Matches = new Array<boolean>(v2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < v1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, v2.length);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || v1[i] !== v2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < v1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (v1[i] !== v2[k]) transpositions++;
      k++;
    }

    const jaro =
      (matches / v1.length +
        matches / v2.length +
        (matches - transpositions / 2) / matches) /
      3;

    // Winkler prefix bonus (p = 0.1, max prefix length = 4)
    let prefixLen = 0;
    const maxPrefix = Math.min(4, Math.min(v1.length, v2.length));
    for (let i = 0; i < maxPrefix; i++) {
      if (v1[i] === v2[i]) {
        prefixLen++;
      } else {
        break;
      }
    }

    const p = 0.1;
    return jaro + prefixLen * p * (1 - jaro);
  }

  private _soundex(v1: string, v2: string): number {
    const code1 = RecordMatchingEngine.computeSoundex(v1);
    const code2 = RecordMatchingEngine.computeSoundex(v2);
    return code1 === code2 ? 1 : 0;
  }

  private _metaphone(v1: string, v2: string): number {
    const code1 = RecordMatchingEngine.computeMetaphone(v1);
    const code2 = RecordMatchingEngine.computeMetaphone(v2);
    return code1 === code2 ? 1 : 0;
  }

  private _doubleMetaphone(v1: string, v2: string): number {
    const [primary1, alternate1] = this._computeDoubleMetaphone(v1);
    const [primary2, alternate2] = this._computeDoubleMetaphone(v2);

    // Match if any combination of primary/alternate codes match
    if (primary1 === primary2) return 1;
    if (primary1 === alternate2) return 1;
    if (alternate1 === primary2) return 1;
    if (alternate1 !== '' && alternate2 !== '' && alternate1 === alternate2) return 1;
    return 0;
  }

  private _ngramSimilarity(v1: string, v2: string, n: number = 2): number {
    if (v1 === v2) return 1;
    if (v1.length < n && v2.length < n) return v1 === v2 ? 1 : 0;

    const ngrams1 = this._getNgrams(v1, n);
    const ngrams2 = this._getNgrams(v2, n);

    // Dice coefficient: 2 * |intersection| / (|A| + |B|)
    let intersection = 0;
    const counts2 = new Map<string, number>();
    for (const ng of ngrams2) {
      counts2.set(ng, (counts2.get(ng) ?? 0) + 1);
    }

    for (const ng of ngrams1) {
      const count = counts2.get(ng) ?? 0;
      if (count > 0) {
        intersection++;
        counts2.set(ng, count - 1);
      }
    }

    const totalNgrams = ngrams1.length + ngrams2.length;
    if (totalNgrams === 0) return 1;
    return (2 * intersection) / totalNgrams;
  }

  private _cosineSimilarity(v1: string, v2: string): number {
    if (v1 === v2) return 1;
    if (v1.length === 0 && v2.length === 0) return 1;
    if (v1.length === 0 || v2.length === 0) return 0;

    // Build character frequency vectors
    const chars = new Set<string>();
    for (const c of v1) chars.add(c);
    for (const c of v2) chars.add(c);

    const freq1 = new Map<string, number>();
    const freq2 = new Map<string, number>();

    for (const c of v1) {
      freq1.set(c, (freq1.get(c) ?? 0) + 1);
    }
    for (const c of v2) {
      freq2.set(c, (freq2.get(c) ?? 0) + 1);
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const c of chars) {
      const f1 = freq1.get(c) ?? 0;
      const f2 = freq2.get(c) ?? 0;
      dotProduct += f1 * f2;
      mag1 += f1 * f1;
      mag2 += f2 * f2;
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (magnitude === 0) return 0;
    return dotProduct / magnitude;
  }

  private _jaccardSimilarity(v1: string, v2: string): number {
    const tokens1 = new Set(v1.split(/\s+/).filter(Boolean));
    const tokens2 = new Set(v2.split(/\s+/).filter(Boolean));

    if (tokens1.size === 0 && tokens2.size === 0) return 1;

    let intersection = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) intersection++;
    }

    const union = tokens1.size + tokens2.size - intersection;
    if (union === 0) return 1;
    return intersection / union;
  }

  private _tokenSortRatio(v1: string, v2: string): number {
    const sorted1 = v1.split(/\s+/).filter(Boolean).sort().join(' ');
    const sorted2 = v2.split(/\s+/).filter(Boolean).sort().join(' ');
    return this._levenshtein(sorted1, sorted2);
  }

  private _tokenSetRatio(v1: string, v2: string): number {
    const tokens1 = v1.split(/\s+/).filter(Boolean);
    const tokens2 = v2.split(/\s+/).filter(Boolean);

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection: string[] = [];
    const diff1: string[] = [];
    const diff2: string[] = [];

    for (const t of set1) {
      if (set2.has(t)) {
        intersection.push(t);
      } else {
        diff1.push(t);
      }
    }
    for (const t of set2) {
      if (!set1.has(t)) {
        diff2.push(t);
      }
    }

    const intersectionStr = intersection.sort().join(' ');
    const combined1 = [intersectionStr, ...diff1.sort()].join(' ').trim();
    const combined2 = [intersectionStr, ...diff2.sort()].join(' ').trim();

    // Return max similarity across comparisons
    const score1 = this._levenshtein(intersectionStr, combined1);
    const score2 = this._levenshtein(intersectionStr, combined2);
    const score3 = this._levenshtein(combined1, combined2);

    return Math.max(score1, score2, score3);
  }

  private _fuzzyMatch(v1: string, v2: string): number {
    const lev = this._levenshtein(v1, v2);
    const jw = this._jaroWinkler(v1, v2);
    const ts = this._tokenSortRatio(v1, v2);
    return Math.max(lev, jw, ts);
  }

  // ── Static Utility Methods ──────────────────────────────

  /** Compute the Soundex code for a word. */
  static computeSoundex(word: string): string {
    const input = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (input.length === 0) return '0000';

    const first = input[0];

    const map: Record<string, string> = {
      B: '1', F: '1', P: '1', V: '1',
      C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
      D: '3', T: '3',
      L: '4',
      M: '5', N: '5',
      R: '6',
    };

    let code = first;
    let lastCode = map[first] ?? '0';

    for (let i = 1; i < input.length && code.length < 4; i++) {
      const ch = input[i];
      const mapped = map[ch];
      if (mapped && mapped !== lastCode) {
        code += mapped;
        lastCode = mapped;
      } else if (!mapped) {
        // Vowels and H/W/Y reset the last code for separation
        lastCode = '0';
      }
    }

    return (code + '0000').substring(0, 4);
  }

  /** Compute the basic Metaphone code for a word. */
  static computeMetaphone(word: string): string {
    let input = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (input.length === 0) return '';

    // Drop initial silent letter pairs
    const dropPairs = ['AE', 'GN', 'KN', 'PN', 'WR'];
    for (const pair of dropPairs) {
      if (input.startsWith(pair)) {
        input = input.substring(1);
        break;
      }
    }

    // Drop trailing MB -> M
    if (input.endsWith('MB')) {
      input = input.slice(0, -1);
    }

    let result = '';
    let i = 0;

    while (i < input.length && result.length < 6) {
      const ch = input[i];
      const next = i + 1 < input.length ? input[i + 1] : '';
      const next2 = i + 2 < input.length ? input[i + 2] : '';
      const prev = i > 0 ? input[i - 1] : '';

      // Skip duplicate adjacent letters (except C)
      if (ch === prev && ch !== 'C') {
        i++;
        continue;
      }

      switch (ch) {
        case 'A':
        case 'E':
        case 'I':
        case 'O':
        case 'U':
          if (i === 0) result += ch;
          i++;
          break;

        case 'B':
          result += 'B';
          i++;
          break;

        case 'C':
          if (next === 'I' || next === 'E' || next === 'Y') {
            if (next === 'I' && next2 === 'A') {
              result += 'X';
              i += 3;
            } else {
              result += 'S';
              i += 2;
            }
          } else if (next === 'H') {
            result += 'X';
            i += 2;
          } else {
            result += 'K';
            i++;
          }
          break;

        case 'D':
          if (next === 'G' && (next2 === 'I' || next2 === 'E' || next2 === 'Y')) {
            result += 'J';
            i += 2;
          } else {
            result += 'T';
            i++;
          }
          break;

        case 'F':
          result += 'F';
          i++;
          break;

        case 'G':
          if (next === 'H' && i + 2 < input.length && !'AEIOU'.includes(next2)) {
            // GH not followed by vowel — silent
            i += 2;
          } else if (next === 'N' && (i + 2 >= input.length || (i + 2 < input.length && input[i + 2] === 'E' && i + 3 >= input.length))) {
            // GN at end or GNE at end — silent G
            i++;
          } else if (prev === 'G') {
            i++;
          } else {
            if (next === 'I' || next === 'E' || next === 'Y') {
              result += 'J';
            } else {
              result += 'K';
            }
            i++;
          }
          break;

        case 'H':
          if ('AEIOU'.includes(next) && !'AEIOU'.includes(prev)) {
            result += 'H';
          }
          i++;
          break;

        case 'J':
          result += 'J';
          i++;
          break;

        case 'K':
          if (prev !== 'C') {
            result += 'K';
          }
          i++;
          break;

        case 'L':
          result += 'L';
          i++;
          break;

        case 'M':
          result += 'M';
          i++;
          break;

        case 'N':
          result += 'N';
          i++;
          break;

        case 'P':
          if (next === 'H') {
            result += 'F';
            i += 2;
          } else {
            result += 'P';
            i++;
          }
          break;

        case 'Q':
          result += 'K';
          i++;
          break;

        case 'R':
          result += 'R';
          i++;
          break;

        case 'S':
          if (next === 'H' || (next === 'I' && (next2 === 'O' || next2 === 'A'))) {
            result += 'X';
            i += 2;
          } else if (next === 'C' && next2 === 'H') {
            result += 'SK';
            i += 3;
          } else {
            result += 'S';
            i++;
          }
          break;

        case 'T':
          if (next === 'H') {
            result += '0';
            i += 2;
          } else if (next === 'I' && (next2 === 'O' || next2 === 'A')) {
            result += 'X';
            i += 2;
          } else {
            result += 'T';
            i++;
          }
          break;

        case 'V':
          result += 'F';
          i++;
          break;

        case 'W':
        case 'Y':
          if (next && 'AEIOU'.includes(next)) {
            result += ch;
            i++;
          } else {
            i++;
          }
          break;

        case 'X':
          result += 'KS';
          i++;
          break;

        case 'Z':
          result += 'S';
          i++;
          break;

        default:
          i++;
          break;
      }
    }

    return result;
  }

  /** Compute the raw Levenshtein edit distance between two strings. */
  static levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Use single-row optimisation
    let prev = new Array<number>(b.length + 1);
    let curr = new Array<number>(b.length + 1);

    for (let j = 0; j <= b.length; j++) {
      prev[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,       // deletion
          curr[j - 1] + 1,   // insertion
          prev[j - 1] + cost, // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[b.length];
  }

  // ── Double Metaphone (Private) ──────────────────────────

  private _computeDoubleMetaphone(word: string): [string, string] {
    const input = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (input.length === 0) return ['', ''];

    const primary = RecordMatchingEngine.computeMetaphone(word);

    // Generate alternate code with vowel-sensitive variant
    let alternate = '';
    let i = 0;
    const len = input.length;

    while (i < len && alternate.length < 6) {
      const ch = input[i];
      const next = i + 1 < len ? input[i + 1] : '';

      switch (ch) {
        case 'C':
          if (next === 'I' || next === 'E' || next === 'Y') {
            alternate += 'S';
            i += 2;
          } else if (next === 'H') {
            alternate += 'K'; // Alternate: K instead of X
            i += 2;
          } else {
            alternate += 'K';
            i++;
          }
          break;

        case 'G':
          if (next === 'I' || next === 'E' || next === 'Y') {
            alternate += 'K'; // Alternate: K instead of J
          } else {
            alternate += 'K';
          }
          i++;
          break;

        case 'P':
          if (next === 'H') {
            alternate += 'F';
            i += 2;
          } else {
            alternate += 'P';
            i++;
          }
          break;

        case 'S':
          if (next === 'H') {
            alternate += 'S'; // Alternate: S instead of X
            i += 2;
          } else {
            alternate += 'S';
            i++;
          }
          break;

        case 'T':
          if (next === 'H') {
            alternate += 'T'; // Alternate: T instead of 0
            i += 2;
          } else {
            alternate += 'T';
            i++;
          }
          break;

        case 'X':
          alternate += 'S'; // Alternate: S instead of KS
          i++;
          break;

        case 'A':
        case 'E':
        case 'I':
        case 'O':
        case 'U':
          if (i === 0) alternate += ch;
          i++;
          break;

        default:
          // For other consonants, reuse primary logic
          if ('BDFHJKLMNQRVWYZ'.includes(ch)) {
            const mapped: Record<string, string> = {
              B: 'B', D: 'T', F: 'F', H: 'H', J: 'J',
              K: 'K', L: 'L', M: 'M', N: 'N', Q: 'K',
              R: 'R', V: 'F', W: 'W', Y: 'Y', Z: 'S',
            };
            const code = mapped[ch];
            if (code) alternate += code;
          }
          i++;
          break;
      }
    }

    return [primary, alternate || primary];
  }

  // ── N-gram Helper ───────────────────────────────────────

  private _getNgrams(value: string, n: number): string[] {
    const ngrams: string[] = [];
    if (value.length < n) {
      ngrams.push(value);
      return ngrams;
    }
    for (let i = 0; i <= value.length - n; i++) {
      ngrams.push(value.substring(i, i + n));
    }
    return ngrams;
  }

  // ── Blocking ────────────────────────────────────────────

  private _buildBlocks(
    records: Record<string, any>[],
    blockingFields?: string[],
  ): number[][] {
    if (!blockingFields || blockingFields.length === 0) {
      // No blocking — single block with all record indices
      const allIndices: number[] = [];
      for (let i = 0; i < records.length; i++) {
        allIndices.push(i);
      }
      return [allIndices];
    }

    // Group records by blocking key
    const blocks = new Map<string, number[]>();
    for (let i = 0; i < records.length; i++) {
      const key = blockingFields
        .map((f) => String(records[i][f] ?? '').toLowerCase().trim())
        .join('|');
      const block = blocks.get(key);
      if (block) {
        block.push(i);
      } else {
        blocks.set(key, [i]);
      }
    }

    // Only return blocks with more than one record
    return Array.from(blocks.values()).filter((b) => b.length > 1);
  }

  // ── Clustering (Union-Find) ─────────────────────────────

  private _buildClusters(
    pairs: MatchPair[],
    totalRecords: number,
  ): MatchCluster[] {
    if (pairs.length === 0) return [];

    // Union-Find data structure
    const parent = new Array<number>(totalRecords);
    const rank = new Array<number>(totalRecords);
    for (let i = 0; i < totalRecords; i++) {
      parent[i] = i;
      rank[i] = 0;
    }

    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]]; // Path compression
        x = parent[x];
      }
      return x;
    };

    const union = (x: number, y: number): void => {
      const rx = find(x);
      const ry = find(y);
      if (rx === ry) return;
      if (rank[rx] < rank[ry]) {
        parent[rx] = ry;
      } else if (rank[rx] > rank[ry]) {
        parent[ry] = rx;
      } else {
        parent[ry] = rx;
        rank[rx]++;
      }
    };

    // Union all matched pairs
    for (const pair of pairs) {
      union(pair.record1Index, pair.record2Index);
    }

    // Collect clusters
    const clusterMap = new Map<number, number[]>();
    const involvedIndices = new Set<number>();
    for (const pair of pairs) {
      involvedIndices.add(pair.record1Index);
      involvedIndices.add(pair.record2Index);
    }

    for (const idx of involvedIndices) {
      const root = find(idx);
      const members = clusterMap.get(root);
      if (members) {
        members.push(idx);
      } else {
        clusterMap.set(root, [idx]);
      }
    }

    // Build cluster objects
    const clusters: MatchCluster[] = [];
    for (const [, members] of clusterMap) {
      if (members.length < 2) continue;

      // Deduplicate and sort member indices
      const uniqueMembers = Array.from(new Set(members)).sort((a, b) => a - b);

      // Calculate cluster confidence as average pair score
      let totalScore = 0;
      let pairCount = 0;
      for (const pair of pairs) {
        if (
          uniqueMembers.includes(pair.record1Index) &&
          uniqueMembers.includes(pair.record2Index)
        ) {
          totalScore += pair.overallScore;
          pairCount++;
        }
      }

      clusters.push({
        id: generateId(),
        recordIndices: uniqueMembers,
        masterIndex: uniqueMembers[0],
        confidence: pairCount > 0 ? totalScore / pairCount : 0,
      });
    }

    return clusters.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Master Selection ────────────────────────────────────

  private _selectMaster(
    cluster: MatchCluster,
    records: Record<string, any>[],
    strategy: MergeStrategy,
  ): number {
    const indices = cluster.recordIndices;

    switch (strategy) {
      case 'keep-first':
        return indices[0];

      case 'keep-last':
        return indices[indices.length - 1];

      case 'keep-most-complete': {
        let bestIdx = indices[0];
        let bestCount = 0;
        for (const idx of indices) {
          const record = records[idx];
          const nonNullCount = Object.values(record).filter(
            (v) => v !== null && v !== undefined && v !== '',
          ).length;
          if (nonNullCount > bestCount) {
            bestCount = nonNullCount;
            bestIdx = idx;
          }
        }
        return bestIdx;
      }

      case 'keep-most-recent': {
        let bestIdx = indices[0];
        let bestDate = 0;
        for (const idx of indices) {
          const record = records[idx];
          // Look for common date fields
          const dateFields = [
            'updatedAt', 'updated_at', 'modifiedAt', 'modified_at',
            'createdAt', 'created_at', 'date', 'timestamp',
          ];
          for (const field of dateFields) {
            if (record[field]) {
              const ts = new Date(record[field]).getTime();
              if (!isNaN(ts) && ts > bestDate) {
                bestDate = ts;
                bestIdx = idx;
              }
            }
          }
        }
        return bestIdx;
      }

      case 'manual':
      case 'custom':
      default:
        return indices[0];
    }
  }

  // ── Record Merging ──────────────────────────────────────

  private _mergeRecords(
    cluster: MatchCluster,
    records: Record<string, any>[],
    strategy: MergeStrategy,
  ): Record<string, any> {
    const indices = cluster.recordIndices;
    const masterIdx = cluster.masterIndex;
    const master = records[masterIdx];

    switch (strategy) {
      case 'keep-first':
      case 'keep-last':
      case 'keep-most-recent':
      case 'manual':
      case 'custom':
        return { ...master };

      case 'keep-most-complete': {
        // Start with master, fill in gaps from other records
        const merged = { ...master };

        // Collect all possible keys
        const allKeys = new Set<string>();
        for (const idx of indices) {
          for (const key of Object.keys(records[idx])) {
            allKeys.add(key);
          }
        }

        for (const key of allKeys) {
          if (
            merged[key] === null ||
            merged[key] === undefined ||
            merged[key] === ''
          ) {
            // Try to fill from other records in the cluster
            for (const idx of indices) {
              const val = records[idx][key];
              if (val !== null && val !== undefined && val !== '') {
                merged[key] = val;
                break;
              }
            }
          }
        }

        return merged;
      }

      default:
        return { ...master };
    }
  }
}
