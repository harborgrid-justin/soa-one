// ============================================================
// SOA One DQM — Comprehensive Tests
// ============================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Core
  generateId,

  // Profiling
  DataProfiler,

  // Quality Rules
  QualityRuleEngine,

  // Cleansing
  DataCleansingEngine,

  // Scoring
  QualityScoringEngine,

  // Record Matching
  RecordMatchingEngine,

  // Messaging
  MessagingService,

  // Monitoring
  DQMMonitoringManager,

  // Security
  DQMSecurityManager,

  // Orchestrator
  DataQualityMessaging,

  // Plugin
  createDQMPlugin,
} from './index';

import type {
  QualityRuleDefinition,
  QualityRuleResult,
  CleansingRuleDefinition,
  MatchRuleDefinition,
} from './types';

// ════════════════════════════════════════════════════════════
// generateId TESTS
// ════════════════════════════════════════════════════════════

describe('generateId', () => {
  it('should generate IDs with dqm_ prefix', () => {
    const id = generateId();
    assert.ok(id.startsWith('dqm_'), `Expected ID to start with "dqm_", got: ${id}`);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId());
    assert.equal(ids.size, 100);
  });
});

// ════════════════════════════════════════════════════════════
// DataProfiler TESTS
// ════════════════════════════════════════════════════════════

describe('DataProfiler', () => {
  let profiler: DataProfiler;

  beforeEach(() => {
    profiler = new DataProfiler();
  });

  it('should profile a column with numeric data', () => {
    const values = [10, 20, 30, 40, 50];
    const profile = profiler.profileColumn('age', values);

    assert.equal(profile.name, 'age');
    assert.ok(profile.numericStats, 'Expected numericStats to be defined');
    assert.equal(profile.numericStats!.min, 10);
    assert.equal(profile.numericStats!.max, 50);
    assert.equal(profile.numericStats!.mean, 30);
  });

  it('should profile a column with string data', () => {
    const values = ['alice@test.com', 'bob@test.com', 'carol@test.com', 'alice@test.com'];
    const profile = profiler.profileColumn('email', values);

    assert.equal(profile.name, 'email');
    assert.equal(profile.inferredType, 'string');
    assert.equal(profile.distinctCount, 3);
    assert.ok(profile.patterns.length > 0, 'Expected patterns to be detected');
  });

  it('should profile a dataset', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Carol', age: 35 },
    ];
    const dataset = profiler.profileDataset('users', rows);

    assert.equal(dataset.totalRows, 3);
    assert.equal(dataset.totalColumns, 2);
    assert.equal(dataset.columns.length, 2);
    assert.ok(dataset.id.startsWith('dqm_'));
  });

  it('should detect null values and compute completeness', () => {
    const values = ['hello', null, 'world', undefined, 'test'];
    const profile = profiler.profileColumn('data', values);

    assert.equal(profile.nullCount, 2);
    assert.equal(profile.completeness, 60); // 3/5 = 60%
    assert.equal(profile.totalValues, 5);
  });

  it('should compute entropy', () => {
    // All identical values => entropy should be 0
    const uniformValues = ['a', 'a', 'a', 'a'];
    const uniformProfile = profiler.profileColumn('uniform', uniformValues);
    assert.equal(uniformProfile.entropy, 0);

    // Two distinct values with equal frequency => entropy = 1 bit
    const binaryValues = ['a', 'b', 'a', 'b'];
    const binaryProfile = profiler.profileColumn('binary', binaryValues);
    assert.ok(Math.abs(binaryProfile.entropy - 1.0) < 0.001);
  });

  it('should detect duplicate rows', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Alice', age: 30 }, // duplicate
    ];
    const dataset = profiler.profileDataset('users', rows);

    assert.equal(dataset.duplicateRowCount, 1);
    assert.ok(dataset.duplicateRowPercentage > 0);
  });
});

// ════════════════════════════════════════════════════════════
// QualityRuleEngine TESTS
// ════════════════════════════════════════════════════════════

describe('QualityRuleEngine', () => {
  let engine: QualityRuleEngine;

  beforeEach(() => {
    engine = new QualityRuleEngine();
  });

  it('should register and retrieve rules', () => {
    const rule: QualityRuleDefinition = {
      id: 'r1',
      name: 'Not Null',
      type: 'not-null',
      severity: 'high',
      evaluationMode: 'row',
      column: 'name',
      enabled: true,
    };
    engine.registerRule(rule);

    assert.equal(engine.ruleCount, 1);
    const retrieved = engine.getRule('r1');
    assert.ok(retrieved);
    assert.equal(retrieved!.name, 'Not Null');
  });

  it('should evaluate not-null rule', () => {
    engine.registerRule({
      id: 'nn1',
      name: 'Name Not Null',
      type: 'not-null',
      severity: 'high',
      evaluationMode: 'row',
      column: 'name',
      enabled: true,
    });

    const rows = [
      { name: 'Alice' },
      { name: null },
      { name: 'Carol' },
    ];
    const result = engine.evaluateRule(engine.getRule('nn1')!, rows);

    assert.equal(result.passed, false);
    assert.equal(result.failedRows, 1);
    assert.equal(result.passedRows, 2);
  });

  it('should evaluate range rule', () => {
    engine.registerRule({
      id: 'rng1',
      name: 'Age Range',
      type: 'range',
      severity: 'medium',
      evaluationMode: 'row',
      column: 'age',
      parameters: { min: 18, max: 65 },
      enabled: true,
    });

    const rows = [
      { age: 25 },
      { age: 10 },  // below min
      { age: 70 },  // above max
      { age: 40 },
    ];
    const result = engine.evaluateRule(engine.getRule('rng1')!, rows);

    assert.equal(result.failedRows, 2);
    assert.equal(result.passedRows, 2);
  });

  it('should evaluate pattern rule (email regex)', () => {
    engine.registerRule({
      id: 'pat1',
      name: 'Email Pattern',
      type: 'pattern',
      severity: 'high',
      evaluationMode: 'row',
      column: 'email',
      parameters: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      enabled: true,
    });

    const rows = [
      { email: 'alice@example.com' },
      { email: 'not-an-email' },
      { email: 'bob@test.org' },
    ];
    const result = engine.evaluateRule(engine.getRule('pat1')!, rows);

    assert.equal(result.failedRows, 1);
    assert.equal(result.passedRows, 2);
  });

  it('should evaluate format rule (email format)', () => {
    engine.registerRule({
      id: 'fmt1',
      name: 'Email Format',
      type: 'format',
      severity: 'high',
      evaluationMode: 'row',
      column: 'email',
      parameters: { format: 'email' },
      enabled: true,
    });

    const rows = [
      { email: 'alice@example.com' },
      { email: 'bad@@email' },
      { email: 'bob@test.org' },
    ];
    const result = engine.evaluateRule(engine.getRule('fmt1')!, rows);

    assert.equal(result.passedRows, 2);
    assert.equal(result.failedRows, 1);
  });

  it('should evaluate domain rule (allowed values)', () => {
    engine.registerRule({
      id: 'dom1',
      name: 'Status Domain',
      type: 'domain',
      severity: 'medium',
      evaluationMode: 'row',
      column: 'status',
      parameters: { allowedValues: ['active', 'inactive', 'pending'] },
      enabled: true,
    });

    const rows = [
      { status: 'active' },
      { status: 'deleted' },  // not allowed
      { status: 'pending' },
    ];
    const result = engine.evaluateRule(engine.getRule('dom1')!, rows);

    assert.equal(result.failedRows, 1);
    assert.equal(result.passedRows, 2);
  });

  it('should evaluate cross-field rule', () => {
    engine.registerRule({
      id: 'cf1',
      name: 'Start Before End',
      type: 'cross-field',
      severity: 'high',
      evaluationMode: 'row',
      column: 'startDate',
      parameters: {
        field1: 'startDate',
        field2: 'endDate',
        comparison: '<',
      },
      enabled: true,
    });

    const rows = [
      { startDate: 1, endDate: 10 },   // valid
      { startDate: 10, endDate: 5 },    // invalid
      { startDate: 3, endDate: 7 },     // valid
    ];
    const result = engine.evaluateRule(engine.getRule('cf1')!, rows);

    assert.equal(result.failedRows, 1);
    assert.equal(result.passedRows, 2);
  });

  it('should batch evaluate all rules (evaluateAll)', () => {
    engine.registerRule({
      id: 'b1',
      name: 'Name Not Null',
      type: 'not-null',
      severity: 'high',
      evaluationMode: 'row',
      column: 'name',
      enabled: true,
    });
    engine.registerRule({
      id: 'b2',
      name: 'Age Range',
      type: 'range',
      severity: 'medium',
      evaluationMode: 'row',
      column: 'age',
      parameters: { min: 0, max: 150 },
      enabled: true,
    });

    const rows = [
      { name: 'Alice', age: 30 },
      { name: null, age: 200 },
    ];
    const validation = engine.evaluateAll(rows);

    assert.equal(validation.totalRules, 2);
    assert.ok(validation.results.length === 2);
    assert.ok(validation.totalViolations >= 2);
    assert.ok(validation.overallPassRate < 1);
    assert.ok(validation.executionTimeMs >= 0);
  });
});

// ════════════════════════════════════════════════════════════
// DataCleansingEngine TESTS
// ════════════════════════════════════════════════════════════

describe('DataCleansingEngine', () => {
  let engine: DataCleansingEngine;

  beforeEach(() => {
    engine = new DataCleansingEngine();
  });

  it('should register and apply trim rule', () => {
    engine.registerRule({
      id: 'trim1',
      name: 'Trim Names',
      type: 'trim',
      column: 'name',
      enabled: true,
      priority: 1,
    });

    const result = engine.cleanseRow({ name: '  Alice  ' });
    assert.equal(result.name, 'Alice');
  });

  it('should apply uppercase/lowercase rules', () => {
    engine.registerRule({
      id: 'up1',
      name: 'Uppercase Code',
      type: 'uppercase',
      column: 'code',
      enabled: true,
      priority: 1,
    });

    const upper = engine.cleanseRow({ code: 'hello' });
    assert.equal(upper.code, 'HELLO');

    // Test lowercase separately
    const engine2 = new DataCleansingEngine();
    engine2.registerRule({
      id: 'lo1',
      name: 'Lowercase Email',
      type: 'lowercase',
      column: 'email',
      enabled: true,
      priority: 1,
    });

    const lower = engine2.cleanseRow({ email: 'ALICE@EXAMPLE.COM' });
    assert.equal(lower.email, 'alice@example.com');
  });

  it('should apply title-case', () => {
    engine.registerRule({
      id: 'tc1',
      name: 'Title Case Name',
      type: 'title-case',
      column: 'name',
      enabled: true,
      priority: 1,
    });

    const result = engine.cleanseRow({ name: 'alice wonderland' });
    assert.equal(result.name, 'Alice Wonderland');
  });

  it('should apply regex-replace', () => {
    engine.registerRule({
      id: 'rx1',
      name: 'Strip Non-Alpha',
      type: 'regex-replace',
      column: 'value',
      enabled: true,
      priority: 1,
      parameters: {
        pattern: '[^a-zA-Z]',
        replacement: '',
        flags: 'g',
      },
    });

    const result = engine.cleanseRow({ value: 'abc-123-def' });
    assert.equal(result.value, 'abcdef');
  });

  it('should apply phone normalization', () => {
    engine.registerRule({
      id: 'ph1',
      name: 'Phone Normalize',
      type: 'phone-normalize',
      column: 'phone',
      enabled: true,
      priority: 1,
    });

    const result = engine.cleanseRow({ phone: '(555) 123-4567' });
    assert.equal(result.phone, '+15551234567');
  });

  it('should apply email normalization', () => {
    engine.registerRule({
      id: 'em1',
      name: 'Email Normalize',
      type: 'email-normalize',
      column: 'email',
      enabled: true,
      priority: 1,
    });

    const result = engine.cleanseRow({ email: '  Alice@Example.COM  ' });
    assert.equal(result.email, 'alice@example.com');
  });

  it('should cleanse a dataset batch', () => {
    engine.registerRule({
      id: 'bt1',
      name: 'Trim Names',
      type: 'trim',
      column: 'name',
      enabled: true,
      priority: 1,
    });

    const rows = [
      { name: '  Alice  ' },
      { name: '  Bob  ' },
      { name: '  Carol  ' },
    ];
    const { rows: cleansed, result } = engine.cleanseDataset(rows);

    assert.equal(cleansed.length, 3);
    assert.equal(cleansed[0].name, 'Alice');
    assert.equal(cleansed[1].name, 'Bob');
    assert.equal(cleansed[2].name, 'Carol');
    assert.equal(result.totalRules, 1);
    assert.equal(result.results[0].modifiedRows, 3);
    assert.ok(result.executionTimeMs >= 0);
  });
});

// ════════════════════════════════════════════════════════════
// QualityScoringEngine TESTS
// ════════════════════════════════════════════════════════════

describe('QualityScoringEngine', () => {
  let engine: QualityScoringEngine;

  beforeEach(() => {
    engine = new QualityScoringEngine();
  });

  it('should calculate score from rule results', () => {
    const results: QualityRuleResult[] = [
      {
        ruleId: 'r1',
        ruleName: 'Not Null',
        ruleType: 'not-null',
        passed: true,
        severity: 'high',
        totalRows: 10,
        passedRows: 10,
        failedRows: 0,
        passRate: 1.0,
        violations: [],
        executionTimeMs: 1,
        timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r2',
        ruleName: 'Range Check',
        ruleType: 'range',
        passed: true,
        severity: 'medium',
        totalRows: 10,
        passedRows: 10,
        failedRows: 0,
        passRate: 1.0,
        violations: [],
        executionTimeMs: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const score = engine.calculateScore(results, 'test-dataset');

    assert.ok(score.overall > 0, 'Expected score to be > 0');
    assert.equal(score.totalRules, 2);
    assert.equal(score.passedRules, 2);
    assert.equal(score.failedRules, 0);
    assert.ok(score.scoredAt);
  });

  it('should assign correct grade (A/B/C/D/F)', () => {
    // All passing => should get A (score >= 90)
    const allPassing: QualityRuleResult[] = [
      {
        ruleId: 'r1', ruleName: 'Test', ruleType: 'not-null',
        passed: true, severity: 'high',
        totalRows: 10, passedRows: 10, failedRows: 0,
        passRate: 1.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
    ];
    const scoreA = engine.calculateScore(allPassing, 'test');
    assert.equal(scoreA.grade, 'A');

    // Create a fresh engine with all-failing rules across every dimension to get F
    const engine2 = new QualityScoringEngine();
    const allFailing: QualityRuleResult[] = [
      {
        ruleId: 'r1', ruleName: 'Not Null', ruleType: 'not-null',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r2', ruleName: 'Pattern', ruleType: 'pattern',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r3', ruleName: 'Range', ruleType: 'range',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r4', ruleName: 'Consistency', ruleType: 'consistency',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r5', ruleName: 'Unique', ruleType: 'unique',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r6', ruleName: 'Timeliness', ruleType: 'timeliness',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r7', ruleName: 'Referential', ruleType: 'referential',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
      {
        ruleId: 'r8', ruleName: 'Accuracy', ruleType: 'accuracy',
        passed: false, severity: 'critical',
        totalRows: 10, passedRows: 0, failedRows: 10,
        passRate: 0.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
    ];
    const scoreF = engine2.calculateScore(allFailing, 'test');
    assert.equal(scoreF.grade, 'F');
  });

  it('should track score history', () => {
    const makeResults = (passRate: number): QualityRuleResult[] => [
      {
        ruleId: 'r1', ruleName: 'Test', ruleType: 'not-null',
        passed: passRate >= 1, severity: 'high',
        totalRows: 10, passedRows: Math.round(10 * passRate),
        failedRows: 10 - Math.round(10 * passRate),
        passRate, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
    ];

    engine.calculateScore(makeResults(0.8), 'dataset-1');
    engine.calculateScore(makeResults(0.9), 'dataset-2');

    assert.equal(engine.history.length, 2);
    assert.equal(engine.history[0].datasetName, 'dataset-1');
    assert.equal(engine.history[1].datasetName, 'dataset-2');
  });

  it('should determine trend (improving/stable/degrading)', () => {
    // Needs >= 2 history entries
    assert.equal(engine.trend, 'stable'); // No history => stable

    const makeResults = (passRate: number): QualityRuleResult[] => [
      {
        ruleId: 'r1', ruleName: 'Test', ruleType: 'not-null',
        passed: passRate >= 1, severity: 'high',
        totalRows: 10, passedRows: Math.round(10 * passRate),
        failedRows: 10 - Math.round(10 * passRate),
        passRate, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
    ];

    // Build improving trend: lower score followed by higher score
    engine.calculateScore(makeResults(0.5), 'ds1');
    engine.calculateScore(makeResults(0.6), 'ds2');
    const score3 = engine.calculateScore(makeResults(0.9), 'ds3');

    assert.equal(score3.trend, 'improving');
  });

  it('should respect dimension weights', () => {
    const customEngine = new QualityScoringEngine([
      { dimension: 'completeness', weight: 1.0 },
      { dimension: 'accuracy', weight: 0.0 },
      { dimension: 'consistency', weight: 0.0 },
      { dimension: 'timeliness', weight: 0.0 },
      { dimension: 'uniqueness', weight: 0.0 },
      { dimension: 'validity', weight: 0.0 },
      { dimension: 'integrity', weight: 0.0 },
      { dimension: 'conformity', weight: 0.0 },
    ]);

    assert.equal(customEngine.getWeight('completeness'), 1.0);
    assert.equal(customEngine.getWeight('accuracy'), 0.0);

    // With completeness weighted 100% and a passing completeness rule
    const results: QualityRuleResult[] = [
      {
        ruleId: 'r1', ruleName: 'Not Null', ruleType: 'not-null',
        passed: true, severity: 'high',
        totalRows: 10, passedRows: 10, failedRows: 0,
        passRate: 1.0, violations: [],
        executionTimeMs: 1, timestamp: new Date().toISOString(),
      },
    ];
    const score = customEngine.calculateScore(results, 'test');
    assert.equal(score.overall, 100);
  });
});

// ════════════════════════════════════════════════════════════
// RecordMatchingEngine TESTS
// ════════════════════════════════════════════════════════════

describe('RecordMatchingEngine', () => {
  let engine: RecordMatchingEngine;

  beforeEach(() => {
    engine = new RecordMatchingEngine();
  });

  it('should register and retrieve match rules', () => {
    const rule: MatchRuleDefinition = {
      id: 'mr1',
      name: 'Name Match',
      fields: [
        { name: 'firstName', algorithm: 'exact', weight: 1.0, threshold: 0.8 },
      ],
      overallThreshold: 0.8,
      enabled: true,
    };
    engine.registerRule(rule);

    assert.equal(engine.ruleCount, 1);
    const retrieved = engine.getRule('mr1');
    assert.ok(retrieved);
    assert.equal(retrieved!.name, 'Name Match');
  });

  it('should do exact matching', () => {
    engine.registerRule({
      id: 'exact1',
      name: 'Exact Name',
      fields: [
        { name: 'name', algorithm: 'exact', weight: 1.0, threshold: 1.0 },
      ],
      overallThreshold: 1.0,
      enabled: true,
    });

    const records = [
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Alice' },
    ];
    const result = engine.findMatches(records, 'exact1');

    assert.ok(result.matchPairs.length >= 1);
    assert.equal(result.matchPairs[0].matchType, 'exact');
    assert.equal(result.matchPairs[0].overallScore, 1.0);
  });

  it('should compute Levenshtein similarity', () => {
    const rule: MatchRuleDefinition = {
      id: 'lev1',
      name: 'Levenshtein',
      fields: [
        { name: 'name', algorithm: 'levenshtein', weight: 1.0, threshold: 0.5 },
      ],
      overallThreshold: 0.5,
      enabled: true,
    };

    const pair = engine.compareRecords(
      { name: 'kitten' },
      { name: 'sitting' },
      rule,
    );

    // Levenshtein distance between kitten/sitting is 3, max length 7
    // Similarity = 1 - 3/7 ~ 0.571
    assert.ok(pair.overallScore > 0.5);
    assert.ok(pair.overallScore < 0.7);
  });

  it('should compute Jaro-Winkler similarity', () => {
    const rule: MatchRuleDefinition = {
      id: 'jw1',
      name: 'Jaro-Winkler',
      fields: [
        { name: 'name', algorithm: 'jaro-winkler', weight: 1.0, threshold: 0.5 },
      ],
      overallThreshold: 0.5,
      enabled: true,
    };

    // Similar strings with common prefix should score high
    const pair = engine.compareRecords(
      { name: 'MARTHA' },
      { name: 'MARHTA' },
      rule,
    );

    assert.ok(pair.overallScore > 0.9, `Expected > 0.9, got ${pair.overallScore}`);
  });

  it('should find matches in a record set', () => {
    engine.registerRule({
      id: 'fm1',
      name: 'Fuzzy Name Match',
      fields: [
        { name: 'name', algorithm: 'levenshtein', weight: 1.0, threshold: 0.7 },
      ],
      overallThreshold: 0.7,
      enabled: true,
    });

    const records = [
      { name: 'John Smith' },
      { name: 'Jon Smith' },
      { name: 'Jane Doe' },
      { name: 'John Smyth' },
    ];
    const result = engine.findMatches(records, 'fm1');

    assert.equal(result.totalRecords, 4);
    assert.ok(result.matchPairs.length >= 1, 'Expected at least one match pair');
  });

  it('should deduplicate records', () => {
    engine.registerRule({
      id: 'dd1',
      name: 'Exact Dedup',
      fields: [
        { name: 'name', algorithm: 'exact', weight: 0.5, threshold: 1.0 },
        { name: 'email', algorithm: 'exact', weight: 0.5, threshold: 1.0 },
      ],
      overallThreshold: 1.0,
      enabled: true,
    });

    const records = [
      { name: 'Alice', email: 'alice@test.com' },
      { name: 'Bob', email: 'bob@test.com' },
      { name: 'Alice', email: 'alice@test.com' },  // exact duplicate
    ];
    const dedup = engine.deduplicate(records, 'dd1');

    assert.equal(dedup.totalRecords, 3);
    assert.equal(dedup.uniqueRecords, 2);
    assert.equal(dedup.totalDuplicates, 1);
    assert.equal(dedup.survivorRecords.length, 2);
  });
});

// ════════════════════════════════════════════════════════════
// MessagingService TESTS
// ════════════════════════════════════════════════════════════

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(() => {
    service = new MessagingService();
  });

  it('should create topics and queues', () => {
    service.createTopic({ name: 'events', type: 'standard' });
    service.createQueue({ name: 'tasks', type: 'standard' });

    assert.equal(service.topicCount, 1);
    assert.equal(service.queueCount, 1);
    assert.ok(service.getTopic('events'));
    assert.ok(service.getQueue('tasks'));
  });

  it('should publish to topic and receive via subscription', () => {
    service.createTopic({ name: 'orders', type: 'standard' });

    const received: any[] = [];
    service.subscribe('orders', {
      id: 'sub-order-handler',
      topic: 'orders',
      name: 'order-handler',
      type: 'exclusive',
    }, (msg) => {
      received.push(msg);
    });

    service.publish('orders', { orderId: '123' });

    assert.equal(received.length, 1);
    assert.equal(received[0].body.orderId, '123');
  });

  it('should enqueue and dequeue from queue', () => {
    service.createQueue({ name: 'jobs', type: 'standard' });

    service.enqueue('jobs', { task: 'process-1' });
    service.enqueue('jobs', { task: 'process-2' });

    const queue = service.getQueue('jobs')!;
    const msg1 = queue.dequeue();
    const msg2 = queue.dequeue();
    const msg3 = queue.dequeue();

    assert.ok(msg1);
    assert.equal(msg1!.body.task, 'process-1');
    assert.ok(msg2);
    assert.equal(msg2!.body.task, 'process-2');
    assert.equal(msg3, undefined);
  });

  it('should handle priority queue ordering', () => {
    service.createQueue({ name: 'priority-q', type: 'priority' });

    const queue = service.getQueue('priority-q')!;
    queue.enqueue({ task: 'low-priority' }, { priority: 1 });
    queue.enqueue({ task: 'high-priority' }, { priority: 9 });
    queue.enqueue({ task: 'medium-priority' }, { priority: 5 });

    const first = queue.dequeue();
    assert.ok(first);
    assert.equal(first!.body.task, 'high-priority');

    const second = queue.dequeue();
    assert.ok(second);
    assert.equal(second!.body.task, 'medium-priority');

    const third = queue.dequeue();
    assert.ok(third);
    assert.equal(third!.body.task, 'low-priority');
  });

  it('should handle dead-letter queue', () => {
    service.createQueue({ name: 'dlq-test', type: 'standard', maxRetries: 2 });

    const queue = service.getQueue('dlq-test')!;
    const msg = queue.enqueue({ task: 'failing' });

    // First reject: retryCount goes 0->1 (1 < 2, so re-enqueued)
    queue.reject(msg.id);
    assert.equal(queue.depth, 1); // Still in queue (retried)

    // Second reject: retryCount goes 1->2 (2 < 2 is false, so dead-lettered)
    const retried = queue.peek();
    assert.ok(retried);
    queue.reject(retried!.id);

    // Now it should be in the dead-letter queue
    assert.equal(queue.depth, 0);
    assert.equal(queue.deadLetterDepth, 1);
  });

  it('should get topic stats', () => {
    service.createTopic({ name: 'stats-topic', type: 'standard' });
    service.subscribe('stats-topic', {
      id: 'sub-stats-1',
      topic: 'stats-topic',
      name: 'sub1',
      type: 'exclusive',
    }, () => {});

    service.publish('stats-topic', { data: 1 });
    service.publish('stats-topic', { data: 2 });

    const topic = service.getTopic('stats-topic')!;
    const stats = topic.getStats();

    assert.equal(stats.name, 'stats-topic');
    assert.equal(stats.totalPublished, 2);
    assert.equal(stats.activeSubscriptions, 1);
  });

  it('should get queue stats', () => {
    service.createQueue({ name: 'stats-queue', type: 'standard' });

    service.enqueue('stats-queue', { data: 1 });
    service.enqueue('stats-queue', { data: 2 });

    const queue = service.getQueue('stats-queue')!;
    queue.dequeue();

    const stats = queue.getStats();
    assert.equal(stats.name, 'stats-queue');
    assert.equal(stats.totalEnqueued, 2);
    assert.equal(stats.totalDequeued, 1);
    assert.equal(stats.depth, 1);
  });

  it('should delete topics and queues', () => {
    service.createTopic({ name: 'to-delete-topic', type: 'standard' });
    service.createQueue({ name: 'to-delete-queue', type: 'standard' });

    assert.equal(service.topicCount, 1);
    assert.equal(service.queueCount, 1);

    service.deleteTopic('to-delete-topic');
    service.deleteQueue('to-delete-queue');

    assert.equal(service.topicCount, 0);
    assert.equal(service.queueCount, 0);
    assert.equal(service.getTopic('to-delete-topic'), undefined);
    assert.equal(service.getQueue('to-delete-queue'), undefined);
  });
});

// ════════════════════════════════════════════════════════════
// DQMMonitoringManager TESTS
// ════════════════════════════════════════════════════════════

describe('DQMMonitoringManager', () => {
  let monitor: DQMMonitoringManager;

  beforeEach(() => {
    monitor = new DQMMonitoringManager();
  });

  it('should increment and get counters', () => {
    monitor.metrics.incrementCounter('requests', 5);
    monitor.metrics.incrementCounter('requests', 3);

    assert.equal(monitor.metrics.getCounter('requests'), 8);
    assert.equal(monitor.metrics.getCounter('nonexistent'), 0);
  });

  it('should set and get gauges', () => {
    monitor.metrics.setGauge('connections', 10);
    assert.equal(monitor.metrics.getGauge('connections'), 10);

    monitor.metrics.setGauge('connections', 25);
    assert.equal(monitor.metrics.getGauge('connections'), 25);
  });

  it('should record and compute histogram stats', () => {
    for (let i = 1; i <= 100; i++) {
      monitor.metrics.recordHistogram('latency', i);
    }

    const stats = monitor.metrics.getHistogramStats('latency');
    assert.ok(stats);
    assert.equal(stats!.count, 100);
    assert.equal(stats!.min, 1);
    assert.equal(stats!.max, 100);
    assert.equal(stats!.mean, 50.5);
    assert.ok(stats!.p95 >= 94);
    assert.ok(stats!.p99 >= 98);
    assert.ok(stats!.standardDeviation > 0);
  });

  it('should fire alerts when threshold exceeded', () => {
    const fired: any[] = [];
    monitor.alerts.onAlert((alert) => {
      fired.push(alert);
    });

    monitor.alerts.registerRule({
      id: 'high-errors',
      name: 'High Error Rate',
      metric: 'errors',
      condition: 'above',
      threshold: 10,
      windowMs: 60000,
      severity: 'critical',
      enabled: true,
    });

    // Set counter below threshold
    monitor.metrics.incrementCounter('errors', 5);
    monitor.alerts.evaluateRules(monitor.metrics);
    assert.equal(fired.length, 0);

    // Set counter above threshold
    monitor.metrics.incrementCounter('errors', 10); // now 15
    monitor.alerts.evaluateRules(monitor.metrics);
    assert.equal(fired.length, 1);
    assert.equal(fired[0].severity, 'critical');
    assert.ok(fired[0].message.includes('High Error Rate'));
  });
});

// ════════════════════════════════════════════════════════════
// DQMSecurityManager TESTS
// ════════════════════════════════════════════════════════════

describe('DQMSecurityManager', () => {
  let security: DQMSecurityManager;

  beforeEach(() => {
    security = new DQMSecurityManager();
  });

  it('should mask data with full strategy', () => {
    const masked = security.masker.mask('sensitive-data', 'full');
    assert.equal(masked, '***MASKED***');
  });

  it('should mask data with partial strategy', () => {
    const masked = security.masker.mask('1234567890', 'partial', {
      showFirst: 2,
      showLast: 2,
      maskChar: '*',
    });
    assert.equal(masked, '12******90');
    assert.equal(masked.length, 10);
  });

  it('should register and check access policies', () => {
    security.accessControl.registerPolicy({
      id: 'admin-policy',
      name: 'Admin Access',
      principal: 'admin',
      actions: ['profile:read', 'rule:create'],
      effect: 'allow',
      enabled: true,
    });

    assert.ok(security.accessControl.checkAccess('admin', 'profile:read'));
    assert.ok(security.accessControl.checkAccess('admin', 'rule:create'));
    assert.ok(!security.accessControl.checkAccess('admin', 'rule:delete'));
    assert.ok(!security.accessControl.checkAccess('user', 'profile:read'));
  });

  it('should log and query audit entries', () => {
    security.audit.log({
      action: 'data:read',
      actor: 'alice',
      resource: 'customers',
      success: true,
    });
    security.audit.log({
      action: 'data:write',
      actor: 'bob',
      resource: 'orders',
      success: false,
    });
    security.audit.log({
      action: 'data:read',
      actor: 'alice',
      resource: 'orders',
      success: true,
    });

    assert.equal(security.audit.entryCount, 3);

    const aliceEntries = security.audit.query({ actor: 'alice' });
    assert.equal(aliceEntries.length, 2);

    const failedEntries = security.audit.query({ success: false });
    assert.equal(failedEntries.length, 1);
    assert.equal(failedEntries[0].actor, 'bob');
  });

  it('should mask a dataset row', () => {
    security.masker.registerRule({
      id: 'mask-ssn',
      name: 'Mask SSN',
      column: 'ssn',
      strategy: 'full',
      enabled: true,
    });

    const row = { name: 'Alice', ssn: '123-45-6789', age: 30 };
    const masked = security.masker.maskRow(row);

    assert.equal(masked.name, 'Alice');
    assert.equal(masked.ssn, '***MASKED***');
    assert.equal(masked.age, 30);
  });
});

// ════════════════════════════════════════════════════════════
// DataQualityMessaging (orchestrator) TESTS
// ════════════════════════════════════════════════════════════

describe('DataQualityMessaging', () => {
  let dqm: DataQualityMessaging;

  beforeEach(() => {
    dqm = new DataQualityMessaging({
      name: 'test-dqm',
      topics: [{ name: 'quality-events', type: 'standard' }],
      queues: [{ name: 'task-queue', type: 'standard' }],
    });
  });

  it('should initialize and shutdown', async () => {
    await dqm.init();
    assert.ok(dqm.isInitialized);
    assert.ok(!dqm.isDestroyed);

    await dqm.shutdown();
    assert.ok(!dqm.isInitialized);
    assert.ok(dqm.isDestroyed);
  });

  it('should access all subsystems', async () => {
    await dqm.init();

    assert.ok(dqm.profiler instanceof DataProfiler);
    assert.ok(dqm.rules instanceof QualityRuleEngine);
    assert.ok(dqm.cleansing instanceof DataCleansingEngine);
    assert.ok(dqm.scoring instanceof QualityScoringEngine);
    assert.ok(dqm.matching instanceof RecordMatchingEngine);
    assert.ok(dqm.messaging instanceof MessagingService);
    assert.ok(dqm.monitoring instanceof DQMMonitoringManager);
    assert.ok(dqm.security instanceof DQMSecurityManager);

    await dqm.shutdown();
  });

  it('should report metrics', async () => {
    await dqm.init();

    const metrics = dqm.getMetrics();
    assert.equal(metrics.totalTopics, 1);
    assert.equal(metrics.totalQueues, 1);
    assert.ok(metrics.uptimeMs >= 0);
    assert.ok(metrics.timestamp);

    await dqm.shutdown();
  });

  it('should emit events on init/shutdown', async () => {
    const events: string[] = [];

    dqm.on('dqm:started', () => events.push('started'));
    dqm.on('dqm:stopped', () => events.push('stopped'));

    await dqm.init();
    assert.deepEqual(events, ['started']);

    await dqm.shutdown();
    assert.deepEqual(events, ['started', 'stopped']);
  });

  it('should register configured rules on construction', async () => {
    const configured = new DataQualityMessaging({
      name: 'configured-dqm',
      qualityRules: [
        {
          id: 'qr1',
          name: 'Not Null',
          type: 'not-null',
          severity: 'high',
          evaluationMode: 'row',
          column: 'name',
          enabled: true,
        },
      ],
      cleansingRules: [
        {
          id: 'cr1',
          name: 'Trim',
          type: 'trim',
          column: 'name',
          enabled: true,
          priority: 1,
        },
      ],
      matchRules: [
        {
          id: 'mr1',
          name: 'Name Match',
          fields: [{ name: 'name', algorithm: 'exact', weight: 1.0, threshold: 1.0 }],
          overallThreshold: 1.0,
          enabled: true,
        },
      ],
    });

    assert.equal(configured.rules.ruleCount, 1);
    assert.equal(configured.cleansing.ruleCount, 1);
    assert.equal(configured.matching.ruleCount, 1);

    assert.ok(configured.rules.getRule('qr1'));
    assert.ok(configured.cleansing.getRule('cr1'));
    assert.ok(configured.matching.getRule('mr1'));
  });
});

// ════════════════════════════════════════════════════════════
// createDQMPlugin TESTS
// ════════════════════════════════════════════════════════════

describe('createDQMPlugin', () => {
  let dqm: DataQualityMessaging;

  beforeEach(async () => {
    dqm = new DataQualityMessaging({
      name: 'plugin-test-dqm',
      topics: [{ name: 'test-topic', type: 'standard' }],
      queues: [{ name: 'test-queue', type: 'standard' }],
    });
    await dqm.init();
  });

  it('should create plugin with correct name and version', () => {
    const plugin = createDQMPlugin(dqm);

    assert.equal(plugin.name, 'soa-one-dqm');
    assert.equal(plugin.version, '1.0.0');
    assert.ok(plugin.operators);
    assert.ok(plugin.actionHandlers);
    assert.ok(plugin.hooks);
    assert.ok(plugin.functions);
    assert.ok(plugin.onRegister);
    assert.ok(plugin.onDestroy);
  });

  it('should register DQM-specific operators', () => {
    const plugin = createDQMPlugin(dqm);

    assert.ok(plugin.operators!.qualityScoreExceeds);
    assert.ok(plugin.operators!.qualityGradeIs);
    assert.ok(plugin.operators!.qualityRuleExists);
    assert.ok(plugin.operators!.topicExists);
    assert.ok(plugin.operators!.topicHasBacklog);
    assert.ok(plugin.operators!.queueExists);
    assert.ok(plugin.operators!.queueDepthExceeds);
    assert.ok(plugin.operators!.matchRuleExists);
    assert.ok(plugin.operators!.qualityTrendIs);
    assert.ok(plugin.operators!.hasActiveAlerts);

    // Test topicExists operator
    assert.ok(plugin.operators!.topicExists('test-topic', true));
    assert.ok(!plugin.operators!.topicExists('nonexistent', true));

    // Test queueExists operator
    assert.ok(plugin.operators!.queueExists('test-queue', true));
  });

  it('should register DQM action handlers', () => {
    const plugin = createDQMPlugin(dqm);

    assert.ok(plugin.actionHandlers!.DQM_PUBLISH);
    assert.ok(plugin.actionHandlers!.DQM_ENQUEUE);
    assert.ok(plugin.actionHandlers!.DQM_VALIDATE);
    assert.ok(plugin.actionHandlers!.DQM_CLEANSE);
    assert.ok(plugin.actionHandlers!.DQM_PROFILE);

    // Test DQM_PUBLISH action
    const output: Record<string, any> = {};
    dqm.messaging.subscribe('test-topic', {
      id: 'sub-test-1',
      topic: 'test-topic',
      name: 'test-sub',
      type: 'exclusive',
    }, () => {});

    plugin.actionHandlers!.DQM_PUBLISH(
      output,
      { type: 'DQM_PUBLISH', field: 'test-topic', value: { body: { event: 'test' } } },
      {},
    );

    assert.ok(output._dqmMessages);
    assert.equal(output._dqmMessages.length, 1);
    assert.equal(output._dqmMessages[0].topic, 'test-topic');
  });

  it('should provide DQM custom functions', async () => {
    const plugin = createDQMPlugin(dqm);

    // Test core functions exist
    assert.ok(plugin.functions!.dqm_qualityScore);
    assert.ok(plugin.functions!.dqm_qualityGrade);
    assert.ok(plugin.functions!.dqm_qualityTrend);
    assert.ok(plugin.functions!.dqm_ruleCount);
    assert.ok(plugin.functions!.dqm_generateId);
    assert.ok(plugin.functions!.dqm_topicCount);
    assert.ok(plugin.functions!.dqm_queueCount);
    assert.ok(plugin.functions!.dqm_getMetrics);

    // Test function values
    assert.equal(plugin.functions!.dqm_topicCount(), 1);
    assert.equal(plugin.functions!.dqm_queueCount(), 1);
    assert.ok(plugin.functions!.dqm_topicExists('test-topic'));
    assert.ok(!plugin.functions!.dqm_topicExists('nope'));

    // Test generate ID returns valid DQM ID
    const id = plugin.functions!.dqm_generateId();
    assert.ok(typeof id === 'string');
    assert.ok(id.startsWith('dqm_'));

    // Test lifecycle callbacks
    plugin.onRegister!();
    plugin.onDestroy!();

    // Hooks should be present
    assert.ok(plugin.hooks!.beforeExecute!.length >= 1);
    assert.ok(plugin.hooks!.afterExecute!.length >= 1);

    // Test beforeExecute hook injects DQM metadata
    const hookCtx: any = {
      ruleSet: { id: 'rs1', name: 'Test' },
      input: {},
      output: {},
      metadata: {},
    };
    const result = plugin.hooks!.beforeExecute![0](hookCtx);
    assert.ok(result.metadata.dqm);
    assert.equal(result.metadata.dqm.name, 'plugin-test-dqm');

    await dqm.shutdown();
  });
});
