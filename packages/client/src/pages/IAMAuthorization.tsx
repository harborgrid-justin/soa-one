import { useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { checkIAMAuthorization } from '../api/client';
import { useStore } from '../store';

export function IAMAuthorization() {
  const [subjectId, setSubjectId] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('read');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { addNotification } = useStore();

  const ACTIONS = ['read', 'write', 'create', 'delete', 'admin', 'execute', 'approve'];

  const handleCheck = async () => {
    if (!subjectId.trim() || !resource.trim()) return;
    setLoading(true);
    try {
      const res = await checkIAMAuthorization({ subjectId: subjectId.trim(), resource: resource.trim(), action });
      setResult(res);
    } catch (e: any) {
      setResult({ allowed: false, error: e?.response?.data?.message || 'Authorization check failed' });
      addNotification({ type: 'error', message: 'Authorization check failed' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Check authorization decisions for identity-resource-action combinations.</p>
      <div className="card p-6">
        <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Authorization Check</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Subject ID</label><input className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)} placeholder="Identity or principal ID" /></div>
            <div><label className="label">Resource</label><input className="input" value={resource} onChange={e => setResource(e.target.value)} placeholder="resource:path" /></div>
            <div><label className="label">Action</label><select className="input" value={action} onChange={e => setAction(e.target.value)}>{ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCheck} className="btn-primary" disabled={loading || !subjectId.trim() || !resource.trim()}>
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
              Check Authorization
            </button>
          </div>
        </div>
      </div>
      {result && (
        <div className={`card p-6 border-2 ${result.allowed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result.allowed ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className={`text-lg font-bold ${result.allowed ? 'text-emerald-700' : 'text-red-700'}`}>{result.allowed ? 'ALLOWED' : 'DENIED'}</div>
              <div className="text-sm text-slate-600">{result.reason || result.error || `${action} on ${resource} for ${subjectId}`}</div>
            </div>
          </div>
          {result.policies && (
            <div className="mt-4 space-y-1">
              <div className="text-sm font-medium text-slate-700">Matching Policies:</div>
              {result.policies.map((p: any, i: number) => <div key={i} className="text-xs px-3 py-1.5 bg-white rounded">{p.name || p}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
