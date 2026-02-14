import { useState } from 'react';
import { Search, BarChart3 } from 'lucide-react';
import { profileDQMDataset } from '../api/client';

export function DQMProfiling() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sampleData, setSampleData] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleProfile = () => {
    if (!datasetName || !sampleData) return;
    setLoading(true);
    setError(null);
    try {
      const rows = JSON.parse(sampleData);
      profileDQMDataset({ name: datasetName, rows })
        .then(setResult)
        .catch((e) => setError(e?.response?.data?.error ?? 'Profiling failed'))
        .finally(() => setLoading(false));
    } catch {
      setError('Invalid JSON — provide an array of row objects');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Profile datasets to discover column types, statistics, patterns, completeness, and correlations.</p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Profile a Dataset</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Dataset Name</label>
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="e.g. customer_records"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sample Data (JSON array of objects)</label>
          <textarea
            value={sampleData}
            onChange={(e) => setSampleData(e.target.value)}
            rows={6}
            placeholder={'[\n  { "name": "Alice", "age": 30, "email": "alice@example.com" },\n  { "name": "Bob", "age": null, "email": "bob@example" }\n]'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          onClick={handleProfile}
          disabled={loading || !datasetName || !sampleData}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Profiling...' : 'Run Profile'}
        </button>
      </div>

      {result && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Profile Results — {result.name ?? datasetName}</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{result.rowCount ?? 0}</div>
                <div className="text-xs text-slate-500">Rows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{result.columnCount ?? result.columns?.length ?? 0}</div>
                <div className="text-xs text-slate-500">Columns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{((result.completeness ?? 0) * 100).toFixed(1)}%</div>
                <div className="text-xs text-slate-500">Completeness</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{result.duplicateRows ?? 0}</div>
                <div className="text-xs text-slate-500">Duplicate Rows</div>
              </div>
            </div>
            {result.columns && result.columns.length > 0 && (
              <div className="divide-y divide-slate-100">
                {result.columns.map((col: any) => (
                  <div key={col.name} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{col.name}</div>
                        <div className="text-xs text-slate-500">
                          {col.inferredType} — {((col.completeness ?? 0) * 100).toFixed(0)}% complete — {col.uniqueCount ?? 0} unique
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
