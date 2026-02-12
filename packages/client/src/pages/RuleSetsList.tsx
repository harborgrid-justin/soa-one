import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus, FileCheck, Table2 } from 'lucide-react';
import { getRuleSets } from '../api/client';
import { EmptyState } from '../components/common/EmptyState';
import type { RuleSet } from '../types';

export function RuleSetsList() {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getRuleSets()
      .then(setRuleSets)
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
      <p className="text-sm text-slate-500">All rule sets across your projects.</p>

      {ruleSets.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-8 h-8" />}
          title="No rule sets yet"
          description="Create a rule set from a project page to get started."
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {ruleSets.map((rs) => (
            <div
              key={rs.id}
              className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer flex items-center justify-between"
              onClick={() => navigate(`/rule-sets/${rs.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{rs.name}</div>
                  <div className="text-xs text-slate-500">{rs.description || 'No description'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    {rs._count?.rules ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Table2 className="w-3.5 h-3.5" />
                    {rs._count?.decisionTables ?? 0}
                  </span>
                </div>
                <span className={rs.status === 'published' ? 'badge-green' : rs.status === 'archived' ? 'badge-gray' : 'badge-yellow'}>
                  {rs.status}
                </span>
                <span className="badge-gray text-[10px]">v{rs.version}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
