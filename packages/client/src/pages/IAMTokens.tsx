import { useEffect, useState } from 'react';
import { Key, Plus, XCircle } from 'lucide-react';
import { issueIAMToken, validateIAMToken, revokeIAMToken } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

const TOKEN_TYPES = ['access', 'refresh', 'api-key', 'service', 'temporary'];

export function IAMTokens() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newType, setNewType] = useState('access');
  const [newExpiry, setNewExpiry] = useState('3600');
  const [validateId, setValidateId] = useState('');
  const [validateResult, setValidateResult] = useState<any>(null);
  const { addNotification } = useStore();

  // Tokens don't have a list endpoint, so we track issued tokens locally
  const load = () => { setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleIssue = async () => {
    if (!newSubject.trim()) return;
    try {
      const token = await issueIAMToken({ subject: newSubject.trim(), type: newType, expiresIn: parseInt(newExpiry) || 3600 });
      setTokens(prev => [token, ...prev]);
      addNotification({ type: 'success', message: 'Token issued' });
      setShowIssue(false); setNewSubject(''); setNewType('access'); setNewExpiry('3600');
    } catch { addNotification({ type: 'error', message: 'Failed to issue token' }); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token?')) return;
    try { await revokeIAMToken(id); setTokens(prev => prev.map(t => t.id === id ? { ...t, status: 'revoked' } : t)); addNotification({ type: 'success', message: 'Token revoked' }); } catch { addNotification({ type: 'error', message: 'Failed to revoke token' }); }
  };

  const handleValidate = async () => {
    if (!validateId.trim()) return;
    try { const res = await validateIAMToken(validateId.trim()); setValidateResult(res); } catch { setValidateResult({ valid: false, error: 'Token validation failed' }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Issue, validate and revoke security tokens.</p>
        <button onClick={() => setShowIssue(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Issue Token</button>
      </div>
      <div className="card p-4">
        <h3 className="font-medium text-slate-900 mb-3">Validate Token</h3>
        <div className="flex gap-3">
          <input className="input flex-1" value={validateId} onChange={e => setValidateId(e.target.value)} placeholder="Enter token ID to validate" />
          <button onClick={handleValidate} className="btn-secondary" disabled={!validateId.trim()}>Validate</button>
        </div>
        {validateResult && (
          <div className={`mt-3 p-3 rounded text-sm ${validateResult.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {validateResult.valid ? 'Token is valid' : validateResult.error || 'Token is invalid'}
            {validateResult.subject && <span className="ml-2">· Subject: {validateResult.subject}</span>}
            {validateResult.expiresAt && <span className="ml-2">· Expires: {new Date(validateResult.expiresAt).toLocaleString()}</span>}
          </div>
        )}
      </div>
      {tokens.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-slate-900">Issued Tokens</h3>
          {tokens.map((t) => (
            <div key={t.id} className="card px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Key className="w-5 h-5" /></div>
                <div>
                  <div className="font-medium text-slate-900">{t.subject || t.id?.slice(0, 12)}</div>
                  <div className="text-xs text-slate-500">{t.type || 'access'}{t.expiresAt ? ` · Expires ${new Date(t.expiresAt).toLocaleString()}` : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'revoked' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{t.status || 'active'}</span>
                {t.status !== 'revoked' && <button onClick={() => handleRevoke(t.id)} className="btn-secondary btn-sm text-red-600"><XCircle className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {tokens.length === 0 && (
        <div className="card p-12 text-center"><Key className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No tokens issued</h3><p className="text-sm text-slate-500">Issue tokens to authenticate services and users.</p></div>
      )}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Issue Token">
        <div className="space-y-4">
          <div><label className="label">Subject</label><input className="input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Identity or service ID" autoFocus /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label><select className="input" value={newType} onChange={e => setNewType(e.target.value)}>{TOKEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label">Expires In (seconds)</label><input className="input" type="number" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowIssue(false)} className="btn-secondary">Cancel</button><button onClick={handleIssue} className="btn-primary" disabled={!newSubject.trim()}>Issue</button></div>
        </div>
      </Modal>
    </div>
  );
}
