import { useEffect, useState } from 'react';
import {
  FileBarChart,
  Download,
  RefreshCw,
  Play,
  Calendar,
  Clock,
  FileText,
  Trash2,
  Eye,
  ChevronRight,
  Filter,
} from 'lucide-react';
import api from '../api/client';
import { useStore } from '../store';

type ReportType = 'audit-trail' | 'change-summary' | 'decision-report' | 'compliance-status';

interface ReportConfig {
  type: ReportType;
  label: string;
  description: string;
  fields: string[];
}

interface Report {
  id: string;
  type: ReportType;
  name: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  params: any;
  content?: any;
  downloadUrl?: string;
}

const REPORT_TYPES: ReportConfig[] = [
  {
    type: 'audit-trail',
    label: 'Audit Trail',
    description: 'Complete history of all changes and actions taken',
    fields: ['dateRange', 'entity'],
  },
  {
    type: 'change-summary',
    label: 'Change Summary',
    description: 'Summary of rule set and workflow changes over time',
    fields: ['dateRange', 'entity'],
  },
  {
    type: 'decision-report',
    label: 'Decision Report',
    description: 'Detailed report of rule execution decisions',
    fields: ['dateRange', 'ruleSet'],
  },
  {
    type: 'compliance-status',
    label: 'Compliance Status',
    description: 'Current compliance posture across all frameworks',
    fields: ['framework'],
  },
];

export function ReportGenerator() {
  const { addNotification } = useStore();
  const [selectedType, setSelectedType] = useState<ReportType>('audit-trail');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [frameworks, setFrameworks] = useState<any[]>([]);

  // Form state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [ruleSetFilter, setRuleSetFilter] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports');
      setReports(res.data.reports || res.data || []);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load reports' });
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectors = async () => {
    try {
      const [rsRes, fwRes] = await Promise.all([
        api.get('/rule-sets'),
        api.get('/compliance'),
      ]);
      setRuleSets(rsRes.data.ruleSets || rsRes.data || []);
      setFrameworks(fwRes.data.frameworks || fwRes.data || []);
    } catch {
      // Non-critical, selectors may be empty
    }
  };

  useEffect(() => {
    fetchReports();
    fetchSelectors();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const params: any = { type: selectedType };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (entityFilter) params.entity = entityFilter;
    if (ruleSetFilter) params.ruleSetId = ruleSetFilter;
    if (frameworkFilter) params.frameworkId = frameworkFilter;

    try {
      const res = await api.post('/reports/generate', params);
      addNotification({ type: 'success', message: 'Report generation started' });
      // Poll or just refresh
      if (res.data.report) {
        setPreviewReport(res.data.report);
      }
      fetchReports();
    } catch {
      addNotification({ type: 'error', message: 'Failed to generate report' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (report: Report) => {
    if (report.downloadUrl) {
      window.open(report.downloadUrl, '_blank');
    } else if (report.content) {
      const blob = new Blob([JSON.stringify(report.content, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.type}-${report.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/reports/${id}`);
      addNotification({ type: 'success', message: 'Report deleted' });
      if (previewReport?.id === id) setPreviewReport(null);
      fetchReports();
    } catch {
      addNotification({ type: 'error', message: 'Failed to delete report' });
    }
  };

  const handlePreview = async (report: Report) => {
    if (report.content) {
      setPreviewReport(report);
      return;
    }
    try {
      const res = await api.get(`/reports/${report.id}`);
      setPreviewReport(res.data.report || res.data);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load report content' });
    }
  };

  const currentConfig = REPORT_TYPES.find((rt) => rt.type === selectedType)!;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-green';
      case 'generating':
        return 'badge-yellow';
      case 'failed':
        return 'badge-gray';
      default:
        return 'badge-gray';
    }
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
          <FileBarChart className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Report Generator</h1>
          <p className="text-sm text-slate-500">Generate compliance and audit reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Report configuration */}
        <div className="space-y-4">
          {/* Report type selector */}
          <div className="card p-5">
            <label className="label">Report Type</label>
            <div className="space-y-2 mt-2">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.type}
                  onClick={() => setSelectedType(rt.type)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedType === rt.type
                      ? 'border-brand-300 bg-brand-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm text-slate-900">{rt.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{rt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic form */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Parameters</h3>

            {currentConfig.fields.includes('dateRange') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">From</label>
                  <input
                    className="input"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">To</label>
                  <input
                    className="input"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            {currentConfig.fields.includes('entity') && (
              <div>
                <label className="label">Entity Filter</label>
                <select
                  className="input"
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                >
                  <option value="">All entities</option>
                  <option value="project">Projects</option>
                  <option value="ruleSet">Rule Sets</option>
                  <option value="rule">Rules</option>
                  <option value="workflow">Workflows</option>
                  <option value="user">Users</option>
                </select>
              </div>
            )}

            {currentConfig.fields.includes('ruleSet') && (
              <div>
                <label className="label">Rule Set</label>
                <select
                  className="input"
                  value={ruleSetFilter}
                  onChange={(e) => setRuleSetFilter(e.target.value)}
                >
                  <option value="">All rule sets</option>
                  {ruleSets.map((rs: any) => (
                    <option key={rs.id} value={rs.id}>
                      {rs.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentConfig.fields.includes('framework') && (
              <div>
                <label className="label">Framework</label>
                <select
                  className="input"
                  value={frameworkFilter}
                  onChange={(e) => setFrameworkFilter(e.target.value)}
                >
                  <option value="">All frameworks</option>
                  {frameworks.map((fw: any) => (
                    <option key={fw.id} value={fw.id}>
                      {fw.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="btn-primary w-full justify-center"
              disabled={generating}
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Preview + History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Preview */}
          {previewReport && (
            <div className="card">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {previewReport.name || REPORT_TYPES.find((rt) => rt.type === previewReport.type)?.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generated {new Date(previewReport.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={statusBadge(previewReport.status)}>
                    {previewReport.status}
                  </span>
                  <button
                    onClick={() => handleDownload(previewReport)}
                    className="btn-secondary btn-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                {previewReport.content ? (
                  <pre className="bg-slate-50 rounded-lg p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {typeof previewReport.content === 'string'
                      ? previewReport.content
                      : JSON.stringify(previewReport.content, null, 2)}
                  </pre>
                ) : previewReport.status === 'generating' ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Report is being generated...</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No content available for this report.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* History */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Report History</h3>
            </div>
            {reports.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">
                          {report.name ||
                            REPORT_TYPES.find((rt) => rt.type === report.type)?.label ||
                            report.type}
                        </span>
                        <span className={statusBadge(report.status)}>{report.status}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(report.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handlePreview(report)}
                        className="btn-secondary btn-sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {report.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(report)}
                          className="btn-secondary btn-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <FileBarChart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  No reports generated yet. Configure parameters and click Generate.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
