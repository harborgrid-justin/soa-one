import { useEffect, useState } from 'react';
import { Share2, ArrowRight } from 'lucide-react';
import { getDILineage } from '../api/client';

export function DILineage() {
  const [data, setData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDILineage().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TYPE_COLORS: Record<string, string> = {
    source: 'text-blue-600 bg-blue-50',
    table: 'text-emerald-600 bg-emerald-50',
    pipeline: 'text-violet-600 bg-violet-50',
    transformation: 'text-amber-600 bg-amber-50',
    destination: 'text-pink-600 bg-pink-50',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Data lineage tracking — trace data flow from sources through transformations to destinations.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{data.nodes.length}</div>
          <div className="text-xs text-slate-500">Lineage Nodes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{data.edges.length}</div>
          <div className="text-xs text-slate-500">Data Flows</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{data.nodes.filter((n: any) => n.isRoot).length}</div>
          <div className="text-xs text-slate-500">Root Sources</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{data.nodes.filter((n: any) => n.isLeaf).length}</div>
          <div className="text-xs text-slate-500">Leaf Destinations</div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Lineage Nodes</h2>
        </div>
        {data.nodes.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.nodes.map((node: any) => (
              <div key={node.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TYPE_COLORS[node.type] ?? 'text-slate-600 bg-slate-50'}`}>
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{node.name}</div>
                    <div className="text-xs text-slate-500">{node.type}{node.description ? ` — ${node.description}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {node.isRoot && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">root</span>}
                  {node.isLeaf && <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">leaf</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No lineage data yet.</div>
        )}
      </div>
    </div>
  );
}
