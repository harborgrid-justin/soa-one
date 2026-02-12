import { useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Award,
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api, { getAuditLogs } from '../api/client';
import { useStore } from '../store';

type FrameworkType = 'SOX' | 'HIPAA' | 'GDPR' | 'PCI' | 'Custom';

interface Requirement {
  id: string;
  name: string;
  description: string;
  status: 'met' | 'partial' | 'not_met' | 'not_applicable';
  linkedRuleSets: { id: string; name: string }[];
}

interface Framework {
  id: string;
  name: string;
  type: FrameworkType;
  description: string;
  retentionDays: number;
  status: 'active' | 'draft' | 'archived';
  requirements: Requirement[];
  lastCertifiedAt: string | null;
  certifiedBy: string | null;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityName: string;
  userName: string;
  createdAt: string;
}

const typeColors: Record<FrameworkType, string> = {
  SOX: 'bg-blue-100 text-blue-700',
  HIPAA: 'bg-emerald-100 text-emerald-700',
  GDPR: 'bg-purple-100 text-purple-700',
  PCI: 'bg-amber-100 text-amber-700',
  Custom: 'badge-gray',
};

const statusBadge: Record<string, string> = {
  active: 'badge-green',
  draft: 'badge-yellow',
  archived: 'badge-gray',
};

const requirementStatusConfig = {
  met: { badge: 'badge-green', label: 'Met', icon: Check },
  partial: { badge: 'badge-yellow', label: 'Partial', icon: AlertTriangle },
  not_met: {
    badge: 'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full',
    label: 'Not Met',
    icon: AlertTriangle,
  },
  not_applicable: { badge: 'badge-gray', label: 'N/A', icon: FileText },
};

export function ComplianceDashboard() {
  const { addNotification } = useStore();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<FrameworkType>('SOX');
  const [formDesc, setFormDesc] = useState('');
  const [formRetention, setFormRetention] = useState(365);

  const fetchFrameworks = () => {
    setLoading(true);
    api
      .get('/compliance/frameworks')
      .then((r) => setFrameworks(r.data.frameworks || r.data || []))
      .catch(() => {
        setFrameworks([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const handleCreate = () => {
    if (!formName.trim()) {
      addNotification({ type: 'error', message: 'Framework name is required' });
      return;
    }

    api
      .post('/compliance/frameworks', {
        name: formName,
        type: formType,
        description: formDesc,
        retentionDays: formRetention,
      })
      .then(() => {
        addNotification({ type: 'success', message: 'Framework created' });
        setShowCreateModal(false);
        setFormName('');
        setFormType('SOX');
        setFormDesc('');
        setFormRetention(365);
        fetchFrameworks();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to create framework' });
      });
  };

  const handleCertify = (frameworkId: string) => {
    api
      .post(`/compliance/frameworks/${frameworkId}/certify`)
      .then(() => {
        addNotification({ type: 'success', message: 'Framework certified' });
        fetchFrameworks();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to certify framework' });
      });
  };

  const viewAuditTrail = (frameworkId: string) => {
    setShowAuditModal(true);
    setAuditLoading(true);
    getAuditLogs({ entity: 'compliance', limit: 50 })
      .then((data) => setAuditLogs(data.logs || []))
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  };

  const toggleFramework = (id: string) => {
    setExpandedFramework((prev) => (prev === id ? null : id));
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Compliance Dashboard</h1>
            <p className="text-sm text-slate-500">
              Manage compliance frameworks and certifications
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => viewAuditTrail('')} className="btn-secondary btn-sm">
            <Clock className="w-3.5 h-3.5" />
            Audit Trail
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Framework
          </button>
        </div>
      </div>

      {/* Frameworks list */}
      <div className="space-y-4">
        {frameworks.length > 0 ? (
          frameworks.map((fw) => {
            const expanded = expandedFramework === fw.id;
            const metCount = fw.requirements?.filter((r) => r.status === 'met').length || 0;
            const totalReqs = fw.requirements?.length || 0;
            const progressPct = totalReqs > 0 ? Math.round((metCount / totalReqs) * 100) : 0;

            return (
              <div key={fw.id} className="card">
                {/* Framework header */}
                <button
                  onClick={() => toggleFramework(fw.id)}
                  className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-slate-900">{fw.name}</h4>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[fw.type]}`}
                      >
                        {fw.type}
                      </span>
                      <span className={statusBadge[fw.status] || 'badge-gray'}>{fw.status}</span>
                    </div>
                    {fw.description && (
                      <p className="text-sm text-slate-500">{fw.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Retention: {fw.retentionDays} days</span>
                      {fw.lastCertifiedAt && (
                        <span className="flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          Certified {new Date(fw.lastCertifiedAt).toLocaleDateString()}
                          {fw.certifiedBy && ` by ${fw.certifiedBy}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress indicator */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">{progressPct}%</div>
                      <div className="text-xs text-slate-500">
                        {metCount}/{totalReqs} requirements
                      </div>
                    </div>
                    <div className="w-16 h-16 relative">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={progressPct >= 80 ? '#10b981' : progressPct >= 50 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="3"
                          strokeDasharray={`${progressPct}, 100`}
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="px-6 pb-6 pl-14 border-t border-slate-100">
                    {/* Actions */}
                    <div className="flex items-center gap-2 py-4">
                      <button
                        onClick={() => handleCertify(fw.id)}
                        className="btn-primary btn-sm"
                      >
                        <Award className="w-3.5 h-3.5" />
                        Certify
                      </button>
                      <button
                        onClick={() => viewAuditTrail(fw.id)}
                        className="btn-secondary btn-sm"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        View Audit Trail
                      </button>
                    </div>

                    {/* Requirements checklist */}
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-3 block">
                        Requirements ({totalReqs})
                      </label>
                      {fw.requirements && fw.requirements.length > 0 ? (
                        <div className="space-y-3">
                          {fw.requirements.map((req) => {
                            const config = requirementStatusConfig[req.status];
                            return (
                              <div
                                key={req.id}
                                className="bg-slate-50 rounded-lg p-4"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm text-slate-900">
                                        {req.name}
                                      </span>
                                      <span className={config.badge}>{config.label}</span>
                                    </div>
                                    <p className="text-xs text-slate-500">{req.description}</p>
                                    {req.linkedRuleSets && req.linkedRuleSets.length > 0 && (
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <LinkIcon className="w-3 h-3 text-slate-400" />
                                        {req.linkedRuleSets.map((rs) => (
                                          <span
                                            key={rs.id}
                                            className="text-xs bg-white rounded px-2 py-0.5 text-brand-600 border border-slate-200"
                                          >
                                            {rs.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No requirements defined for this framework.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="card px-6 py-16 text-center">
            <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Frameworks</h3>
            <p className="text-sm text-slate-500 mb-4">
              Create a compliance framework to track requirements and certifications.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" />
              Create Framework
            </button>
          </div>
        )}
      </div>

      {/* Create Framework Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Compliance Framework"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Framework Name</label>
            <input
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. SOX 2024 Compliance"
            />
          </div>
          <div>
            <label className="label">Framework Type</label>
            <select
              className="input"
              value={formType}
              onChange={(e) => setFormType(e.target.value as FrameworkType)}
            >
              <option value="SOX">SOX (Sarbanes-Oxley)</option>
              <option value="HIPAA">HIPAA</option>
              <option value="GDPR">GDPR</option>
              <option value="PCI">PCI DSS</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input min-h-[80px]"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Describe the compliance requirements..."
            />
          </div>
          <div>
            <label className="label">Retention Period (days)</label>
            <input
              type="number"
              className="input"
              value={formRetention}
              onChange={(e) => setFormRetention(Number(e.target.value))}
              min={1}
            />
            <p className="text-xs text-slate-400 mt-1">
              How long audit records should be retained
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary">
              <Shield className="w-4 h-4" />
              Create Framework
            </button>
          </div>
        </div>
      </Modal>

      {/* Audit Trail Modal */}
      <Modal
        open={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        title="Compliance Audit Trail"
        size="xl"
      >
        {auditLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : auditLogs.length > 0 ? (
          <div className="divide-y divide-slate-100 -mx-6">
            {auditLogs.map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-900 font-medium">{log.userName || 'System'}</span>
                  <span className="text-sm text-slate-500">
                    {' '}
                    {log.action} {log.entity}
                    {log.entityName ? `: ${log.entityName}` : ''}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No audit log entries found.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
