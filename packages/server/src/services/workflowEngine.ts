import { prisma } from '../prisma';
import { executeRuleSet as runEngine } from '@soa-one/engine';
import type { Rule, DecisionTable } from '@soa-one/engine';

interface WorkflowNode {
  id: string;
  type: string; // start | end | ruleTask | decision | serviceTask | userTask | script | timer
  position: { x: number; y: number };
  data: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  data?: { condition?: string };
}

interface ExecutionLog {
  nodeId: string;
  nodeType: string;
  label: string;
  status: 'completed' | 'skipped' | 'error';
  input?: any;
  output?: any;
  error?: string;
  timestamp: string;
  durationMs: number;
}

/**
 * Execute a workflow by walking through nodes following edges.
 * Supports: start, end, ruleTask, decision, serviceTask, script nodes.
 */
export async function executeWorkflow(
  workflow: any,
  instanceId: string,
  input: Record<string, any>,
) {
  const nodes: WorkflowNode[] = typeof workflow.nodes === 'string'
    ? JSON.parse(workflow.nodes)
    : workflow.nodes;
  const edges: WorkflowEdge[] = typeof workflow.edges === 'string'
    ? JSON.parse(workflow.edges)
    : workflow.edges;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const logs: ExecutionLog[] = [];
  let state: Record<string, any> = { ...input };
  let currentNodeId: string | null = null;

  // Find start node
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) {
    await markFailed(instanceId, 'No start node found', logs);
    return { status: 'failed', error: 'No start node found', output: null, logs };
  }

  currentNodeId = startNode.id;
  let iterations = 0;
  const MAX_ITERATIONS = 200;

  while (currentNodeId && iterations < MAX_ITERATIONS) {
    iterations++;
    const node = nodeMap.get(currentNodeId);
    if (!node) {
      await markFailed(instanceId, `Node ${currentNodeId} not found`, logs);
      return { status: 'failed', error: `Node ${currentNodeId} not found`, output: state, logs };
    }

    // Update instance current node
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        currentNode: currentNodeId,
        state: JSON.stringify(state),
        logs: JSON.stringify(logs),
      },
    });

    const startTime = Date.now();

    try {
      switch (node.type) {
        case 'start': {
          logs.push({
            nodeId: node.id, nodeType: 'start', label: node.data.label || 'Start',
            status: 'completed', timestamp: new Date().toISOString(), durationMs: 0,
          });
          currentNodeId = getNextNode(node.id, edges);
          break;
        }

        case 'end': {
          logs.push({
            nodeId: node.id, nodeType: 'end', label: node.data.label || 'End',
            status: 'completed', output: state, timestamp: new Date().toISOString(), durationMs: 0,
          });
          // Mark instance completed
          await prisma.workflowInstance.update({
            where: { id: instanceId },
            data: {
              status: 'completed',
              output: JSON.stringify(state),
              logs: JSON.stringify(logs),
              completedAt: new Date(),
              currentNode: null,
            },
          });
          return { status: 'completed', output: state, logs };
        }

        case 'ruleTask': {
          // Execute a rule set
          const ruleSetId = node.data.ruleSetId;
          if (!ruleSetId) throw new Error('No ruleSetId configured on rule task');

          const ruleSet = await prisma.ruleSet.findUnique({
            where: { id: ruleSetId },
            include: { rules: true, decisionTables: true },
          });
          if (!ruleSet) throw new Error(`Rule set ${ruleSetId} not found`);

          const engineRuleSet = {
            id: ruleSet.id,
            name: ruleSet.name,
            rules: ruleSet.rules.map((r): Rule => ({
              id: r.id, name: r.name, priority: r.priority, enabled: r.enabled,
              conditions: JSON.parse(r.conditions), actions: JSON.parse(r.actions),
            })),
            decisionTables: ruleSet.decisionTables.map((t): DecisionTable => ({
              id: t.id, name: t.name,
              columns: JSON.parse(t.columns), rows: JSON.parse(t.rows),
              hitPolicy: 'FIRST' as const,
            })),
          };

          const result = runEngine(engineRuleSet, state);
          state = { ...state, ...result.output };

          const elapsed = Date.now() - startTime;
          logs.push({
            nodeId: node.id, nodeType: 'ruleTask',
            label: node.data.label || ruleSet.name,
            status: 'completed', input: state, output: result.output,
            timestamp: new Date().toISOString(), durationMs: elapsed,
          });
          currentNodeId = getNextNode(node.id, edges);
          break;
        }

        case 'decision': {
          // Evaluate condition to choose a branch
          const outEdges = edges.filter((e) => e.source === node.id);
          let matched = false;

          for (const edge of outEdges) {
            if (edge.data?.condition) {
              try {
                // Simple expression evaluator: checks "field operator value"
                const condMet = evaluateSimpleCondition(edge.data.condition, state);
                if (condMet) {
                  currentNodeId = edge.target;
                  matched = true;
                  logs.push({
                    nodeId: node.id, nodeType: 'decision',
                    label: node.data.label || 'Decision',
                    status: 'completed',
                    output: { branch: edge.label || edge.target, condition: edge.data.condition },
                    timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
                  });
                  break;
                }
              } catch {
                // condition eval failed, skip this edge
              }
            }
          }

          // If no condition matched, take the default (edge without condition or labeled "default"/"else")
          if (!matched) {
            const defaultEdge = outEdges.find(
              (e) => !e.data?.condition || e.label?.toLowerCase() === 'default' || e.label?.toLowerCase() === 'else'
            );
            if (defaultEdge) {
              currentNodeId = defaultEdge.target;
              logs.push({
                nodeId: node.id, nodeType: 'decision',
                label: node.data.label || 'Decision',
                status: 'completed', output: { branch: 'default' },
                timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
              });
            } else {
              throw new Error('No matching condition and no default branch');
            }
          }
          break;
        }

        case 'serviceTask': {
          // Call an external adapter
          const adapterId = node.data.adapterId;
          if (adapterId) {
            const adapter = await prisma.adapter.findUnique({ where: { id: adapterId } });
            if (adapter && adapter.type === 'rest') {
              const config = JSON.parse(adapter.config);
              const authConf = JSON.parse(adapter.authConfig);
              const hdrs: Record<string, string> = {
                'Content-Type': 'application/json',
                ...JSON.parse(adapter.headers),
              };

              if (authConf.type === 'bearer') hdrs['Authorization'] = `Bearer ${authConf.token}`;

              const url = (config.baseUrl || config.url) + (node.data.path || '');
              const response = await fetch(url, {
                method: node.data.method || 'POST',
                headers: hdrs,
                body: JSON.stringify(state),
                signal: AbortSignal.timeout(30000),
              });

              const respData: any = await response.json().catch(() => ({}));
              if (node.data.outputField) {
                state[node.data.outputField] = respData;
              } else if (respData && typeof respData === 'object') {
                state = { ...state, ...respData };
              }
            }
          }

          // Also handle inline scripts in serviceTask
          if (node.data.script) {
            const scriptResult = evaluateScript(node.data.script, state);
            state = { ...state, ...scriptResult };
          }

          logs.push({
            nodeId: node.id, nodeType: 'serviceTask',
            label: node.data.label || 'Service Task',
            status: 'completed', output: state,
            timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
          });
          currentNodeId = getNextNode(node.id, edges);
          break;
        }

        case 'script': {
          // Execute a script (JSON transform expressions)
          if (node.data.assignments) {
            for (const assignment of node.data.assignments) {
              if (assignment.field && assignment.value !== undefined) {
                let val = assignment.value;
                // Resolve references like {{field.name}}
                if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
                  const ref = val.slice(2, -2).trim();
                  val = resolvePath(state, ref);
                }
                setPath(state, assignment.field, val);
              }
            }
          }

          logs.push({
            nodeId: node.id, nodeType: 'script',
            label: node.data.label || 'Script',
            status: 'completed', output: state,
            timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
          });
          currentNodeId = getNextNode(node.id, edges);
          break;
        }

        case 'timer': {
          // Timer node — in a real system this would pause and resume
          // For now, just log and continue
          logs.push({
            nodeId: node.id, nodeType: 'timer',
            label: node.data.label || 'Timer',
            status: 'completed',
            output: { delay: node.data.delay || '0s' },
            timestamp: new Date().toISOString(), durationMs: 0,
          });
          currentNodeId = getNextNode(node.id, edges);
          break;
        }

        default: {
          // Unknown node type — skip
          logs.push({
            nodeId: node.id, nodeType: node.type,
            label: node.data.label || node.type,
            status: 'skipped',
            timestamp: new Date().toISOString(), durationMs: 0,
          });
          currentNodeId = getNextNode(node.id, edges);
          break;
        }
      }
    } catch (err: any) {
      logs.push({
        nodeId: node.id, nodeType: node.type,
        label: node.data.label || node.type,
        status: 'error', error: err.message,
        timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
      });
      await markFailed(instanceId, err.message, logs);
      return { status: 'failed', error: err.message, output: state, logs };
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    await markFailed(instanceId, 'Maximum iterations exceeded (possible infinite loop)', logs);
    return { status: 'failed', error: 'Maximum iterations exceeded', output: state, logs };
  }

  // If we get here without hitting an end node
  await markFailed(instanceId, 'Workflow ended without reaching an End node', logs);
  return { status: 'failed', error: 'No End node reached', output: state, logs };
}

function getNextNode(currentId: string, edges: WorkflowEdge[]): string | null {
  const edge = edges.find((e) => e.source === currentId);
  return edge ? edge.target : null;
}

async function markFailed(instanceId: string, error: string, logs: ExecutionLog[]) {
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      status: 'failed',
      error,
      logs: JSON.stringify(logs),
      completedAt: new Date(),
    },
  });
}

function evaluateSimpleCondition(condition: string, data: Record<string, any>): boolean {
  // Supports: "field == value", "field > value", "field != value", "field contains value"
  const ops = ['===', '!==', '==', '!=', '>=', '<=', '>', '<', 'contains', 'startsWith'];
  let op = '';
  let parts: string[] = [];

  for (const o of ops) {
    if (condition.includes(` ${o} `)) {
      op = o;
      parts = condition.split(` ${o} `).map((s) => s.trim());
      break;
    }
  }

  if (!op || parts.length !== 2) return false;

  const fieldVal = resolvePath(data, parts[0]);
  let compareVal: any = parts[1];

  // Parse compare value
  if (compareVal === 'true') compareVal = true;
  else if (compareVal === 'false') compareVal = false;
  else if (compareVal === 'null') compareVal = null;
  else if (!isNaN(Number(compareVal))) compareVal = Number(compareVal);
  else if (compareVal.startsWith('"') && compareVal.endsWith('"')) compareVal = compareVal.slice(1, -1);
  else if (compareVal.startsWith("'") && compareVal.endsWith("'")) compareVal = compareVal.slice(1, -1);

  switch (op) {
    case '==': case '===': return fieldVal === compareVal;
    case '!=': case '!==': return fieldVal !== compareVal;
    case '>': return Number(fieldVal) > Number(compareVal);
    case '>=': return Number(fieldVal) >= Number(compareVal);
    case '<': return Number(fieldVal) < Number(compareVal);
    case '<=': return Number(fieldVal) <= Number(compareVal);
    case 'contains': return String(fieldVal).includes(String(compareVal));
    case 'startsWith': return String(fieldVal).startsWith(String(compareVal));
    default: return false;
  }
}

function evaluateScript(script: string, data: Record<string, any>): Record<string, any> {
  // Simple JSON assignment parser: "field = value" per line
  const result: Record<string, any> = {};
  const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const field = line.slice(0, eqIdx).trim();
      let value: any = line.slice(eqIdx + 1).trim();

      if (value.startsWith('{{') && value.endsWith('}}')) {
        value = resolvePath(data, value.slice(2, -2).trim());
      } else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);
      else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);

      result[field] = value;
    }
  }

  return result;
}

function resolvePath(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function setPath(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split('.');
  let current: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}
