import { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle } from 'lucide-react';
import { getDQMTopics } from '../api/client';

export function DQMTopics() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDQMTopics().then(setTopics).catch(() => {}).finally(() => setLoading(false));
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
      <div>
        <p className="text-sm text-slate-500">Manage pub/sub topics — publish messages, manage subscriptions, and monitor backlogs.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Topics ({topics.length})</h2>
        </div>
        {topics.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {topics.map((t: any) => (
              <div key={t.name} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">
                      {t.type} — {t.subscriptionCount} subscribers — backlog: {t.messageBacklog}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{t.published} published / {t.delivered} delivered</span>
                  <span className="badge-green">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    active
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No topics configured yet.</div>
        )}
      </div>
    </div>
  );
}
