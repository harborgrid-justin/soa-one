import { prisma } from '../prisma';
import { executeRuleSet as runEngine } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';
import { enqueueJob } from '../queue/producer';

function buildEngineRuleSet(ruleSet: any) {
  return {
    id: ruleSet.id,
    name: ruleSet.name,
    rules: ruleSet.rules.map((r: any): Rule => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      enabled: r.enabled,
      conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions,
      actions: typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions,
    })),
    decisionTables: (ruleSet.decisionTables || []).map((t: any): DecisionTable => ({
      id: t.id,
      name: t.name,
      columns: typeof t.columns === 'string' ? JSON.parse(t.columns) : t.columns,
      rows: typeof t.rows === 'string' ? JSON.parse(t.rows) : t.rows,
      hitPolicy: 'FIRST' as const,
    })),
  };
}

function parseJsonFields(obj: any, fields: string[]) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = JSON.parse(result[field]);
    }
  }
  return result;
}

export const resolvers = {
  Query: {
    // Projects
    projects: async () => {
      const projects = await prisma.project.findMany({
        include: { _count: { select: { ruleSets: true, dataModels: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      return projects.map((p) => ({
        ...p,
        ruleSetCount: p._count.ruleSets,
        dataModelCount: p._count.dataModels,
      }));
    },

    project: async (_: any, { id }: { id: string }) => {
      const p = await prisma.project.findUnique({
        where: { id },
        include: {
          ruleSets: { orderBy: { updatedAt: 'desc' } },
          dataModels: { orderBy: { updatedAt: 'desc' } },
          _count: { select: { ruleSets: true, dataModels: true } },
        },
      });
      if (!p) return null;
      return { ...p, ruleSetCount: p._count.ruleSets, dataModelCount: p._count.dataModels };
    },

    // Rule Sets
    ruleSets: async (_: any, { projectId }: { projectId?: string }) => {
      const where = projectId ? { projectId } : {};
      const sets = await prisma.ruleSet.findMany({
        where,
        include: {
          inputModel: true,
          _count: { select: { rules: true, decisionTables: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return sets.map((s) => ({
        ...s,
        ruleCount: s._count.rules,
        tableCount: s._count.decisionTables,
      }));
    },

    ruleSet: async (_: any, { id }: { id: string }) => {
      const s = await prisma.ruleSet.findUnique({
        where: { id },
        include: {
          rules: { orderBy: { priority: 'desc' } },
          decisionTables: { orderBy: { createdAt: 'asc' } },
          inputModel: true,
          versions: { orderBy: { version: 'desc' }, take: 10 },
          _count: { select: { rules: true, decisionTables: true } },
        },
      });
      if (!s) return null;
      return {
        ...s,
        rules: s.rules.map((r) => parseJsonFields(r, ['conditions', 'actions'])),
        decisionTables: s.decisionTables.map((t) => parseJsonFields(t, ['columns', 'rows'])),
        versions: s.versions.map((v) => parseJsonFields(v, ['snapshot'])),
        ruleCount: s._count.rules,
        tableCount: s._count.decisionTables,
      };
    },

    // Rules
    rules: async (_: any, { ruleSetId }: { ruleSetId: string }) => {
      const rules = await prisma.rule.findMany({
        where: { ruleSetId },
        orderBy: { priority: 'desc' },
      });
      return rules.map((r) => parseJsonFields(r, ['conditions', 'actions']));
    },

    rule: async (_: any, { id }: { id: string }) => {
      const r = await prisma.rule.findUnique({ where: { id } });
      return r ? parseJsonFields(r, ['conditions', 'actions']) : null;
    },

    // Decision Tables
    decisionTables: async (_: any, { ruleSetId }: { ruleSetId: string }) => {
      const tables = await prisma.decisionTable.findMany({
        where: { ruleSetId },
        orderBy: { createdAt: 'asc' },
      });
      return tables.map((t) => parseJsonFields(t, ['columns', 'rows']));
    },

    decisionTable: async (_: any, { id }: { id: string }) => {
      const t = await prisma.decisionTable.findUnique({ where: { id } });
      return t ? parseJsonFields(t, ['columns', 'rows']) : null;
    },

    // Data Models
    dataModels: async (_: any, { projectId }: { projectId?: string }) => {
      const where = projectId ? { projectId } : {};
      const models = await prisma.dataModel.findMany({ where, orderBy: { updatedAt: 'desc' } });
      return models.map((m) => parseJsonFields(m, ['schema']));
    },

    dataModel: async (_: any, { id }: { id: string }) => {
      const m = await prisma.dataModel.findUnique({ where: { id } });
      return m ? parseJsonFields(m, ['schema']) : null;
    },

    // Dashboard
    dashboardStats: async () => {
      const [projects, ruleSets, rules, decisionTables, totalExecutions] = await Promise.all([
        prisma.project.count(),
        prisma.ruleSet.count(),
        prisma.rule.count(),
        prisma.decisionTable.count(),
        prisma.executionLog.count(),
      ]);
      const recent = await prisma.executionLog.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
      const successCount = recent.filter((e) => e.status === 'success').length;
      const avgTime = recent.length > 0
        ? Math.round(recent.reduce((s, e) => s + e.executionTimeMs, 0) / recent.length)
        : 0;

      return {
        projects,
        ruleSets,
        rules,
        decisionTables,
        totalExecutions,
        successRate: recent.length > 0 ? Math.round((successCount / recent.length) * 100) : 100,
        avgExecutionTimeMs: avgTime,
      };
    },

    executionLogs: async (_: any, { ruleSetId, limit, offset }: any) => {
      const logs = await prisma.executionLog.findMany({
        where: { ruleSetId },
        take: limit || 50,
        skip: offset || 0,
        orderBy: { createdAt: 'desc' },
      });
      return logs.map((l) => parseJsonFields(l, ['input', 'output', 'rulesFired']));
    },

    // Versions
    versions: async (_: any, { ruleSetId }: { ruleSetId: string }) => {
      const versions = await prisma.ruleSetVersion.findMany({
        where: { ruleSetId },
        orderBy: { version: 'desc' },
      });
      return versions.map((v) => parseJsonFields(v, ['snapshot']));
    },

    version: async (_: any, { ruleSetId, version }: any) => {
      const v = await prisma.ruleSetVersion.findFirst({
        where: { ruleSetId, version: Number(version) },
      });
      return v ? parseJsonFields(v, ['snapshot']) : null;
    },

    // Queue
    queueJobs: async (_: any, { status, limit }: any) => {
      const where = status ? { status } : {};
      const jobs = await prisma.queueJob.findMany({
        where,
        take: limit || 20,
        orderBy: { createdAt: 'desc' },
      });
      return jobs.map((j) => ({
        ...j,
        payload: JSON.parse(j.payload),
        result: j.result ? JSON.parse(j.result) : null,
      }));
    },

    queueJob: async (_: any, { id }: { id: string }) => {
      const j = await prisma.queueJob.findUnique({ where: { id } });
      if (!j) return null;
      return {
        ...j,
        payload: JSON.parse(j.payload),
        result: j.result ? JSON.parse(j.result) : null,
      };
    },
  },

  Mutation: {
    // Projects
    createProject: async (_: any, { name, description }: any) => {
      return prisma.project.create({ data: { name, description: description || '' } });
    },
    updateProject: async (_: any, { id, ...data }: any) => {
      return prisma.project.update({ where: { id }, data });
    },
    deleteProject: async (_: any, { id }: any) => {
      await prisma.project.delete({ where: { id } });
      return true;
    },

    // Rule Sets
    createRuleSet: async (_: any, { projectId, name, description, inputModelId }: any) => {
      return prisma.ruleSet.create({
        data: { projectId, name, description: description || '', inputModelId },
      });
    },
    updateRuleSet: async (_: any, { id, ...data }: any) => {
      return prisma.ruleSet.update({ where: { id }, data });
    },
    deleteRuleSet: async (_: any, { id }: any) => {
      await prisma.ruleSet.delete({ where: { id } });
      return true;
    },

    // Rules
    createRule: async (_: any, { ruleSetId, name, description, priority, conditions, actions }: any) => {
      const rule = await prisma.rule.create({
        data: {
          ruleSetId,
          name,
          description: description || '',
          priority: priority || 0,
          conditions: JSON.stringify(conditions || { logic: 'AND', conditions: [] }),
          actions: JSON.stringify(actions || []),
        },
      });
      return parseJsonFields(rule, ['conditions', 'actions']);
    },
    updateRule: async (_: any, { id, conditions, actions, ...rest }: any) => {
      const data: any = { ...rest };
      if (conditions !== undefined) data.conditions = JSON.stringify(conditions);
      if (actions !== undefined) data.actions = JSON.stringify(actions);
      const rule = await prisma.rule.update({ where: { id }, data });
      return parseJsonFields(rule, ['conditions', 'actions']);
    },
    deleteRule: async (_: any, { id }: any) => {
      await prisma.rule.delete({ where: { id } });
      return true;
    },

    // Decision Tables
    createDecisionTable: async (_: any, { ruleSetId, name, description, columns, rows }: any) => {
      const table = await prisma.decisionTable.create({
        data: {
          ruleSetId,
          name,
          description: description || '',
          columns: JSON.stringify(columns || []),
          rows: JSON.stringify(rows || []),
        },
      });
      return parseJsonFields(table, ['columns', 'rows']);
    },
    updateDecisionTable: async (_: any, { id, columns, rows, ...rest }: any) => {
      const data: any = { ...rest };
      if (columns !== undefined) data.columns = JSON.stringify(columns);
      if (rows !== undefined) data.rows = JSON.stringify(rows);
      const table = await prisma.decisionTable.update({ where: { id }, data });
      return parseJsonFields(table, ['columns', 'rows']);
    },
    deleteDecisionTable: async (_: any, { id }: any) => {
      await prisma.decisionTable.delete({ where: { id } });
      return true;
    },

    // Data Models
    createDataModel: async (_: any, { projectId, name, schema }: any) => {
      const model = await prisma.dataModel.create({
        data: { projectId, name, schema: JSON.stringify(schema || { fields: [] }) },
      });
      return parseJsonFields(model, ['schema']);
    },
    updateDataModel: async (_: any, { id, schema, ...rest }: any) => {
      const data: any = { ...rest };
      if (schema !== undefined) data.schema = JSON.stringify(schema);
      const model = await prisma.dataModel.update({ where: { id }, data });
      return parseJsonFields(model, ['schema']);
    },
    deleteDataModel: async (_: any, { id }: any) => {
      await prisma.dataModel.delete({ where: { id } });
      return true;
    },

    // Execution
    executeRuleSet: async (_: any, { ruleSetId, input }: any) => {
      const ruleSet = await prisma.ruleSet.findUnique({
        where: { id: ruleSetId },
        include: { rules: { where: { enabled: true } }, decisionTables: true },
      });
      if (!ruleSet) throw new Error('Rule set not found');

      const result = runEngine(buildEngineRuleSet(ruleSet), input);

      await prisma.executionLog.create({
        data: {
          ruleSetId,
          version: ruleSet.version,
          input: JSON.stringify(input),
          output: JSON.stringify(result.output),
          rulesFired: JSON.stringify(result.rulesFired),
          executionTimeMs: result.executionTimeMs,
          status: result.success ? 'success' : 'error',
          error: result.error,
        },
      });

      return result;
    },

    testRuleSet: async (_: any, { ruleSetId, input }: any) => {
      const ruleSet = await prisma.ruleSet.findUnique({
        where: { id: ruleSetId },
        include: { rules: true, decisionTables: true },
      });
      if (!ruleSet) throw new Error('Rule set not found');
      return runEngine(buildEngineRuleSet(ruleSet), input);
    },

    // Versioning
    publishRuleSet: async (_: any, { ruleSetId, changelog, publishedBy }: any) => {
      const ruleSet = await prisma.ruleSet.findUnique({
        where: { id: ruleSetId },
        include: { rules: true, decisionTables: true },
      });
      if (!ruleSet) throw new Error('Rule set not found');

      const newVersion = ruleSet.version + 1;
      const snapshot = {
        rules: ruleSet.rules.map((r) => parseJsonFields(r, ['conditions', 'actions'])),
        decisionTables: ruleSet.decisionTables.map((t) => parseJsonFields(t, ['columns', 'rows'])),
      };

      const [version] = await prisma.$transaction([
        prisma.ruleSetVersion.create({
          data: {
            ruleSetId,
            version: newVersion,
            snapshot: JSON.stringify(snapshot),
            changelog: changelog || '',
            publishedBy: publishedBy || 'system',
          },
        }),
        prisma.ruleSet.update({
          where: { id: ruleSetId },
          data: { version: newVersion, status: 'published' },
        }),
      ]);

      return parseJsonFields(version, ['snapshot']);
    },

    rollbackRuleSet: async (_: any, { ruleSetId, version }: any) => {
      const v = await prisma.ruleSetVersion.findFirst({
        where: { ruleSetId, version: Number(version) },
      });
      if (!v) throw new Error('Version not found');

      const snapshot = JSON.parse(v.snapshot);
      await prisma.$transaction([
        prisma.rule.deleteMany({ where: { ruleSetId } }),
        prisma.decisionTable.deleteMany({ where: { ruleSetId } }),
        ...snapshot.rules.map((r: any) =>
          prisma.rule.create({
            data: {
              id: r.id,
              ruleSetId,
              name: r.name,
              description: r.description || '',
              priority: r.priority,
              conditions: JSON.stringify(r.conditions),
              actions: JSON.stringify(r.actions),
              enabled: r.enabled,
            },
          }),
        ),
        ...snapshot.decisionTables.map((t: any) =>
          prisma.decisionTable.create({
            data: {
              id: t.id,
              ruleSetId,
              name: t.name,
              description: t.description || '',
              columns: JSON.stringify(t.columns),
              rows: JSON.stringify(t.rows),
            },
          }),
        ),
      ]);

      return true;
    },

    // Queue
    enqueueExecution: async (_: any, { ruleSetId, input, callbackUrl }: any) => {
      const job = await enqueueJob('rule-execution', { ruleSetId, input, callbackUrl });
      return {
        id: job.id,
        queue: job.queue,
        payload: job.payload,
        status: job.status,
        result: null,
        error: null,
        attempts: 0,
        createdAt: new Date(),
      };
    },
  },

  // Field resolvers for nested types
  Project: {
    ruleSets: async (parent: any) => {
      if (parent.ruleSets) return parent.ruleSets;
      return prisma.ruleSet.findMany({ where: { projectId: parent.id } });
    },
    dataModels: async (parent: any) => {
      if (parent.dataModels) return parent.dataModels;
      const models = await prisma.dataModel.findMany({ where: { projectId: parent.id } });
      return models.map((m) => parseJsonFields(m, ['schema']));
    },
  },

  RuleSet: {
    rules: async (parent: any) => {
      if (parent.rules) return parent.rules;
      const rules = await prisma.rule.findMany({ where: { ruleSetId: parent.id } });
      return rules.map((r) => parseJsonFields(r, ['conditions', 'actions']));
    },
    decisionTables: async (parent: any) => {
      if (parent.decisionTables) return parent.decisionTables;
      const tables = await prisma.decisionTable.findMany({ where: { ruleSetId: parent.id } });
      return tables.map((t) => parseJsonFields(t, ['columns', 'rows']));
    },
    versions: async (parent: any) => {
      if (parent.versions) return parent.versions;
      const versions = await prisma.ruleSetVersion.findMany({
        where: { ruleSetId: parent.id },
        orderBy: { version: 'desc' },
        take: 10,
      });
      return versions.map((v) => parseJsonFields(v, ['snapshot']));
    },
  },
};
