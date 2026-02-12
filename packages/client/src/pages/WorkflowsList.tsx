import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow, Plus, Play, GitBranch } from 'lucide-react';
import { getWorkflows } from '../api/client';
import { EmptyState } from '../components/common/EmptyState';

export function WorkflowsList() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getWorkflows()
      .then(setWorkflows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Visual BPMN workflow designer. Create process flows that orchestrate rule sets, services, and decisions.</p>

      {workflows.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-8 h-8" />}
          title="No workflows yet"
          description="Create a workflow from a project page to start designing process flows."
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex items-center justify-between"
              onClick={() => navigate(`/workflows/${wf.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{wf.name}</div>
                  <div className="text-xs text-slate-500">
                    {wf.nodes?.length || 0} nodes, {wf.edges?.length || 0} connections
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{wf.instanceCount || 0} runs</span>
                <span className={wf.status === 'active' ? 'badge-green' : wf.status === 'archived' ? 'badge-gray' : 'badge-yellow'}>
                  {wf.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
