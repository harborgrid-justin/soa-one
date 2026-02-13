import { useState, useEffect } from 'react';
import { Copy, Check, Zap, Globe, GitBranch, Play, List } from 'lucide-react';
import { getQueueJobs } from '../api/client';

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function ApiDocs() {
  const [tab, setTab] = useState<'rest' | 'graphql' | 'queue'>('rest');
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    if (tab === 'queue') {
      getQueueJobs().then(setJobs).catch(() => {});
    }
  }, [tab]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Integrate with SOA One using REST, GraphQL, or async message queue.</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'rest', label: 'REST API', icon: Globe },
          { id: 'graphql', label: 'GraphQL', icon: GitBranch },
          { id: 'queue', label: 'Message Queue', icon: List },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rest' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">REST API Endpoints</h3>
            <div className="space-y-4">
              <Endpoint method="GET" path="/api/v1/health" desc="Health check" />
              <Endpoint method="GET" path="/api/v1/projects" desc="List all projects" />
              <Endpoint method="POST" path="/api/v1/projects" desc="Create a project" />
              <Endpoint method="GET" path="/api/v1/rule-sets" desc="List rule sets" />
              <Endpoint method="GET" path="/api/v1/rule-sets/:id" desc="Get rule set with all rules" />
              <Endpoint method="POST" path="/api/v1/execute/:ruleSetId" desc="Execute rules (production)" />
              <Endpoint method="POST" path="/api/v1/execute/:ruleSetId/test" desc="Test execution (no logging)" />
              <Endpoint method="POST" path="/api/v1/versions/:ruleSetId/publish" desc="Publish a version" />
              <Endpoint method="GET" path="/api/v1/dashboard/stats" desc="Dashboard statistics" />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Example: Execute Rules</h3>
            <CodeBlock code={`curl -X POST http://localhost:4000/api/v1/execute/{ruleSetId} \\
  -H "Content-Type: application/json" \\
  -d '{
    "applicant": {
      "age": 30,
      "accidents": 0,
      "creditScore": 780
    },
    "vehicle": {
      "type": "sedan",
      "value": 25000
    }
  }'`} />
          </div>
        </div>
      )}

      {tab === 'graphql' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-2">GraphQL Endpoint</h3>
            <CodeBlock code="POST /graphql" />
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Example: Query Rule Sets</h3>
            <CodeBlock lang="graphql" code={`query {
  projects {
    id
    name
    ruleSets {
      id
      name
      status
      version
      ruleCount
      tableCount
    }
  }
}`} />
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Example: Execute Rules via GraphQL</h3>
            <CodeBlock lang="graphql" code={`mutation ExecuteRules($ruleSetId: ID!, $input: JSON!) {
  executeRuleSet(ruleSetId: $ruleSetId, input: $input) {
    success
    output
    rulesFired
    executionTimeMs
    error
  }
}`} />
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Example: Create a Rule</h3>
            <CodeBlock lang="graphql" code={`mutation {
  createRule(
    ruleSetId: "...",
    name: "Age Verification",
    conditions: { logic: "AND", conditions: [
      { field: "applicant.age", operator: "greaterThanOrEqual", value: 18 }
    ]},
    actions: [
      { type: "SET", field: "eligible", value: true }
    ]
  ) {
    id
    name
  }
}`} />
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-2">Async Rule Execution via Message Queue</h3>
            <p className="text-sm text-slate-500 mb-4">
              Submit rule executions to a queue for async processing. Great for batch operations and high-throughput scenarios.
            </p>
            <CodeBlock code={`# Enqueue an execution
curl -X POST http://localhost:4000/api/v1/queue/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "ruleSetId": "...",
    "input": { "applicant": { "age": 30 } },
    "callbackUrl": "https://your-app.com/webhook"
  }'

# Response: { "jobId": "abc-123", "status": "pending" }

# Check job status
curl http://localhost:4000/api/v1/queue/jobs/abc-123`} />
          </div>

          {/* Job list */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Recent Queue Jobs</h3>
            </div>
            {jobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 font-medium text-slate-500">Job ID</th>
                      <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                      <th className="text-left px-6 py-3 font-medium text-slate-500">Attempts</th>
                      <th className="text-left px-6 py-3 font-medium text-slate-500">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job: any) => (
                      <tr key={job.id} className="border-b border-slate-50">
                        <td className="px-6 py-3 font-mono text-xs text-slate-700">{job.id.slice(0, 12)}...</td>
                        <td className="px-6 py-3">
                          <span className={
                            job.status === 'completed' ? 'badge-green' :
                            job.status === 'failed' ? 'badge-red' :
                            job.status === 'processing' ? 'badge-blue' : 'badge-yellow'
                          }>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{job.attempts}</td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{new Date(job.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No queue jobs yet. Enqueue an execution to see jobs here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
  }[method] || 'bg-slate-100 text-slate-700';

  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${methodColor}`}>{method}</span>
      <code className="text-sm font-mono text-slate-700 flex-1">{path}</code>
      <span className="text-xs text-slate-500">{desc}</span>
    </div>
  );
}
