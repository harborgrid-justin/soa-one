import { useEffect, useState } from 'react';
import { Inbox, AlertTriangle } from 'lucide-react';
import { getDQMQueues } from '../api/client';

export function DQMQueues() {
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDQMQueues().then(setQueues).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Manage message queues — standard, priority, FIFO, and delay queues with dead-letter support.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Queues ({queues.length})</h2>
        </div>
        {queues.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {queues.map((q: any) => (
              <div key={q.name} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Inbox className="w-4 h-4 text-violet-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{q.name}</div>
                    <div className="text-xs text-slate-500">
                      {q.type} — depth: {q.depth} — enqueued: {q.enqueued} / dequeued: {q.dequeued}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {q.deadLetterDepth > 0 && (
                    <span className="badge-red">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {q.deadLetterDepth} DLQ
                    </span>
                  )}
                  <span className="badge-green">active</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No queues configured yet.</div>
        )}
      </div>
    </div>
  );
}
