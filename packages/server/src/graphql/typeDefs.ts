export const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  type Project {
    id: ID!
    name: String!
    description: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    ruleSets: [RuleSet!]!
    dataModels: [DataModel!]!
    ruleSetCount: Int!
    dataModelCount: Int!
  }

  type DataModel {
    id: ID!
    projectId: String!
    name: String!
    schema: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RuleSet {
    id: ID!
    projectId: String!
    name: String!
    description: String!
    inputModelId: String
    status: String!
    version: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    rules: [Rule!]!
    decisionTables: [DecisionTable!]!
    inputModel: DataModel
    versions: [RuleSetVersion!]!
    ruleCount: Int!
    tableCount: Int!
  }

  type Rule {
    id: ID!
    ruleSetId: String!
    name: String!
    description: String!
    priority: Int!
    conditions: JSON!
    actions: JSON!
    enabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DecisionTable {
    id: ID!
    ruleSetId: String!
    name: String!
    description: String!
    columns: JSON!
    rows: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RuleSetVersion {
    id: ID!
    ruleSetId: String!
    version: Int!
    snapshot: JSON!
    changelog: String!
    publishedAt: DateTime!
    publishedBy: String!
  }

  type ExecutionResult {
    success: Boolean!
    input: JSON!
    output: JSON!
    ruleResults: JSON!
    tableResults: JSON!
    rulesFired: [String!]!
    executionTimeMs: Int!
    error: String
  }

  type ExecutionLog {
    id: ID!
    ruleSetId: String!
    version: Int!
    input: JSON!
    output: JSON!
    rulesFired: JSON!
    executionTimeMs: Int!
    status: String!
    error: String
    createdAt: DateTime!
  }

  type DashboardStats {
    projects: Int!
    ruleSets: Int!
    rules: Int!
    decisionTables: Int!
    totalExecutions: Int!
    successRate: Int!
    avgExecutionTimeMs: Int!
  }

  type QueueJob {
    id: ID!
    queue: String!
    payload: JSON!
    status: String!
    result: JSON
    error: String
    attempts: Int!
    createdAt: DateTime!
  }

  # Queries
  type Query {
    # Projects
    projects: [Project!]!
    project(id: ID!): Project

    # Rule Sets
    ruleSets(projectId: ID): [RuleSet!]!
    ruleSet(id: ID!): RuleSet

    # Rules
    rules(ruleSetId: ID!): [Rule!]!
    rule(id: ID!): Rule

    # Decision Tables
    decisionTables(ruleSetId: ID!): [DecisionTable!]!
    decisionTable(id: ID!): DecisionTable

    # Data Models
    dataModels(projectId: ID): [DataModel!]!
    dataModel(id: ID!): DataModel

    # Dashboard
    dashboardStats: DashboardStats!
    executionLogs(ruleSetId: ID!, limit: Int, offset: Int): [ExecutionLog!]!

    # Versions
    versions(ruleSetId: ID!): [RuleSetVersion!]!
    version(ruleSetId: ID!, version: Int!): RuleSetVersion

    # Queue
    queueJobs(status: String, limit: Int): [QueueJob!]!
    queueJob(id: ID!): QueueJob
  }

  # Mutations
  type Mutation {
    # Projects
    createProject(name: String!, description: String): Project!
    updateProject(id: ID!, name: String, description: String): Project!
    deleteProject(id: ID!): Boolean!

    # Rule Sets
    createRuleSet(projectId: ID!, name: String!, description: String, inputModelId: ID): RuleSet!
    updateRuleSet(id: ID!, name: String, description: String, status: String, inputModelId: ID): RuleSet!
    deleteRuleSet(id: ID!): Boolean!

    # Rules
    createRule(ruleSetId: ID!, name: String!, description: String, priority: Int, conditions: JSON, actions: JSON): Rule!
    updateRule(id: ID!, name: String, description: String, priority: Int, conditions: JSON, actions: JSON, enabled: Boolean): Rule!
    deleteRule(id: ID!): Boolean!

    # Decision Tables
    createDecisionTable(ruleSetId: ID!, name: String!, description: String, columns: JSON, rows: JSON): DecisionTable!
    updateDecisionTable(id: ID!, name: String, description: String, columns: JSON, rows: JSON): DecisionTable!
    deleteDecisionTable(id: ID!): Boolean!

    # Data Models
    createDataModel(projectId: ID!, name: String!, schema: JSON): DataModel!
    updateDataModel(id: ID!, name: String, schema: JSON): DataModel!
    deleteDataModel(id: ID!): Boolean!

    # Execution
    executeRuleSet(ruleSetId: ID!, input: JSON!): ExecutionResult!
    testRuleSet(ruleSetId: ID!, input: JSON!): ExecutionResult!

    # Versioning
    publishRuleSet(ruleSetId: ID!, changelog: String, publishedBy: String): RuleSetVersion!
    rollbackRuleSet(ruleSetId: ID!, version: Int!): Boolean!

    # Queue
    enqueueExecution(ruleSetId: ID!, input: JSON!, callbackUrl: String): QueueJob!
  }
`;
