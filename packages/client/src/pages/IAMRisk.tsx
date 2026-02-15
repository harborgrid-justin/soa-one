import { useState } from 'react';
import { AlertTriangle, Search, Shield } from 'lucide-react';
import { assessIAMRisk, getIAMRiskAssessment, getIAMAnomalies } from '../api/client';
import { useStore } from '../store';
import { useEffect } from 'react';

const RISK_COLORS: Record<string, string> = { low: 'bg-emerald-50 text-emerald-700', medium: 'bg-amber-50 text-amber-700', high: 'bg-orange-50 text-orange-700', critical: 'bg-red-50 text-red-700' };

export function IAMRisk() {
  const [identityId, setIdentityId] = useState('');
  const [assessment, setAssessment] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { addNotification } = useStore();

  useEffect(() => { getIAMAnomalies().then(setAnomalies).catch(() => {}); }, []);

  const handleAssess = async () => {
    if (!identityId.trim()) return;
    setLoading(true);
    try {
      const res = await assessIAMRisk({ identityId: identityId.trim() });
      setAssessment(res);
    } catch {
      // Try GET assessment instead
      try { const res = await getIAMRiskAssessment(identityId.trim()); setAssessment(res); } catch { addNotification({ type: 'error', message: 'Risk assessment failed' }); setAssessment(null); }
    } finally { setLoading(false); }
  };

  const riskLevel = assessment?.riskLevel || assessment?.level || 'unknown';
  const riskScore = assessment?.score ?? assessment?.riskScore;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Assess identity risk and detect behavioral anomalies.</p>
      <div className="card p-6">
        <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Risk Assessment</h3>
        <div className="flex gap-3">
          <input className="input flex-1" value={identityId} onChange={e => setIdentityId(e.target.value)} placeholder="Enter identity ID to assess" />
          <button onClick={handleAssess} className="btn-primary" disabled={loading || !identityId.trim()}>
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            Assess
          </button>
        </div>
      </div>
      {assessment && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${RISK_COLORS[riskLevel] || 'bg-slate-100 text-slate-700'}`}>
              <span className="text-2xl font-bold">{riskScore != null ? riskScore : '?'}</span>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">Risk Level: <span className={`px-2 py-0.5 rounded text-sm ${RISK_COLORS[riskLevel] || 'bg-slate-100'}`}>{riskLevel.toUpperCase()}</span></div>
              <div className="text-sm text-slate-500">Identity: {identityId}</div>
            </div>
          </div>
          {assessment.factors && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Risk Factors:</div>
              {(Array.isArray(assessment.factors) ? assessment.factors : []).map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                  <span>{f.name || f}</span>
                  {f.score != null && <span className="font-medium">{f.score}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Detected Anomalies</h3>
          {anomalies.map((a: any, i: number) => (
            <div key={a.id || i} className="card px-6 py-4 flex items-center justify-between border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div><div className="font-medium text-amber-800">{a.type || a.name || 'Anomaly'}</div><div className="text-xs text-amber-600">{a.identityId || '—'} · {a.description || ''}{a.timestamp ? ` · ${new Date(a.timestamp).toLocaleString()}` : ''}</div></div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[a.severity] || RISK_COLORS.medium}`}>{a.severity || 'medium'}</span>
            </div>
          ))}
        </div>
      )}
      {!assessment && anomalies.length === 0 && (
        <div className="card p-12 text-center"><Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="font-semibold text-slate-900 mb-1">No assessments yet</h3><p className="text-sm text-slate-500">Enter an identity ID to perform a risk assessment.</p></div>
      )}
    </div>
  );
}
