import { useEffect, useState } from 'react';
import { BookOpen, Search, Shield } from 'lucide-react';
import { getDICatalog } from '../api/client';

export function DICatalog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const load = (text?: string) => {
    setLoading(true);
    getDICatalog({ text: text || undefined, limit: 50 })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => { load(searchText); };

  const SENSITIVITY_COLORS: Record<string, string> = {
    pii: 'bg-red-100 text-red-700',
    phi: 'bg-orange-100 text-orange-700',
    pci: 'bg-amber-100 text-amber-700',
    confidential: 'bg-yellow-100 text-yellow-700',
    internal: 'bg-blue-100 text-blue-700',
    public: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Enterprise data catalog — discover, classify, and govern data assets.</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search catalog entries..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition-colors">
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Catalog Entries ({entries.length})</h2>
          </div>
          {entries.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {entries.map((entry: any) => (
                <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{entry.name}</div>
                      <div className="text-xs text-slate-500">{entry.type}{entry.schema ? ` — ${entry.schema}` : ''}{entry.connectorId ? ` (${entry.connectorId})` : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.sensitivity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENSITIVITY_COLORS[entry.sensitivity] ?? 'bg-slate-100 text-slate-600'}`}>
                        {entry.sensitivity}
                      </span>
                    )}
                    {entry.tags?.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No catalog entries found.</div>
          )}
        </div>
      )}
    </div>
  );
}
