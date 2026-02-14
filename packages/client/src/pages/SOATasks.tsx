import { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getSOATasks } from '../api/client';

export function SOATasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSOATasks().then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    ready: 'bg-blue-100 text-blue-700',
    reserved: 'bg-amber-100 text-amber-700',
    'in-progress': 'bg-violet-100 text-violet-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    suspended: 'bg-slate-100 text-slate-600',
  };

  const PRIORITY_COLORS: Record<number, string> = {
    1: 'text-red-600',
    2: 'text-amber-600',
    3: 'text-slate-600',
    4: 'text-slate-400',
    5: 'text-slate-300',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Human Task Manager — create, claim, delegate, escalate, and complete human workflow tasks with SLA tracking.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{tasks.filter((t) => t.status === 'ready').length}</div>
          <div className="text-xs text-slate-500">Ready</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-violet-600">{tasks.filter((t) => t.status === 'in-progress').length}</div>
          <div className="text-xs text-slate-500">In Progress</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{tasks.filter((t) => t.status === 'completed').length}</div>
          <div className="text-xs text-slate-500">Completed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{tasks.filter((t) => t.status === 'failed').length}</div>
          <div className="text-xs text-slate-500">Failed</div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Tasks ({tasks.length})</h2>
        </div>
        {tasks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {tasks.map((t: any) => (
              <div key={t.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-violet-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500">
                      {t.assignee ? `Assigned: ${t.assignee}` : 'Unassigned'}
                      {t.dueDate && ` — Due: ${new Date(t.dueDate).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? 'text-slate-400'}`}>
                    P{t.priority}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No tasks created yet.</div>
        )}
      </div>
    </div>
  );
}
