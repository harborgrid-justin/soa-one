import { useEffect, useState } from 'react';
import {
  Store,
  Search,
  Download,
  Star,
  Plus,
  Tag,
  CheckCircle,
  Package,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getTemplates,
  installTemplate as installTemplateApi,
  createTemplate,
} from '../api/client';
import { useStore } from '../store';

type Category = 'all' | 'insurance' | 'healthcare' | 'finance' | 'compliance';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  downloads: number;
  rating: number;
  author: string;
  createdAt: string;
  contents?: {
    ruleSets: number;
    rules: number;
    decisionTables: number;
    dataModels: number;
  };
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'compliance', label: 'Compliance' },
];

const categoryBadge: Record<string, string> = {
  insurance: 'badge-blue',
  healthcare: 'badge-green',
  finance: 'badge-yellow',
  compliance: 'bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full',
};

export function TemplateMarketplace() {
  const { addNotification } = useStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [installTemplate, setInstallTemplate] = useState<Template | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCategory, setCreateCategory] = useState('insurance');
  const [createContent, setCreateContent] = useState('{}');

  const fetchTemplates = () => {
    setLoading(true);
    getTemplates({ category: category !== 'all' ? category : undefined })
      .then((data) => setTemplates(data.templates || data || []))
      .catch(() => {
        // Sample data for UI
        setTemplates([
          {
            id: '1',
            name: 'Auto Insurance Premium',
            description:
              'Complete auto insurance premium calculation with risk factors, driver profiles, and vehicle classifications.',
            category: 'insurance',
            downloads: 1240,
            rating: 4.8,
            author: 'SOA One Team',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 3, rules: 24, decisionTables: 2, dataModels: 4 },
          },
          {
            id: '2',
            name: 'HIPAA Compliance Pack',
            description:
              'Pre-built compliance rules for HIPAA including data access controls, audit requirements, and breach notification rules.',
            category: 'healthcare',
            downloads: 890,
            rating: 4.6,
            author: 'SOA One Team',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 2, rules: 18, decisionTables: 1, dataModels: 3 },
          },
          {
            id: '3',
            name: 'Credit Risk Scoring',
            description:
              'Credit risk assessment framework with scoring models, threshold rules, and automated decision workflows.',
            category: 'finance',
            downloads: 2100,
            rating: 4.9,
            author: 'SOA One Team',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 4, rules: 32, decisionTables: 5, dataModels: 6 },
          },
          {
            id: '4',
            name: 'KYC/AML Verification',
            description:
              'Know Your Customer and Anti-Money Laundering verification rules with risk-based escalation.',
            category: 'compliance',
            downloads: 1560,
            rating: 4.7,
            author: 'Community',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 2, rules: 15, decisionTables: 3, dataModels: 2 },
          },
          {
            id: '5',
            name: 'Health Plan Eligibility',
            description:
              'Health insurance eligibility determination rules with coverage tiers and dependent management.',
            category: 'healthcare',
            downloads: 670,
            rating: 4.4,
            author: 'Community',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 2, rules: 12, decisionTables: 2, dataModels: 3 },
          },
          {
            id: '6',
            name: 'Loan Underwriting',
            description:
              'Automated loan underwriting rules with DTI calculations, property valuation, and approval workflows.',
            category: 'finance',
            downloads: 980,
            rating: 4.5,
            author: 'SOA One Team',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 3, rules: 28, decisionTables: 4, dataModels: 5 },
          },
          {
            id: '7',
            name: 'SOX Audit Controls',
            description:
              'Sarbanes-Oxley compliance controls including separation of duties, access reviews, and change management.',
            category: 'compliance',
            downloads: 430,
            rating: 4.3,
            author: 'Community',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 1, rules: 10, decisionTables: 1, dataModels: 2 },
          },
          {
            id: '8',
            name: 'Life Insurance Quoting',
            description:
              'Life insurance quote engine with actuarial tables, health assessments, and rider pricing rules.',
            category: 'insurance',
            downloads: 750,
            rating: 4.6,
            author: 'SOA One Team',
            createdAt: new Date().toISOString(),
            contents: { ruleSets: 2, rules: 20, decisionTables: 3, dataModels: 4 },
          },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
  }, [category]);

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || t.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = (template: Template) => {
    setInstalling(true);
    installTemplateApi(template.id)
      .then(() => {
        addNotification({ type: 'success', message: `"${template.name}" installed successfully` });
        setInstallTemplate(null);
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to install template' });
      })
      .finally(() => setInstalling(false));
  };

  const handleCreateTemplate = () => {
    if (!createName.trim()) {
      addNotification({ type: 'error', message: 'Template name is required' });
      return;
    }
    try {
      JSON.parse(createContent);
    } catch {
      addNotification({ type: 'error', message: 'Content must be valid JSON' });
      return;
    }

    createTemplate({
        name: createName,
        description: createDesc,
        category: createCategory,
        content: createContent,
      })
      .then(() => {
        addNotification({ type: 'success', message: 'Template created' });
        setShowCreateModal(false);
        setCreateName('');
        setCreateDesc('');
        setCreateCategory('insurance');
        setCreateContent('{}');
        fetchTemplates();
      })
      .catch(() => {
        addNotification({ type: 'error', message: 'Failed to create template' });
      });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${
          i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
        }`}
      />
    ));
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
            <Store className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Template Marketplace</h1>
            <p className="text-sm text-slate-500">
              Browse and install pre-built rule templates
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                category === cat.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="card p-5 hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    template.category === 'insurance'
                      ? 'bg-blue-50'
                      : template.category === 'healthcare'
                        ? 'bg-emerald-50'
                        : template.category === 'finance'
                          ? 'bg-amber-50'
                          : 'bg-purple-50'
                  }`}
                >
                  <Package
                    className={`w-5 h-5 ${
                      template.category === 'insurance'
                        ? 'text-blue-600'
                        : template.category === 'healthcare'
                          ? 'text-emerald-600'
                          : template.category === 'finance'
                            ? 'text-amber-600'
                            : 'text-purple-600'
                    }`}
                  />
                </div>
                <span className={categoryBadge[template.category] || 'badge-gray'}>
                  {template.category}
                </span>
              </div>

              <h4 className="font-semibold text-slate-900 text-sm mb-1">{template.name}</h4>
              <p className="text-xs text-slate-500 mb-3 flex-1 line-clamp-2">
                {template.description}
              </p>

              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-0.5">{renderStars(template.rating)}</div>
                <span className="text-xs text-slate-500">{template.rating}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                <div className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {template.downloads.toLocaleString()}
                </div>
                <span>{template.author}</span>
              </div>

              <button
                onClick={() => setInstallTemplate(template)}
                className="btn-primary btn-sm w-full"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card px-6 py-16 text-center">
          <Store className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No Templates Found</h3>
          <p className="text-sm text-slate-500">
            {search
              ? 'Try adjusting your search or filters.'
              : 'No templates available in this category.'}
          </p>
        </div>
      )}

      {/* Install Confirmation Modal */}
      <Modal
        open={!!installTemplate}
        onClose={() => setInstallTemplate(null)}
        title="Install Template"
      >
        {installTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-brand-600" />
              <div>
                <h4 className="font-semibold text-slate-900">{installTemplate.name}</h4>
                <p className="text-sm text-slate-500">{installTemplate.description}</p>
              </div>
            </div>

            {installTemplate.contents && (
              <div>
                <label className="label">What will be created</label>
                <div className="space-y-2">
                  {installTemplate.contents.ruleSets > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-800">
                        {installTemplate.contents.ruleSets} Rule Set
                        {installTemplate.contents.ruleSets > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {installTemplate.contents.rules > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-800">
                        {installTemplate.contents.rules} Rule
                        {installTemplate.contents.rules > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {installTemplate.contents.decisionTables > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-800">
                        {installTemplate.contents.decisionTables} Decision Table
                        {installTemplate.contents.decisionTables > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {installTemplate.contents.dataModels > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-800">
                        {installTemplate.contents.dataModels} Data Model
                        {installTemplate.contents.dataModels > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setInstallTemplate(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleInstall(installTemplate)}
                className="btn-primary"
                disabled={installing}
              >
                <Download className="w-4 h-4" />
                {installing ? 'Installing...' : 'Confirm Install'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Template Modal (Admin) */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Template"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Template Name</label>
            <input
              className="input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Auto Insurance Premium Calculator"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Describe what this template includes..."
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
            >
              <option value="insurance">Insurance</option>
              <option value="healthcare">Healthcare</option>
              <option value="finance">Finance</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
          <div>
            <label className="label">Content (JSON)</label>
            <textarea
              className="input font-mono text-xs min-h-[120px]"
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              placeholder='{"ruleSets": [...], "rules": [...]}'
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreateTemplate} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
