import { useState } from 'react';
import {
  Search, FileText, Clock, Filter, Shield,
} from 'lucide-react';
import { searchCMSDocuments } from '../api/client';
import type { CMSSearchResult } from '../types';

const CATEGORIES = ['document', 'spreadsheet', 'presentation', 'image', 'video', 'report', 'contract', 'invoice', 'policy', 'template'];
const STATUSES = ['draft', 'pending-review', 'in-review', 'approved', 'published', 'archived'];
const SECURITY_LEVELS = ['public', 'internal', 'confidential', 'restricted', 'top-secret'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-gray',
  'pending-review': 'badge-yellow',
  'in-review': 'badge-yellow',
  approved: 'badge-green',
  published: 'badge-green',
  archived: 'badge-gray',
};

export function CMSSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [securityLevel, setSecurityLevel] = useState('');
  const [result, setResult] = useState<CMSSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const params: any = {};
      if (query.trim()) params.q = query.trim();
      if (category) params.category = category;
      if (status) params.status = status;
      if (securityLevel) params.securityLevel = securityLevel;
      const data = await searchCMSDocuments(params);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Full-text search across all documents, metadata, and content.</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-10 text-base"
            placeholder="Search documents by name, description, or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select className="input py-1.5 text-sm w-40" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select className="input py-1.5 text-sm w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
        </select>
        <select className="input py-1.5 text-sm w-44" value={securityLevel} onChange={(e) => setSecurityLevel(e.target.value)}>
          <option value="">All Security Levels</option>
          {SECURITY_LEVELS.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
        </select>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && searched && result && (
        <div>
          <div className="text-sm text-slate-500 mb-4">
            {result.total} result{result.total !== 1 ? 's' : ''} {result.query && `for "${result.query}"`}
          </div>

          {result.results.length > 0 ? (
            <div className="card divide-y divide-slate-100">
              {result.results.map((doc) => (
                <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{doc.name}</div>
                      {doc.description && (
                        <div className="text-sm text-slate-500 truncate">{doc.description}</div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="capitalize">{doc.category}</span>
                        <span className="text-slate-300">|</span>
                        <span>{formatBytes(doc.sizeBytes)}</span>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{doc.securityLevel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1">
                        {doc.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{tag}</span>
                        ))}
                      </div>
                    )}
                    <span className={STATUS_COLORS[doc.status] || 'badge-gray'}>{doc.status}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">No results found</h3>
              <p className="text-sm text-slate-500">Try adjusting your search query or filters.</p>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="card p-16 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">Search your content</h3>
          <p className="text-sm text-slate-500">Enter a search query or apply filters to find documents.</p>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
