import { useEffect, useState } from 'react';
import { ScanSearch, Play } from 'lucide-react';
import { profileDQMDataset, profileDQMColumn } from '../api/client';
import { Modal } from '../components/common/Modal';
import { useStore } from '../store';

export function DQMProfiling() {
  const [showProfile, setShowProfile] = useState(false);
  const [profileType, setProfileType] = useState<'dataset' | 'column'>('dataset');
  const [datasetName, setDatasetName] = useState('');
  const [columnName, setColumnName] = useState('');
  const [tableName, setTableName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [profiling, setProfiling] = useState(false);
  const { addNotification } = useStore();

  const handleProfile = async () => {
    if (profileType === 'dataset' && !datasetName.trim()) return;
    if (profileType === 'column' && (!tableName.trim() || !columnName.trim())) return;
    setProfiling(true);
    try {
      const data = profileType === 'dataset'
        ? await profileDQMDataset({ name: datasetName.trim() })
        : await profileDQMColumn({ table: tableName.trim(), column: columnName.trim() });
      setResult(data);
      addNotification({ type: 'success', message: 'Profiling complete' });
    } catch { addNotification({ type: 'error', message: 'Profiling failed' }); }
    setProfiling(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Profile datasets and columns to understand data characteristics.</p>
        <button onClick={() => { setShowProfile(true); setResult(null); }} className="btn-primary btn-sm"><Play className="w-3.5 h-3.5" /> Run Profile</button>
      </div>

      {result ? (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><ScanSearch className="w-5 h-5" /> Profile Results</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {result.rowCount != null && <div className="text-center p-3 bg-slate-50 rounded"><div className="text-xl font-bold">{result.rowCount.toLocaleString()}</div><div className="text-xs text-slate-500">Rows</div></div>}
            {result.columnCount != null && <div className="text-center p-3 bg-slate-50 rounded"><div className="text-xl font-bold">{result.columnCount}</div><div className="text-xs text-slate-500">Columns</div></div>}
            {result.nullPercentage != null && <div className="text-center p-3 bg-slate-50 rounded"><div className="text-xl font-bold">{result.nullPercentage}%</div><div className="text-xs text-slate-500">Null %</div></div>}
            {result.uniquePercentage != null && <div className="text-center p-3 bg-slate-50 rounded"><div className="text-xl font-bold">{result.uniquePercentage}%</div><div className="text-xs text-slate-500">Unique %</div></div>}
          </div>
          {result.statistics && (
            <div className="space-y-2 text-sm">{Object.entries(result.statistics).map(([k, v]: any) => (
              <div key={k} className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-500">{k}</span><span className="font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span></div>
            ))}</div>
          )}
          {result.columns && Array.isArray(result.columns) && (
            <div className="mt-4 space-y-2">{result.columns.map((col: any, i: number) => (
              <div key={i} className="p-3 bg-slate-50 rounded flex items-center justify-between">
                <span className="font-medium text-sm">{col.name}</span>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>type: {col.dataType || col.type || '—'}</span>
                  <span>null: {col.nullPercentage ?? '—'}%</span>
                  <span>unique: {col.uniquePercentage ?? col.distinctCount ?? '—'}</span>
                </div>
              </div>
            ))}</div>
          )}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <ScanSearch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-1">No profiling results</h3>
          <p className="text-sm text-slate-500 mb-4">Run a profile on a dataset or column to analyze data quality.</p>
          <button onClick={() => setShowProfile(true)} className="btn-primary"><Play className="w-4 h-4" /> Run Profile</button>
        </div>
      )}

      <Modal open={showProfile} onClose={() => setShowProfile(false)} title="Run Data Profile">
        <div className="space-y-4">
          <div><label className="label">Profile Type</label>
            <div className="flex gap-3">
              <button onClick={() => setProfileType('dataset')} className={`flex-1 p-3 rounded-lg border text-sm ${profileType === 'dataset' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>Dataset</button>
              <button onClick={() => setProfileType('column')} className={`flex-1 p-3 rounded-lg border text-sm ${profileType === 'column' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>Column</button>
            </div>
          </div>
          {profileType === 'dataset' ? (
            <div><label className="label">Dataset Name</label><input className="input" placeholder="e.g., customers" value={datasetName} onChange={e => setDatasetName(e.target.value)} autoFocus /></div>
          ) : (
            <div className="grid grid-cols-2 gap-4"><div><label className="label">Table</label><input className="input" value={tableName} onChange={e => setTableName(e.target.value)} autoFocus /></div><div><label className="label">Column</label><input className="input" value={columnName} onChange={e => setColumnName(e.target.value)} /></div></div>
          )}
          <div className="flex justify-end gap-3 pt-2"><button onClick={() => setShowProfile(false)} className="btn-secondary">Cancel</button><button onClick={handleProfile} className="btn-primary" disabled={profiling}>{profiling ? 'Profiling...' : 'Run'}</button></div>
        </div>
      </Modal>
    </div>
  );
}
