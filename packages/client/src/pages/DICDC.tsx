import { useEffect, useState } from 'react';
import { Radio, CheckCircle } from 'lucide-react';
import { getDICDCStreams } from '../api/client';

export function DICDC() {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDICDCStreams().then(setStreams).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    streaming: 'badge-green',
    idle: 'badge-gray',
    paused: 'badge-yellow',
    error: 'badge-red',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Change Data Capture streams — real-time change tracking from source databases.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">CDC Streams ({streams.length})</h2>
        </div>
        {streams.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {streams.map((s) => (
              <div key={s.streamId} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{s.name ?? s.streamId}</div>
                    <div className="text-xs text-slate-500">
                      {s.eventsProcessed ?? 0} events processed
                      {s.captureMethod ? ` — ${s.captureMethod}` : ''}
                    </div>
                  </div>
                </div>
                <span className={STATUS_COLORS[s.status] ?? 'badge-gray'}>{s.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No CDC streams configured yet.</div>
        )}
      </div>
    </div>
  );
}
