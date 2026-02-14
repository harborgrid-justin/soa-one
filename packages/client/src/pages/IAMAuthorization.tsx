import { useState } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { checkIAMAuthorization } from '../api/client';

export function IAMAuthorization() {
  const [subjectId, setSubjectId] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await checkIAMAuthorization({ subjectId, resource, action });
      setResult(res);
    } catch (error) {
      setResult({ allowed: false, error: 'Authorization check failed' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Authorization Testing — test RBAC, ABAC, and PBAC authorization decisions in real time.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Check Authorization</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject ID</label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="user:alice"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Resource</label>
            <input
              type="text"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="document:123"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="read"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={checking || !subjectId || !resource || !action}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shield className="w-4 h-4" />
            {checking ? 'Checking...' : 'Check Authorization'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Result</h2>
          </div>
          <div className="p-6">
            <div className={`flex items-center gap-3 p-4 rounded-md ${result.allowed ? 'bg-green-50' : 'bg-red-50'}`}>
              {result.allowed ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <div className={`font-semibold ${result.allowed ? 'text-green-900' : 'text-red-900'}`}>
                  {result.allowed ? 'Allowed' : 'Denied'}
                </div>
                {result.error && (
                  <div className="text-sm text-red-700 mt-1">{result.error}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
