import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  FileJson,
  FolderOpen,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Eye,
} from 'lucide-react';
import api, { getProjects, getRuleSets } from '../api/client';
import { useStore } from '../store';

type ExportType = 'project' | 'ruleSet';

interface HistoryEntry {
  id: string;
  type: 'import' | 'export';
  name: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  details?: string;
}

interface ImportPreview {
  fileName: string;
  type: string;
  items: { type: string; name: string; action: string }[];
  warnings: string[];
}

export function ImportExport() {
  const { addNotification } = useStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Export state
  const [exportType, setExportType] = useState<ExportType>('project');
  const [exportEntityId, setExportEntityId] = useState('');
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: '1',
      type: 'export',
      name: 'Premium Calculator (Project)',
      status: 'success',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: '2',
      type: 'import',
      name: 'risk-rules-v2.json',
      status: 'success',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: '3',
      type: 'import',
      name: 'compliance-pack.json',
      status: 'failed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      details: 'Invalid schema version',
    },
  ]);

  useEffect(() => {
    Promise.all([
      getProjects().catch(() => []),
      getRuleSets().catch(() => []),
    ])
      .then(([p, r]) => {
        setProjects(p.projects || p || []);
        setRuleSets(r.ruleSets || r || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExport = () => {
    if (!exportEntityId) {
      addNotification({ type: 'error', message: 'Please select an item to export' });
      return;
    }
    setExporting(true);
    const endpoint =
      exportType === 'project'
        ? `/export/projects/${exportEntityId}`
        : `/export/rule-sets/${exportEntityId}`;

    api
      .get(endpoint, { responseType: 'blob' })
      .then((r) => {
        const entityName =
          exportType === 'project'
            ? projects.find((p) => p.id === exportEntityId)?.name
            : ruleSets.find((rs) => rs.id === exportEntityId)?.name;

        const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(entityName || 'export').toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);

        setHistory((prev) => [
          {
            id: String(Date.now()),
            type: 'export',
            name: `${entityName} (${exportType === 'project' ? 'Project' : 'Rule Set'})`,
            status: 'success',
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        addNotification({ type: 'success', message: 'Export downloaded successfully' });
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Export failed' });
      })
      .finally(() => setExporting(false));
  };

  const handleFileSelect = (file: File) => {
    setImportFile(file);
    // Parse and generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const items: ImportPreview['items'] = [];
        const warnings: string[] = [];

        if (data.project) {
          items.push({ type: 'Project', name: data.project.name || 'Unknown', action: 'create' });
        }
        if (data.ruleSets) {
          (Array.isArray(data.ruleSets) ? data.ruleSets : [data.ruleSets]).forEach((rs: any) => {
            items.push({ type: 'Rule Set', name: rs.name || 'Unknown', action: 'create' });
            if (rs.rules) {
              items.push({
                type: 'Rules',
                name: `${rs.rules.length} rule(s)`,
                action: 'create',
              });
            }
          });
        }
        if (data.dataModels) {
          items.push({
            type: 'Data Models',
            name: `${data.dataModels.length} model(s)`,
            action: 'create',
          });
        }
        if (items.length === 0) {
          warnings.push('Could not detect any importable entities in this file.');
        }
        if (!data.version) {
          warnings.push('No schema version detected. Compatibility may be limited.');
        }

        setImportPreview({
          fileName: file.name,
          type: data.type || 'unknown',
          items,
          warnings,
        });
      } catch {
        addNotification({ type: 'error', message: 'Invalid JSON file' });
        setImportFile(null);
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleFileSelect(file);
    } else {
      addNotification({ type: 'error', message: 'Please drop a JSON file' });
    }
  }, []);

  const handleImportConfirm = () => {
    if (!importFile) return;
    setImporting(true);

    const formData = new FormData();
    formData.append('file', importFile);

    api
      .post('/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(() => {
        setHistory((prev) => [
          {
            id: String(Date.now()),
            type: 'import',
            name: importFile.name,
            status: 'success',
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        addNotification({ type: 'success', message: 'Import completed successfully' });
        setImportFile(null);
        setImportPreview(null);
      })
      .catch(() => {
        setHistory((prev) => [
          {
            id: String(Date.now()),
            type: 'import',
            name: importFile.name,
            status: 'failed',
            timestamp: new Date().toISOString(),
            details: 'Import failed',
          },
          ...prev,
        ]);
        addNotification({ type: 'error', message: 'Import failed' });
      })
      .finally(() => setImporting(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <FileJson className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Import & Export</h1>
          <p className="text-sm text-slate-500">
            Transfer projects and rule sets between environments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Download className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900">Export</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Export Type</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setExportType('project');
                    setExportEntityId('');
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    exportType === 'project'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 inline mr-1.5" />
                  Project
                </button>
                <button
                  onClick={() => {
                    setExportType('ruleSet');
                    setExportEntityId('');
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    exportType === 'ruleSet'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileJson className="w-4 h-4 inline mr-1.5" />
                  Rule Set
                </button>
              </div>
            </div>
            <div>
              <label className="label">
                Select {exportType === 'project' ? 'Project' : 'Rule Set'}
              </label>
              <select
                className="input"
                value={exportEntityId}
                onChange={(e) => setExportEntityId(e.target.value)}
              >
                <option value="">Choose...</option>
                {(exportType === 'project' ? projects : ruleSets).map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExport}
              className="btn-primary w-full"
              disabled={!exportEntityId || exporting}
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export as JSON'}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900">Import</h3>
          </div>
          <div className="p-6 space-y-4">
            {!importPreview ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  Drop a JSON file here or click to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports project and rule set exports
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-brand-600" />
                    <span className="text-sm font-medium text-slate-900">
                      {importPreview.fileName}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview(null);
                    }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview items */}
                <div>
                  <label className="label">What will be imported</label>
                  <div className="space-y-2">
                    {importPreview.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-emerald-50 rounded-lg px-3 py-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-800 font-medium">{item.type}:</span>
                        <span className="text-emerald-700">{item.name}</span>
                        <span className="badge-green ml-auto">{item.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {importPreview.warnings.length > 0 && (
                  <div className="space-y-2">
                    {importPreview.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-700"
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleImportConfirm}
                  className="btn-primary w-full"
                  disabled={importing}
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History section */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Recent Activity</h3>
        </div>
        {history.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {history.map((entry) => (
              <div key={entry.id} className="px-6 py-4 flex items-center gap-4">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    entry.type === 'export' ? 'bg-blue-50' : 'bg-purple-50'
                  }`}
                >
                  {entry.type === 'export' ? (
                    <Download className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Upload className="w-4 h-4 text-purple-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-900">{entry.name}</span>
                    <span
                      className={
                        entry.status === 'success'
                          ? 'badge-green'
                          : entry.status === 'failed'
                            ? 'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full'
                            : 'badge-yellow'
                      }
                    >
                      {entry.status}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-slate-500 mt-0.5">{entry.details}</p>
                  )}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <FileJson className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No import/export activity yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
