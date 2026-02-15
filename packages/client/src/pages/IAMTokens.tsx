import { useEffect, useState } from 'react';
import { Key, Plus } from 'lucide-react';
import { getIAMMetrics, issueIAMToken } from '../api/client';

export function IAMTokens() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tokenType, setTokenType] = useState('access_token');
  const [identityId, setIdentityId] = useState('');

  useEffect(() => {
    getIAMMetrics().then(setMetrics).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-sm text-slate-500">Token Service — issue, validate, and revoke JWT access tokens, refresh tokens, and API keys.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Tokens Issued</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.tokensIssued || 0}</div>
          </div>
        </div>
        <div className="card">
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Tokens Revoked</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.tokensRevoked || 0}</div>
          </div>
        </div>
        <div className="card">
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Active Tokens</div>
            <div className="text-2xl font-semibold text-slate-900">{metrics?.activeTokens || 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Issue Token</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Token Type</label>
            <select
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="access_token">Access Token</option>
              <option value="refresh_token">Refresh Token</option>
              <option value="id_token">ID Token</option>
              <option value="api_key">API Key</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Identity ID</label>
            <input
              type="text"
              value={identityId}
              onChange={(e) => setIdentityId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="user:alice"
            />
          </div>
          <button
            disabled={!identityId}
            onClick={() => {
              issueIAMToken({ type: tokenType, identityId })
                .then(() => getIAMMetrics().then(setMetrics))
                .catch(() => {});
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Issue Token
          </button>
        </div>
      </div>
    </div>
  );
}
