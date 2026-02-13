import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Download,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Package,
  FileText,
  Lock,
  CreditCard,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import api from '../api/client';
import { useStore } from '../store';

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface CompliancePack {
  id: string;
  name: string;
  slug: string;
  description: string;
  ruleCount: number;
  icon: string;
  installed: boolean;
  installedAt?: string;
  version: string;
  rules?: ComplianceRule[];
}

interface InstallPreview {
  projectName: string;
  ruleSetName: string;
  frameworkName: string;
  ruleCount: number;
}

const PACK_ICONS: Record<string, any> = {
  hipaa: Lock,
  sox: FileText,
  gdpr: Globe,
  'pci-dss': CreditCard,
};

const PACK_COLORS: Record<string, string> = {
  hipaa: 'bg-blue-50 text-blue-600 border-blue-200',
  sox: 'bg-purple-50 text-purple-600 border-purple-200',
  gdpr: 'bg-green-50 text-green-600 border-green-200',
  'pci-dss': 'bg-orange-50 text-orange-600 border-orange-200',
};

export function CompliancePacks() {
  const { addNotification } = useStore();
  const [packs, setPacks] = useState<CompliancePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<CompliancePack | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installPack, setInstallPack] = useState<CompliancePack | null>(null);
  const [installPreview, setInstallPreview] = useState<InstallPreview | null>(null);
  const [installing, setInstalling] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPacks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/compliance-packs');
      setPacks(res.data.packs || res.data || []);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load compliance packs' });
      setPacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacks();
  }, []);

  const handleSelectPack = async (pack: CompliancePack) => {
    setSelectedPack(pack);
    if (!pack.rules) {
      setLoadingDetail(true);
      try {
        const res = await api.get(`/compliance-packs/${pack.id}`);
        const detailed = res.data.pack || res.data;
        setSelectedPack(detailed);
        setPacks((prev) =>
          prev.map((p) => (p.id === pack.id ? { ...p, rules: detailed.rules } : p)),
        );
      } catch {
        addNotification({ type: 'error', message: 'Failed to load pack details' });
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const handleStartInstall = async (pack: CompliancePack) => {
    setInstallPack(pack);
    setInstallPreview(null);
    setShowInstallModal(true);
    try {
      const res = await api.get(`/compliance-packs/${pack.id}/preview`);
      setInstallPreview(res.data);
    } catch {
      setInstallPreview({
        projectName: `${pack.name} Compliance`,
        ruleSetName: `${pack.name} Rules`,
        frameworkName: pack.name,
        ruleCount: pack.ruleCount,
      });
    }
  };

  const handleConfirmInstall = async () => {
    if (!installPack) return;
    setInstalling(true);
    try {
      await api.post(`/compliance-packs/${installPack.id}/install`);
      addNotification({ type: 'success', message: `${installPack.name} pack installed successfully` });
      setShowInstallModal(false);
      setInstallPack(null);
      fetchPacks();
      if (selectedPack?.id === installPack.id) {
        setSelectedPack((prev) => (prev ? { ...prev, installed: true } : null));
      }
    } catch {
      addNotification({ type: 'error', message: 'Failed to install compliance pack' });
    } finally {
      setInstalling(false);
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
          <ShieldCheck className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Compliance Packs</h1>
          <p className="text-sm text-slate-500">
            Industry compliance rule packs for quick setup
          </p>
        </div>
      </div>

      {selectedPack ? (
        /* Detail view */
        <div className="space-y-4">
          <button
            onClick={() => setSelectedPack(null)}
            className="btn-secondary btn-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Packs
          </button>

          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center border ${
                    PACK_COLORS[selectedPack.slug] || 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {(() => {
                    const IconComp = PACK_ICONS[selectedPack.slug] || Package;
                    return <IconComp className="w-7 h-7" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedPack.name}</h2>
                  <p className="text-sm text-slate-500">{selectedPack.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-blue">v{selectedPack.version}</span>
                    <span className="badge-gray">{selectedPack.ruleCount} rules</span>
                    {selectedPack.installed && (
                      <span className="badge-green">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Installed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!selectedPack.installed && (
                <button
                  onClick={() => handleStartInstall(selectedPack)}
                  className="btn-primary"
                >
                  <Download className="w-4 h-4" />
                  Install Pack
                </button>
              )}
            </div>
          </div>

          {/* Rules list */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Rules in this Pack</h3>
            </div>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedPack.rules && selectedPack.rules.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {selectedPack.rules.map((rule) => (
                  <div key={rule.id} className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm text-slate-900">{rule.name}</h4>
                      <span className="badge-gray text-xs">{rule.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No rule details available.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid view */
        <div>
          {packs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packs.map((pack) => {
                const IconComp = PACK_ICONS[pack.slug] || Package;
                const colorClass =
                  PACK_COLORS[pack.slug] || 'bg-slate-50 text-slate-600 border-slate-200';
                return (
                  <button
                    key={pack.id}
                    onClick={() => handleSelectPack(pack)}
                    className="card p-5 text-left hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorClass}`}
                      >
                        <IconComp className="w-6 h-6" />
                      </div>
                      {pack.installed && (
                        <span className="badge-green text-xs">
                          <CheckCircle className="w-3 h-3 mr-0.5" />
                          Installed
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                      {pack.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {pack.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="badge-gray text-xs">{pack.ruleCount} rules</span>
                      <span className="badge-blue text-xs">v{pack.version}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-brand-600 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      View details <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="card px-6 py-16 text-center">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No compliance packs available.</p>
            </div>
          )}
        </div>
      )}

      {/* Install confirmation modal */}
      <Modal
        open={showInstallModal}
        onClose={() => {
          setShowInstallModal(false);
          setInstallPack(null);
        }}
        title={`Install ${installPack?.name || 'Compliance Pack'}`}
      >
        <div className="space-y-4">
          {installPack && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                This will create the following resources in your workspace:
              </div>
            </div>
          )}

          {installPreview ? (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Project</span>
                  <span className="font-medium text-slate-900">
                    {installPreview.projectName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Rule Set</span>
                  <span className="font-medium text-slate-900">
                    {installPreview.ruleSetName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Framework</span>
                  <span className="font-medium text-slate-900">
                    {installPreview.frameworkName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Rules</span>
                  <span className="font-medium text-slate-900">
                    {installPreview.ruleCount} rules
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowInstallModal(false);
                setInstallPack(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmInstall}
              className="btn-primary"
              disabled={installing || !installPreview}
            >
              {installing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {installing ? 'Installing...' : 'Confirm Install'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
